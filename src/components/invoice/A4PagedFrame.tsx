"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
const FIT_FACTOR = 0.92;

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

  return (
    <div
      ref={elRef}
      onPointerDown={(e) => {
        drag.current = { sx: e.clientX, sy: e.clientY, fx: frac.x, fy: frac.y, cx: frac.x, cy: frac.y, moved: false };
        // Only a SELECTED overlay grabs the pointer to drag; unselected we leave the event alone so
        // the host (WebView pinch, or react-zoom-pan-pinch) still gets both fingers for a pinch.
        if (selected) {
          e.stopPropagation();
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* no active pointer */ }
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
        if (!selected || !scale) return;
        d.cx = Math.min(0.96, Math.max(0, d.fx + (e.clientX - d.sx) / scale / sheetW));
        d.cy = Math.min(0.96, Math.max(0, d.fy + (e.clientY - d.sy) / scale / sheetH));
        const el = elRef.current;
        if (el) { el.style.left = `${d.cx * sheetW}px`; el.style.top = `${d.cy * sheetH}px`; }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
        if (!d) return;
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
        // Selected → we own the gesture (drag). Unselected → let the host zoom/pan.
        touchAction: selected ? "none" : "auto",
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

export function A4PagedFrame({
  data,
  qrDataUrl,
  zoomable,
  draggableStamp,
  onStampMove,
  onSignatureMove,
  onStampRemove,
  onSignatureRemove,
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
  // Localised invoice labels + reading direction (shared invoice → receiver's language).
  labels?: InvoiceLabels;
  dir?: "ltr" | "rtl";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const withTotalsRef = useRef<HTMLDivElement>(null);
  const noTotalsRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([{ start: 0, count: 0, summary: true }]);

  // Draggable overlays (stamp + signature) — positions as fractions of the sheet. Native parity
  // (SharedComponents.kt): an overlay must be SELECTED (single tap → light dashed container) before it
  // can be dragged; while unselected it never grabs the pointer, so a finger landing on it during a
  // pinch passes straight through to zoom/pan. Only ONE overlay is selected at a time.
  const stampUrl = draggableStamp ? imageProxyUrl(data.stampImage) : null;
  const signatureUrl = draggableStamp ? imageProxyUrl(data.signatureImage) : null;
  // Stamp default: inside the totals box, ~1.5dp right of where "SHIPPING" ends (0.676), over the
  // SUB TOTAL→SHIPPING rows. Signature default: the empty area to the LEFT of the totals box (native
  // places the signature to the left of the stamp).
  const [stampFrac, setStampFrac] = useState({ x: 0.68, y: 0.521 });
  const [sigFrac, setSigFrac] = useState({ x: 0.09, y: 0.6 });
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

      const footerH = footerMeasureRef.current?.offsetHeight ?? 100;
      const usableH = SHEET_H - footerH - 10;

      const rowH = (withT.querySelector("tbody tr") as HTMLElement | null)?.offsetHeight ?? 28;
      const renderedRows = Math.max(9, totalItems);
      // Chrome = everything except the item rows. "With" includes the totals box; "No" excludes it.
      const chromeWith = withT.scrollHeight - renderedRows * rowH;
      const chromeNo = noT.scrollHeight - renderedRows * rowH;
      const nWith = Math.max(1, Math.floor((usableH - chromeWith) / rowH));
      const nNo = Math.max(nWith, Math.floor((usableH - chromeNo) / rowH));

      const pg = paginate(totalItems, nNo, nWith);
      setPages(pg);

      const s = (pg.length > 1 ? cw / SHEET_W : Math.min(cw / SHEET_W, ch / SHEET_H)) * FIT_FACTOR;
      if (s > 0 && isFinite(s)) setScale(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (withTotalsRef.current) ro.observe(withTotalsRef.current);
    return () => ro.disconnect();
  }, [data, qrDataUrl, totalItems]);

  const s = scale ?? 0;
  const multi = pages.length > 1;

  return (
    <div ref={containerRef} className="a4-frame" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: zoomable ? "hidden" : "auto", background: "#e9e9ec", touchAction: zoomable ? "none" : undefined }}>
      {/* Each A4 sheet prints as one physical A4 page (single OR multi-invoice); the screen-only
          scaling/scrolling is reset for print. */}
      <style>{`
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
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideStamp={draggableStamp} hideSignature={draggableStamp} labels={labels} dir={dir} />
      </div>
      <div ref={noTotalsRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideSummary labels={labels} dir={dir} />
      </div>
      <div ref={footerMeasureRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel="Page 1 of 1" labels={labels} />
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
              padding: `${22 * s}px 0`,
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
                    {/* This page's invoice — totals only on the summary (last) page. */}
                    <div style={{ position: "absolute", top: 0, left: 0, width: SHEET_W }}>
                      {/* Every page uses the native min-9 table (Math.max(9, items)): a page with ≥9
                          items shows exactly that many (no blanks); a page with fewer pads up to 9. */}
                      <InvoiceDocument data={pageData} qrDataUrl={qrDataUrl} hideFooter hideSummary={!pg.summary} hideStamp={draggableStamp} hideSignature={draggableStamp} labels={labels} dir={dir} />
                    </div>
                    {/* Footer + pagination pinned to the page bottom (32px sides match body px-8). */}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", paddingLeft: 32, paddingRight: 32 }}>
                      <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel={multi ? `Page ${i + 1} of ${pages.length}` : undefined} labels={labels} />
                    </div>
                    {/* Draggable signature + stamp overlays — only on the summary (last) page. Each
                        lives inside the scaled sheet, so drag deltas are divided by the scale. Both
                        use select-then-drag (native parity) so unselected they never block zoom/pan. */}
                    {draggableStamp && signatureUrl && !signatureRemoved && pg.summary && (
                      <DraggableOverlay
                        url={signatureUrl}
                        alt="Signature"
                        size={150}
                        frac={sigFrac}
                        selected={selectedOverlay === "signature"}
                        scale={s}
                        sheetW={SHEET_W}
                        sheetH={SHEET_H}
                        onSelect={() => setSelectedOverlay("signature")}
                        onCommit={(x, y) => { setSigFrac({ x, y }); onSignatureMove?.(x, y); }}
                        onRemove={() => { setSignatureRemoved(true); setSelectedOverlay(null); onSignatureRemove?.(); }}
                      />
                    )}
                    {draggableStamp && stampUrl && !stampRemoved && pg.summary && (
                      <DraggableOverlay
                        url={stampUrl}
                        alt="Stamp"
                        size={150}
                        frac={stampFrac}
                        selected={selectedOverlay === "stamp"}
                        scale={s}
                        sheetW={SHEET_W}
                        sheetH={SHEET_H}
                        onSelect={() => setSelectedOverlay("stamp")}
                        onCommit={(x, y) => { setStampFrac({ x, y }); onStampMove?.(x, y); }}
                        onRemove={() => { setStampRemoved(true); setSelectedOverlay(null); onStampRemove?.(); }}
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
  );
}
