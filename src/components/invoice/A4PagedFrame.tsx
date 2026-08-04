"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { InvoiceDocument, InvoiceFooter } from "./InvoiceDocument";
import type { InvoiceLabels } from "@/lib/invoice-labels";
import { imageProxyUrl } from "@/lib/image";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * Renders an invoice across ONE OR MORE A4 pages (794×1123). The banner header, the
 * From / Bill To / Invoice Details section, the table column header and the Invotick footer repeat
 * on EVERY page; the totals summary appears ONLY on the LAST page. A "Page X of Y" line sits under
 * each footer.
 *
 * Line items FILL each page (page 1 gets the maximum that fits, not an even split): a page without
 * the summary holds `nNoSummary` rows; the last page — which carries the summary box — holds fewer
 * (`nWithSummary`). We greedily fill non-last pages to `nNoSummary`, always leaving at least one item
 * for the summary page so it's never a lonely summary box. Examples (nNoSummary 24, nWithSummary 16):
 *   17 → 16 + 1 · 18 → 17 + 1 · 26 → 24 + 2.
 *
 * Measured off-screen before first paint (no flicker) and scaled to the container width; multi-page
 * stacks vertically and scrolls.
 */
const SHEET_W = 794;
const SHEET_H = 1123;
// Fit the whole page as LARGE as it goes (default zoom = maximum). 1.0 = fill the pane; the small
// top/bottom stack padding (below) is what keeps a hair of breathing room, and it's accounted for in
// the scale so the full page still fits without scrolling.
const FIT_FACTOR = 1.0;
// Breathing room around the page, in SCREEN pixels — deliberately not sheet units, because the
// point is that the gap looks the same on all four sides, and a scaled unit would make the top and
// bottom differ from the left and right the moment the scale isn't 1.
const PAGE_MARGIN = 10;
// Width of the scroll bar, which `scrollbar-gutter: stable both-edges` reserves on BOTH sides —
// outside clientWidth, so it lands on top of PAGE_MARGIN and only on the left and right. The top and
// bottom have to add it back by hand or the sides end up twice the gap of the top (48px vs 24px on a
// Pixel, which is exactly what it looked like). Keep in step with the ::-webkit-scrollbar rule below.
const SCROLLBAR_W = 8;
// What the gap actually comes out as, vertically. Horizontally the same total is PAGE_MARGIN plus the
// reserved gutter; the app's preview sheet uses this number too, so the two must not drift.
const PAGE_INSET_Y = PAGE_MARGIN + SCROLLBAR_W;
// Blank margin below the promotional footer. Equal to the footer's side inset (the footer wrapper's
// paddingLeft/Right = 32) so the footer sits with the same gap on the left, right and bottom.
const FOOTER_BOTTOM_MARGIN = 32;

type Page = { start: number; count: number; summary: boolean };

function paginate(total: number, nNoSummary: number, nWithSummary: number): Page[] {
  const pages: Page[] = [];
  let start = 0;
  let remaining = total;
  let guard = 0;
  while (remaining > 0 && guard++ < 1000) {
    if (remaining <= nWithSummary) {
      pages.push({ start, count: remaining, summary: true }); // fits alongside the summary → last page
      start += remaining;
      remaining = 0;
    } else {
      let take = Math.min(remaining, nNoSummary);
      if (take === remaining) take = remaining - 1; // leave ≥1 item for the summary page
      pages.push({ start, count: take, summary: false });
      start += take;
      remaining -= take;
    }
  }
  if (pages.length === 0) pages.push({ start: 0, count: 0, summary: true }); // no items → one page
  return pages;
}

/**
 * A select-then-drag overlay image (stamp or signature) mirroring native's DraggableModule:
 *   • unselected → inert (never captures the pointer) so pinch-zoom/pan pass through
 *   • single tap → select (light dashed container + corner dots)
 *   • selected → drag to move
 *
 * Drag is JITTER-FREE: while dragging we move the DOM node imperatively (no React re-render per
 * frame) and use an anchor model (startFrac + total delta, not accumulated deltas), then commit the
 * final position to React state on release. This kills the vibration a static finger used to cause.
 */
