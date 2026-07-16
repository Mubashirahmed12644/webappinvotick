"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { InvoiceDocument, InvoiceFooter } from "./InvoiceDocument";
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

export function A4PagedFrame({ data, qrDataUrl }: { data: InvoiceRenderData; qrDataUrl?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const withTotalsRef = useRef<HTMLDivElement>(null);
  const noTotalsRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([{ start: 0, count: 0, summary: true }]);

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
    <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "auto", background: "#f7f7f7" }}>
      {/* Off-screen measuring copies (natural height) — never shown. */}
      <div ref={withTotalsRef} style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter />
      </div>
      <div ref={noTotalsRef} style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} hideFooter hideSummary />
      </div>
      <div ref={footerMeasureRef} style={{ position: "absolute", left: -99999, top: 0, width: SHEET_W, visibility: "hidden", pointerEvents: "none" }} aria-hidden>
        <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel="Page 1 of 1" />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12 * s,
          padding: `${12 * s}px 0`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {pages.map((pg, i) => {
          const pageData = { ...data, items: data.items.slice(pg.start, pg.start + pg.count) };
          return (
            // Outer box carries the SCALED footprint so pages stack cleanly (transform ≠ layout).
            <div key={i} style={{ width: SHEET_W * s, height: SHEET_H * s, flex: "none" }}>
              <div
                style={{
                  width: SHEET_W,
                  height: SHEET_H,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.10)",
                  overflow: "hidden",
                  position: "relative",
                  transform: `scale(${s})`,
                  transformOrigin: "top left",
                }}
              >
                {/* This page's invoice — totals only on the summary (last) page. */}
                <div style={{ position: "absolute", top: 0, left: 0, width: SHEET_W }}>
                  {/* Every page uses the native min-9 table (Math.max(9, items)): a page with ≥9
                      items shows exactly that many (no blanks); a page with fewer pads up to 9
                      (e.g. 2 items → 2 + 7 blank rows). No filling to the page capacity. */}
                  <InvoiceDocument data={pageData} qrDataUrl={qrDataUrl} hideFooter hideSummary={!pg.summary} />
                </div>
                {/* Footer + pagination pinned to the page bottom. 32px side padding matches the
                    body's px-8 so the footer band aligns with the invoice content width. */}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", paddingLeft: 32, paddingRight: 32 }}>
                  <InvoiceFooter qrDataUrl={qrDataUrl} pageLabel={multi ? `Page ${i + 1} of ${pages.length}` : undefined} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
