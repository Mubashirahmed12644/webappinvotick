"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CURRENCIES } from "@/lib/free-invoice/types";

// A4 at 96dpi. The paper renders at this fixed width (so the preview and the
// exported PDF look identical) and is scaled down to fit narrow columns.
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

export function A4Preview({ currency, onCurrencyChange, children }: { currency: string; onCurrencyChange?: (v: string) => void; children: ReactNode }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [boxHeight, setBoxHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const holder = holderRef.current;
    const paper = paperRef.current;
    if (!holder || !paper) return;
    const update = () => {
      const s = Math.min(1, holder.clientWidth / A4_WIDTH);
      setScale(s);
      setBoxHeight(paper.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(holder);
    ro.observe(paper);
    return () => ro.disconnect();
  });

  return (
    <div ref={holderRef} className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-container)] py-1 pl-3 pr-2 text-xs font-bold text-[var(--color-on-primary-container)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
          A4 ·
          {onCurrencyChange ? (
            <span className="relative inline-flex items-center" title="Change currency — applies to the whole invoice">
              <select
                value={currency}
                aria-label="Invoice currency"
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="cursor-pointer appearance-none rounded bg-transparent pr-4 text-xs font-bold text-[var(--color-on-primary-container)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-0 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
            </span>
          ) : (
            currency
          )}
        </span>
        <span className="text-xs font-medium text-[var(--color-on-surface-variant)]">Live preview · currency applies to all items</span>
      </div>
      {/* The paper renders at a fixed 794px and is scaled with transform, which
          keeps its original layout footprint — clip it so it never overflows. */}
      <div className="w-full overflow-hidden" style={{ height: boxHeight }}>
        <div
          ref={paperRef}
          id="fi-paper"
          className="flex origin-top-left flex-col overflow-hidden rounded-[var(--radius-md)] bg-white shadow-xl ring-1 ring-black/5"
          style={{ width: A4_WIDTH, minHeight: A4_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
