"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { InvoiceDocument, InvoiceFooter } from "./InvoiceDocument";
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

export function A4PagedFrame({
  data,
  qrDataUrl,
  zoomable,
  draggableStamp,
  onStampMove,
}: {
  data: InvoiceRenderData;
  qrDataUrl?: string | null;
  zoomable?: boolean;
  // When true the stamp becomes a draggable overlay (app editing WebView, not the receiver view).
  draggableStamp?: boolean;
  // Reports the stamp's new position as fractions of the sheet (0..1) so the app can persist it.
  onStampMove?: (xFrac: number, yFrac: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const withTotalsRef = useRef<HTMLDivElement>(null);
  const noTotalsRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([{ start: 0, count: 0, summary: true }]);

  // Draggable stamp: position as a fraction of the sheet. Default sits INSIDE the summary/totals box,
  // in the empty gap just after the row labels (a few dp right of where "SHIPPING" ends, ~0.676) and
  // over the SUB TOTAL→SHIPPING rows — an outline stamp that reads over blank space, above TOTAL.
  const stampUrl = draggableStamp ? imageProxyUrl(data.stampImage) : null;
  const [stampFrac, setStampFrac] = useState({ x: 0.685, y: 0.5 });
  // Native parity (SharedComponents.kt): the stamp must be SELECTED (single tap → light dashed
  // container) before it can be dragged. While unselected it never grabs the pointer, so a finger
  // landing on it during a pinch passes straight through to zoom/pan.
  const [stampSelected, setStampSelected] = useState(false);
  const dragRef = useRef<{ px: number; py: number } | null>(null);
  const downRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

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
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideStamp={draggableStamp} />
      </div>
      <div ref={noTotalsRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideSummary />
      </div>
      <div ref={footerMeasureRef} className="a4-measure" style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel="Page 1 of 1" />
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
                    // Tapping anywhere on the sheet OTHER than the (selected) stamp deselects it. The
                    // selected stamp stopPropagations its own pointerdown, so this doesn't fire for it.
                    onPointerDown={draggableStamp && pg.summary ? () => setStampSelected(false) : undefined}
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
                      <InvoiceDocument data={pageData} qrDataUrl={qrDataUrl} hideFooter hideSummary={!pg.summary} hideStamp={draggableStamp} />
                    </div>
                    {/* Footer + pagination pinned to the page bottom (32px sides match body px-8). */}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", paddingLeft: 32, paddingRight: 32 }}>
                      <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel={multi ? `Page ${i + 1} of ${pages.length}` : undefined} />
                    </div>
                    {/* Draggable stamp overlay — only on the summary (last) page. Lives inside the
                        scaled sheet, so screen drag deltas are divided by the scale to get sheet px.
                        Select-first, then drag (native parity): unselected it stays inert so zoom/pan
                        work with a finger on it; a single tap selects it (light dashed container). */}
                    {draggableStamp && stampUrl && pg.summary && (
                      <div
                        onPointerDown={(e) => {
                          downRef.current = { x: e.clientX, y: e.clientY, moved: false };
                          // Only a SELECTED stamp captures the pointer to drag — and only then do we
                          // stop the event so the host (WebView pinch/pan) is left alone otherwise.
                          if (stampSelected) {
                            e.stopPropagation();
                            dragRef.current = { px: e.clientX, py: e.clientY };
                            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* no active pointer */ }
                          }
                        }}
                        onPointerMove={(e) => {
                          if (downRef.current) {
                            if (Math.hypot(e.clientX - downRef.current.x, e.clientY - downRef.current.y) > 6) downRef.current.moved = true;
                          }
                          if (!dragRef.current || !scale) return;
                          const dxFrac = (e.clientX - dragRef.current.px) / scale / SHEET_W;
                          const dyFrac = (e.clientY - dragRef.current.py) / scale / SHEET_H;
                          dragRef.current = { px: e.clientX, py: e.clientY };
                          setStampFrac((p) => ({
                            x: Math.min(0.96, Math.max(0, p.x + dxFrac)),
                            y: Math.min(0.96, Math.max(0, p.y + dyFrac)),
                          }));
                        }}
                        onPointerUp={(e) => {
                          const wasDragging = dragRef.current != null;
                          const tap = downRef.current != null && !downRef.current.moved;
                          dragRef.current = null;
                          downRef.current = null;
                          try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
                          if (wasDragging) {
                            onStampMove?.(stampFrac.x, stampFrac.y);
                          } else if (tap && !stampSelected) {
                            setStampSelected(true); // first tap selects → light container appears
                          }
                        }}
                        style={{
                          position: "absolute",
                          left: stampFrac.x * SHEET_W,
                          top: stampFrac.y * SHEET_H,
                          width: 150,
                          height: 150,
                          zIndex: 20,
                          cursor: stampSelected ? "grab" : "pointer",
                          // Selected → we own the gesture (drag). Unselected → let the host zoom/pan.
                          touchAction: stampSelected ? "none" : "auto",
                          // Light dashed selection container (mirrors native drawSelectionUI).
                          border: stampSelected ? "1.5px dashed rgba(37,99,235,0.85)" : undefined,
                          background: stampSelected ? "rgba(37,99,235,0.10)" : undefined,
                          borderRadius: stampSelected ? 4 : undefined,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={stampUrl} alt="Stamp" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" }} />
                        {stampSelected &&
                          ([[-4, -4], [-4, undefined], [undefined, -4], [undefined, undefined]] as const).map((c, ci) => (
                            <span key={ci} style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "rgba(37,99,235,1)", border: "1.5px solid #fff", left: c[0] === undefined ? undefined : c[0], right: c[0] === undefined ? -4 : undefined, top: c[1] === undefined ? undefined : c[1], bottom: c[1] === undefined ? -4 : undefined }} />
                          ))}
                      </div>
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