function DraggableOverlay({
  url, alt, size, frac, selected, scale, sheetW, sheetH, onSelect, onCommit, onRemove,
}: {
  url: string;
  alt: string;
  size: number;
  frac: { x: number; y: number };
  selected: boolean;
  scale: number;
  sheetW: number;
  sheetH: number;
  onSelect: () => void;
  onCommit: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; fx: number; fy: number; cx: number; cy: number; moved: boolean } | null>(null);
  // Pointers currently down on this overlay. A second one means the user is pinching, and a pinch is
  // always a zoom — never a move — however this overlay was grabbed first.
  const pointers = useRef(new Set<number>());

  const tellHost = (v: boolean) => {
    try {
      (window as unknown as { AndroidStamp?: { setDragging?: (b: boolean) => void } })
        .AndroidStamp?.setDragging?.(v);
    } catch { /* not hosted by the app */ }
  };

  /** Abandon an in-progress drag and put the overlay back where it started. */
  const abortDrag = () => {
    drag.current = null;
    const el = elRef.current;
    if (el) el.style.transform = "";
    tellHost(false);
  };

  return (
    <div
      ref={elRef}
      onPointerDown={(e) => {
        pointers.current.add(e.pointerId);
        // Second finger down: this is a pinch. Give the page back its gesture and leave the overlay
        // where it was — zooming with a stamp selected must not drag the stamp along with it.
        if (pointers.current.size > 1) {
          abortDrag();
          return;
        }
        drag.current = { sx: e.clientX, sy: e.clientY, fx: frac.x, fy: frac.y, cx: frac.x, cy: frac.y, moved: false };
        // Only a SELECTED overlay grabs the pointer to drag; unselected we leave the event alone so
        // the host (WebView pinch, or react-zoom-pan-pinch) still gets both fingers for a pinch.
        if (selected) {
          e.stopPropagation();
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* no active pointer */ }
        // Tell the Android host the overlay owns this gesture now.
        //
        // Its touch listener otherwise reads a downward drag on a page with nothing left to scroll
        // as "the user wants the sheet", hands the gesture away, and the stamp stops after a few
        // pixels. Dragging upward was unaffected, which is what made this look like slowness rather
        // than a stolen gesture. Harmless in a browser, where the interface does not exist.
        try { (window as unknown as { AndroidStamp?: { setDragging?: (v: boolean) => void } })
          .AndroidStamp?.setDragging?.(true); } catch { /* not hosted by the app */ }
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // A pinch can begin after the drag has: bail the moment it does.
        if (pointers.current.size > 1) { abortDrag(); return; }
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
        if (!selected || !scale) return;
        d.cx = Math.min(0.96, Math.max(0, d.fx + (e.clientX - d.sx) / scale / sheetW));
        d.cy = Math.min(0.96, Math.max(0, d.fy + (e.clientY - d.sy) / scale / sheetH));
        const el = elRef.current;
        // translate3d, not left/top.
        //
        // Changing left or top asks the browser to lay the document out again on every pointer move,
        // and this document is an A4 page carrying base64 images — logo, header, background. That is
        // why the stamp crawled here while the same gesture was fine on a light page: the cost was
        // never the gesture, it was re-laying-out everything behind it sixty times a second.
        //
        // A transform is composited on the GPU and skips layout and paint entirely. The element's
        // own left/top stay where they were, so the offset below is a delta from that origin, and
        // it is cleared on commit once React re-renders at the new position.
        if (el) {
          el.style.transform =
            `translate3d(${(d.cx - frac.x) * sheetW}px, ${(d.cy - frac.y) * sheetH}px, 0)`;
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        abortDrag();
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        const d = drag.current;
        const el = elRef.current;
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
        // Told FIRST, before any early return.
        //
        // This used to sit below `if (!d) return`, so a gesture that ended without a live drag — a
        // pinch that aborted it, most commonly — never reported the end. The host went on believing
        // an overlay drag was in progress for the rest of the session and kept deciding every touch
        // as if it were one.
        tellHost(false);
        if (!d) return;
        // Drop the transform before React re-renders at the new position, or the element would sit
        // at its new left/top *plus* the drag delta — the move applied twice.
        if (el) el.style.transform = "";
        if (selected && d.moved) onCommit(d.cx, d.cy);
        else if (!d.moved && !selected) onSelect(); // first tap selects
      }}
      style={{
        position: "absolute",
        left: frac.x * sheetW,
        top: frac.y * sheetH,
        width: size,
        height: size,
        zIndex: 20,
        cursor: selected ? "grab" : "pointer",
        // Selected → we own a ONE-finger drag; two fingers still belong to the host.
        //
        // This was "none" while selected, which told the browser to send us everything — including a
        // pinch. Zooming became impossible anywhere the stamp happened to be, and a stamp sits in
        // the middle of the page. pinch-zoom hands multi-touch back while keeping the single-finger
        // drag ours, and the handlers abort the drag the moment a second finger lands.
        touchAction: selected ? "pinch-zoom" : "auto",
        // Light dashed selection container (mirrors native drawSelectionUI).
        border: selected ? "1.5px dashed rgba(37,99,235,0.85)" : undefined,
        background: selected ? "rgba(37,99,235,0.10)" : undefined,
        borderRadius: selected ? 4 : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" }} />
      {selected &&
        ([[-4, -4], [-4, undefined], [undefined, -4], [undefined, undefined]] as const).map((c, ci) => (
          <span key={ci} style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "rgba(37,99,235,1)", border: "1.5px solid #fff", left: c[0] === undefined ? undefined : c[0], right: c[0] === undefined ? -4 : undefined, top: c[1] === undefined ? undefined : c[1], bottom: c[1] === undefined ? -4 : undefined }} />
        ))}
      {/* Remove (×) affordance — only while selected. Sits just above the top-right corner; its own
          pointerdown is swallowed so it neither starts a drag nor bubbles to the sheet's deselect. */}
      {selected && (
        <button
          type="button"
          aria-label={`Remove ${alt.toLowerCase()}`}
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            position: "absolute", top: -14, right: -14, width: 26, height: 26, padding: 0,
            borderRadius: "50%", border: "1.5px solid #fff", background: "#e53935", color: "#fff",
            fontSize: 16, lineHeight: "22px", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)", touchAction: "none",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Read-only positioned overlay — same footprint/position as DraggableOverlay (left/top = frac×sheet,
 * size px) but no selection/drag. Used for the receiver-facing views (OG-link /i/{token}) so the
 * stamp/signature render at the SAME saved position as the editable app WebView, instead of falling
 * back to InvoiceDocument's inline slot. Keeps all HTML views pixel-identical.
 */
function StaticOverlay({
  url, alt, size, frac, sheetW, sheetH,
}: {
  url: string;
  alt: string;
  size: number;
  frac: { x: number; y: number };
  sheetW: number;
  sheetH: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      draggable={false}
      style={{
        position: "absolute",
        left: frac.x * sheetW,
        top: frac.y * sheetH,
        width: size,
        height: size,
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 20,
      }}
    />
  );
}

export function A4PagedFrame({
  data,
  qrDataUrl,
  zoomable,
  draggableStamp,
  onStampMove,
  onSignatureMove,
  onStampRemove,
  onSignatureRemove,
  onAtTopChange,
  labels,
  dir,
}: {
  data: InvoiceRenderData;
  qrDataUrl?: string | null;
  zoomable?: boolean;
  // When true the stamp + signature become draggable overlays (app editing WebView, not receiver).
  draggableStamp?: boolean;
  // Report an overlay's new position as fractions of the sheet (0..1) so the app can persist it.
  onStampMove?: (xFrac: number, yFrac: number) => void;
  onSignatureMove?: (xFrac: number, yFrac: number) => void;
  // Report that the user removed an overlay so the app can drop it from the invoice.
  onStampRemove?: () => void;
  onSignatureRemove?: () => void;
  // Whether the page stack is scrolled to the very top. The app's bottom sheet uses this to decide
  // who owns a downward drag: the invoice scrolls until it can't, then the sheet takes over. The
  // host has to be told because the scrolling happens on a div inside the WebView, so the native
  // view's own canScrollVertically() would always say "no" and break multi-page scrolling.
  onAtTopChange?: (atTop: boolean) => void;
  // Localised invoice labels + reading direction (shared invoice → receiver's language).
  labels?: InvoiceLabels;
  dir?: "ltr" | "rtl";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Report a pull past the top, so a host that has a sheet below can close it.
  //
  // Passive, and that is the whole design. A passive listener cannot preventDefault, so it cannot
  // touch the scroll — which matters because two earlier attempts here broke panning outright: a
  // React onTouchMove (non-passive), and an overscroll-behavior rule that blocked the very scroll
  // chaining a zoomed page needs. Both were measured breaking it; this one was measured not to.
  //
  // Only from the top, and only single-finger: a pinch is a zoom, and a scroll that happens to
  // reach the top mid-way is still the page's own.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startY = 0;
    const down = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 1 || el.scrollTop > 0) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy <= 0) return;
      try {
        (window as unknown as { AndroidStamp?: { onPullDownAtTop?: (d: number) => void } })
          .AndroidStamp?.onPullDownAtTop?.(dy);
      } catch { /* not hosted by the app */ }
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
    };
  }, []);
  const withTotalsRef = useRef<HTMLDivElement>(null);
  const noTotalsRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const summarySheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([{ start: 0, count: 0, summary: true }]);
  // Row capacity of the LAST (summary) page — everything except the item rows there (header, parties,
  // table head, totals, notes, signature AND payment/terms) is the "chrome"; this is how many item
  // rows still fit beside it. Passed to the summary page as `padRows` so its min-row padding never
  // exceeds what fits: a tall payment/terms block used to push the min-9 padding past the page bottom,
  // which overflowed and made flexbox squeeze the fixed header (its image height "shrank"). Capped at
  // 9 so normal invoices keep the native min-9 look.
  const [summaryRows, setSummaryRows] = useState(9);
  // Measured footer height — the per-page content area is (SHEET_H − footerH) so the trailing
  // summary can anchor (mt-auto) to just above the footer instead of floating under the table.
  const [footerH, setFooterH] = useState(110);
  // Which page (1-based) is currently in view — drives the "N / total" scroll indicator on multi-page.
  const [currentPage, setCurrentPage] = useState(1);

  // Draggable overlays (stamp + signature) — positions as fractions of the sheet. Native parity
  // (SharedComponents.kt): an overlay must be SELECTED (single tap → light dashed container) before it
  // can be dragged; while unselected it never grabs the pointer, so a finger landing on it during a
  // pinch passes straight through to zoom/pan. Only ONE overlay is selected at a time.
  // The user's OWN (company) stamp + signature — draggable overlays.
  // Always rendered as positioned overlays (draggable in the app WebView, static elsewhere) so every
  // HTML view — offline bundle, online /embed/render, AND the OG-link — places the stamp/signature at
  // the user's saved fraction. (Previously these were null unless draggable, which forced the OG view
  // onto InvoiceDocument's inline slot: fixed position + an "Authorized signature" label native never
  // shows. The inline slot is now always hidden below.)
  const stampUrl = imageProxyUrl(data.stampImage);
  const signatureUrl = imageProxyUrl(data.signatureImage);
  // The auto PAID / PARTIALLY-PAID stamp — a SEPARATE overlay pinned to the totals box, shown
  // alongside (not instead of) the company stamp.
  const paymentStampUrl = imageProxyUrl(data.paymentStampImage);
  // Overlay sizes (px) from the saved fractions; payment stamp keeps its own slightly larger size.
  const stampSizePx = (data.stampSize ?? 0.189) * SHEET_W;
  const sigSizePx = (data.signatureSize ?? 0.189) * SHEET_W;
  // Company stamp: start where the user last dragged it (data.stampOffset); if it's a newly-added
  // stamp with no saved position, drop it in the empty space to the LEFT of the totals.
  const [stampFrac, setStampFrac] = useState(() =>
    data.stampOffsetX != null && data.stampOffsetY != null
      ? { x: data.stampOffsetX, y: data.stampOffsetY }
      : { x: 0.1, y: 0.52 });
  const [sigFrac, setSigFrac] = useState(() =>
    data.signatureOffsetX != null && data.signatureOffsetY != null
      ? { x: data.signatureOffsetX, y: data.signatureOffsetY }
      : { x: 0.09, y: 0.6 });
  // Payment stamp lives on the totals box (its top line is aligned by the effect below).
  const [paymentStampFrac, setPaymentStampFrac] = useState({ x: 0.68, y: 0.521 });
  const [selectedOverlay, setSelectedOverlay] = useState<"stamp" | "signature" | null>(null);
  // Local removal — hides the overlay immediately; the app persists it via onStamp/SignatureRemove.
  const [stampRemoved, setStampRemoved] = useState(false);
  const [signatureRemoved, setSignatureRemoved] = useState(false);

  const totalItems = data.items.length;

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const withT = withTotalsRef.current;
      const noT = noTotalsRef.current;
      if (!container || !withT || !noT) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const footerHMeasured = footerMeasureRef.current?.offsetHeight ?? 100;
      setFooterH(footerHMeasured);
      const usableH = SHEET_H - footerHMeasured - FOOTER_BOTTOM_MARGIN - 10;

      const rowH = (withT.querySelector("tbody tr") as HTMLElement | null)?.offsetHeight ?? 28;
      const renderedRows = Math.max(9, totalItems);
      // Chrome = everything except the item rows. "With" includes the totals box; "No" excludes it.
      const chromeWith = withT.scrollHeight - renderedRows * rowH;
      const chromeNo = noT.scrollHeight - renderedRows * rowH;
      const nWith = Math.max(1, Math.floor((usableH - chromeWith) / rowH));
      const nNo = Math.max(nWith, Math.floor((usableH - chromeNo) / rowH));

      const pg = paginate(totalItems, nNo, nWith);
      setPages(pg);
      // Cap the summary page's min-row padding at what actually fits (≤ nWith), never above the native 9.
      setSummaryRows(Math.min(9, nWith));

      // Fit ONE whole page to the pane (width OR height, whichever is tighter) at max zoom —
      // single- and multi-page alike, so a multi-page invoice opens on its full first page and the
      // rest are reached by scrolling down. Accounts for the top/bottom stack padding.
      // Fit inside the margin on every side. cw already excludes the reserved scrollbar gutters, so
      // horizontally we only subtract PAGE_MARGIN; vertically we subtract the gutter as well, which
      // is what makes the visible gap the same on all four sides.
      const s = Math.min(
        (cw - PAGE_MARGIN * 2) / SHEET_W,
        (ch - PAGE_INSET_Y * 2) / SHEET_H,
      ) * FIT_FACTOR;
      if (s > 0 && isFinite(s)) setScale(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (withTotalsRef.current) ro.observe(withTotalsRef.current);
    return () => ro.disconnect();
  }, [data, qrDataUrl, totalItems]);

  // Align the payment stamp's TOP edge to the totals box's top line (native parity — the auto stamp
  // sits over the totals). Measured from the rendered summary page so it tracks the totals wherever
  // pagination places it (single- or multi-page last page). Only y is derived; x keeps the
  // over-totals slot. Scale cancels out in the top/height ratio. Runs after layout, before paint.
  useLayoutEffect(() => {
    if (!paymentStampUrl) return;
    const sheet = summarySheetRef.current;
    if (!sheet) return;
    const totals = sheet.querySelector("[data-totals]") as HTMLElement | null;
    if (!totals) return;
    const sr = sheet.getBoundingClientRect();
    const tr = totals.getBoundingClientRect();
    if (sr.height <= 0) return;
    const yFrac = (tr.top - sr.top) / sr.height;
    // Guard avoids a render loop and won't nudge an already-aligned stamp.
    setPaymentStampFrac((f) => (Math.abs(f.y - yFrac) < 0.002 ? f : { x: f.x, y: yFrac }));
  }, [pages, scale, data, paymentStampUrl]);

  // Keep the COMPANY stamp / signature at their saved positions when a new invoice snapshot arrives.
  // (Local drags update these too; the drag round-trips through the app and re-injects the same
  // offset, so this converges instead of fighting the drag.)
  useLayoutEffect(() => {
    if (data.stampOffsetX != null && data.stampOffsetY != null) setStampFrac({ x: data.stampOffsetX, y: data.stampOffsetY });
  }, [data.stampOffsetX, data.stampOffsetY]);
  useLayoutEffect(() => {
    if (data.signatureOffsetX != null && data.signatureOffsetY != null) setSigFrac({ x: data.signatureOffsetX, y: data.signatureOffsetY });
  }, [data.signatureOffsetX, data.signatureOffsetY]);

  // Tell the host how many pages this turned into. Fires after pagination settles rather than on
  // every measure pass, so the app resizes once instead of flickering as rows are counted.
  // Tell the host whether we're at the top, and only when the answer changes. A single-page invoice
  // never scrolls, so it reports true once and the sheet is draggable from anywhere on it — which is
  // what you want when there's nothing to scroll.
  const atTopRef = useRef(true);
  const reportAtTop = (el: HTMLElement | null) => {
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    if (atTopRef.current === atTop) return;
    atTopRef.current = atTop;
    onAtTopChange?.(atTop);
  };
  useEffect(() => {
    atTopRef.current = true;
    onAtTopChange?.(true);
  }, [pages.length, onAtTopChange]);

  const s = scale ?? 0;
  const multi = pages.length > 1;

  // Track the page currently under the viewport centre so the "N / total" indicator updates on scroll.
  // Page stride = one page's scaled height + the inter-page gap; the stack has PAGE_MARGIN on top.
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    reportAtTop(el);
    if (s <= 0) return;
    const stride = (SHEET_H + 22) * s;
    if (stride <= 0) return;
    const centerY = el.scrollTop + el.clientHeight / 2 - PAGE_MARGIN;
    const idx = Math.min(pages.length, Math.max(1, Math.floor(centerY / stride) + 1));
    setCurrentPage((p) => (p === idx ? p : idx));
  };

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
    <div ref={containerRef} className="a4-frame" onScroll={!zoomable ? handleScroll : undefined} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: zoomable ? "hidden" : "auto", background: "#e9e9ec", touchAction: zoomable ? "none" : undefined, scrollbarGutter: "stable both-edges" }}>
      {/* Each A4 sheet prints as one physical A4 page (single OR multi-invoice); the screen-only
          scaling/scrolling is reset for print. */}
      <style>{`
        /* Visible side scroll bar for the multi-page stack (WebView hides the overlay one).
           scrollbar-gutter: stable both-edges on the frame reserves the same strip on BOTH sides,
           so the page keeps an equal gap left and right. Without it the bar ate into the right
           margin only, and a multi-page invoice sat visibly off-centre (27px left, 48px right)
           while a single-page one — which has no bar — looked fine. */
        .a4-frame::-webkit-scrollbar { width: 8px; }
        .a4-frame::-webkit-scrollbar-track { background: transparent; }
        .a4-frame::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.28); border-radius: 4px; }
        .a4-frame::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.42); }
        .a4-frame { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.28) transparent; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
          .a4-frame { position: static !important; overflow: visible !important; background: #fff !important; }
          .a4-measure { display: none !important; }
          .a4-stack { display: block !important; gap: 0 !important; padding: 0 !important; }
          .a4-page-outer { width: 794px !important; height: 1123px !important; }
          .a4-sheet { transform: none !important; box-shadow: none !important; border: none !important; page-break-after: always; break-after: page; }
          .a4-sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      {/* Off-screen measuring copies (natural height) — never shown. */}
      <div ref={withTotalsRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideStamp hideSignature labels={labels} dir={dir} />
      </div>
      <div ref={noTotalsRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideSummary labels={labels} dir={dir} />
      </div>
      <div ref={footerMeasureRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        {/* Band only — the "Page X of Y" line lives inside FOOTER_BOTTOM_MARGIN, so it must NOT add
            to the measured footer height (else multi-page invoices reserve extra space for it). */}
        <InvoiceFooter qrDataUrl={qrDataUrl} labels={labels} />
      </div>

      {(() => {
        const stack = (
          <div
            className="a4-stack"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 22 * s,
              padding: `${PAGE_INSET_Y}px ${PAGE_MARGIN}px`,
              visibility: scale ? "visible" : "hidden",
            }}
          >
            {pages.map((pg, i) => {
              const pageData = { ...data, items: data.items.slice(pg.start, pg.start + pg.count) };
              return (
                // Outer box carries the SCALED footprint so pages stack cleanly (transform ≠ layout).
                // The shadow (on the outer, unscaled footprint) gives each page a PDF-viewer look.
                <div key={i} className="a4-page-outer" style={{ width: SHEET_W * s, height: SHEET_H * s, flex: "none", boxShadow: "0 3px 16px rgba(0,0,0,0.18)" }}>
                  <div
                    className="a4-sheet"
                    ref={pg.summary ? summarySheetRef : undefined}
                    // Tapping anywhere on the sheet OTHER than a selected overlay deselects it. A
                    // selected overlay stopPropagations its own pointerdown, so this doesn't fire for it.
                    onPointerDown={draggableStamp && pg.summary ? () => setSelectedOverlay(null) : undefined}
                    style={{
                      width: SHEET_W,
                      height: SHEET_H,
                      background: "#fff",
                      overflow: "hidden",
                      position: "relative",
                      transform: `scale(${s})`,
                      transformOrigin: "top left",
                    }}
                  >
                    {/* This page's invoice — totals only on the summary (last) page. The wrapper is
                        bounded to the area above the footer (SHEET_H − footerH) and is a flex column,
                        so InvoiceDocument's mt-auto trailing block anchors to just above the footer. */}
                    <div style={{ position: "absolute", top: 0, left: 0, width: SHEET_W, height: SHEET_H - footerH - FOOTER_BOTTOM_MARGIN, display: "flex", flexDirection: "column" }}>
                      {/* Every page uses the native min-9 table (Math.max(9, items)): a page with ≥9
                          items shows exactly that many (no blanks); a page with fewer pads up to 9. */}
                      <InvoiceDocument data={pageData} qrDataUrl={qrDataUrl} hideFooter hideSummary={!pg.summary} hideStamp hideSignature padRows={pg.summary ? summaryRows : undefined} labels={labels} dir={dir} />
                    </div>
                    {/* Footer band pinned FOOTER_BOTTOM_MARGIN above the sheet's bottom edge (equal to
                        its 32px side inset). No pageLabel here — it sits in the margin below. */}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: FOOTER_BOTTOM_MARGIN, background: "#fff", paddingLeft: 32, paddingRight: 32 }}>
                      <InvoiceFooter qrDataUrl={qrDataUrl} labels={labels} />
                    </div>
                    {/* "Page X of Y" printed INSIDE the bottom margin (centred in the FOOTER_BOTTOM_MARGIN
                        gap between the band and the sheet edge) — so multi-page invoices reserve no
                        extra space for it. */}
                    {multi && (
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: (FOOTER_BOTTOM_MARGIN - 13) / 2, textAlign: "center", fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>
                        Page {i + 1} of {pages.length}
                      </div>
                    )}
                    {/* Draggable signature + stamp overlays — only on the summary (last) page. Each
                        lives inside the scaled sheet, so drag deltas are divided by the scale. Both
                        use select-then-drag (native parity) so unselected they never block zoom/pan. */}
                    {signatureUrl && !signatureRemoved && pg.summary && (
                      draggableStamp ? (
                        <DraggableOverlay
                          url={signatureUrl}
                          alt="Signature"
                          size={sigSizePx}
                          frac={sigFrac}
                          selected={selectedOverlay === "signature"}
                          scale={s}
                          sheetW={SHEET_W}
                          sheetH={SHEET_H}
                          onSelect={() => setSelectedOverlay("signature")}
                          onCommit={(x, y) => { setSigFrac({ x, y }); onSignatureMove?.(x, y); }}
                          onRemove={() => { setSignatureRemoved(true); setSelectedOverlay(null); onSignatureRemove?.(); }}
                        />
                      ) : (
                        <StaticOverlay url={signatureUrl} alt="Signature" size={sigSizePx} frac={sigFrac} sheetW={SHEET_W} sheetH={SHEET_H} />
                      )
                    )}
                    {/* Company stamp — draggable in the app WebView, static (same saved position) elsewhere. */}
                    {stampUrl && !stampRemoved && pg.summary && (
                      draggableStamp ? (
                        <DraggableOverlay
                          url={stampUrl}
                          alt="Stamp"
                          size={stampSizePx}
                          frac={stampFrac}
                          selected={selectedOverlay === "stamp"}
                          scale={s}
                          sheetW={SHEET_W}
                          sheetH={SHEET_H}
                          onSelect={() => setSelectedOverlay("stamp")}
                          onCommit={(x, y) => { setStampFrac({ x, y }); onStampMove?.(x, y); }}
                          onRemove={() => { setStampRemoved(true); setSelectedOverlay(null); onStampRemove?.(); }}
                        />
                      ) : (
                        <StaticOverlay url={stampUrl} alt="Stamp" size={stampSizePx} frac={stampFrac} sheetW={SHEET_W} sheetH={SHEET_H} />
                      )
                    )}
                    {/* Auto PAID / PARTIALLY-PAID stamp — SEPARATE from the company stamp, pinned to the
                        totals box (paymentStampFrac). Display-only: it tracks payment status, so it's
                        not draggable. */}
                    {paymentStampUrl && pg.summary && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={paymentStampUrl}
                        alt="Payment stamp"
                        draggable={false}
                        style={{
                          position: "absolute",
                          left: paymentStampFrac.x * SHEET_W,
                          top: paymentStampFrac.y * SHEET_H,
                          width: 0.189 * SHEET_W,
                          height: 0.189 * SHEET_W,
                          objectFit: "contain",
                          pointerEvents: "none",
                          userSelect: "none",
                          zIndex: 15,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
        if (!zoomable) return stack;
        // Pinch/pan/double-tap/wheel zoom scoped to the invoice only (the shared page's header +
        // Approve/Reject/Install footer stay put), like the old image viewer.
        return (
          <TransformWrapper
            minScale={1}
            maxScale={5}
            initialScale={1}
            limitToBounds
            centerOnInit={false}
            doubleClick={{ mode: "zoomIn", step: 0.9, animationTime: 200 }}
            wheel={{ step: 0.15 }}
            pinch={{ step: 6 }}
            panning={{ velocityDisabled: false }}
          >
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%" }}>
              {stack}
            </TransformComponent>
          </TransformWrapper>
        );
      })()}
    </div>
    {/* Page indicator — "N / total" pill, pinned bottom-right, only for multi-page. Updates as the
        user scrolls through the stacked pages. */}
    {multi && (
      <div
        style={{
          position: "absolute", right: 12, bottom: 12, zIndex: 30, pointerEvents: "none",
          background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 13, fontWeight: 700,
          padding: "4px 12px", borderRadius: 999, fontFamily: "var(--font-nunito), sans-serif",
        }}
      >
        {currentPage} / {pages.length}
      </div>
    )}
    </div>
  );
}
