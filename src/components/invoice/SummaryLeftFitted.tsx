"use client";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import type { InvoiceRenderData } from "@/lib/data";
import type { InvoiceLabels } from "@/lib/invoice-labels";

/**
 * Payment Instructions + Terms & Conditions, rendered in the empty space to the LEFT of the totals
 * box and BOUND to that box's height. The block is capped to the totals height and its text is
 * auto-scaled (font-size) to fit, so however long the payment/terms text is it stays inside the same
 * band as the totals — it never grows the summary taller than the totals and therefore never pushes
 * the invoice onto an extra page. The two fields each get their own container with proportional
 * spacing between them; everything scales together with the available height.
 *
 * Isolated as a "use client" component because InvoiceDocument is also rendered in server components
 * (invoices/[id], i/[token]); the measure-and-fit runs on the client (offline WebView + web) and is a
 * no-op on the server (renders at natural size, then fits on hydration).
 */
export function SummaryLeftFitted({ data, labels }: { data: InvoiceRenderData; labels: InvoiceLabels }) {
  const t = data.toggles;
  const showPayment = !!(t.payment && data.paymentInstructions);
  const showTerms = !!(t.terms && data.terms);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [targetH, setTargetH] = useState<number | undefined>(undefined);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;

    const fit = () => {
      const totals = root.parentElement?.querySelector("[data-totals]") as HTMLElement | null;
      const h = totals ? totals.offsetHeight : 0;
      if (h <= 0) return;
      // Measure the natural (unscaled) content height, then compute the largest scale that fits the
      // totals height. Clamp so text never becomes unreadably small.
      content.style.setProperty("--fit", "1");
      const natural = content.scrollHeight;
      const s = natural > h ? Math.max(0.5, h / natural) : 1;
      content.style.setProperty("--fit", String(s));
      setScale((prev) => (Math.abs(prev - s) > 0.001 ? s : prev));
      setTargetH((prev) => (prev !== h ? h : prev));
    };

    fit();
    // Re-fit if the totals box changes height (theme/currency/data) or fonts finish loading.
    const totals = root.parentElement?.querySelector("[data-totals]") as HTMLElement | null;
    const ro = new ResizeObserver(() => fit());
    if (totals) ro.observe(totals);
    return () => ro.disconnect();
  }, [data.paymentInstructions, data.terms, showPayment, showTerms]);

  if (!showPayment && !showTerms) return <div className="w-1/2" aria-hidden />;

  return (
    <div ref={rootRef} className="w-1/2" style={{ height: targetH }}>
      <div
        ref={contentRef}
        style={{
          // CSS custom property drives every size below so one number scales the whole block.
          "--fit": scale,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: "calc(14px * var(--fit))",
          // Breathing room so the "Payment Instructions" heading doesn't sit flush against the table
          // above it. Scales with --fit so the fit math stays exact (padding + content = totals height).
          paddingTop: "calc(12px * var(--fit))",
        } as CSSProperties}
      >
        {showPayment && (
          <div>
            <p className="font-extrabold text-[#1c1b1f]" style={{ fontSize: "calc(16px * var(--fit))", lineHeight: 1.2 }}>
              {labels.paymentInstructions}
            </p>
            <p className="whitespace-pre-line break-words" style={{ fontSize: "calc(14px * var(--fit))", lineHeight: 1.4, marginTop: "calc(4px * var(--fit))" }}>
              {data.paymentInstructions}
            </p>
          </div>
        )}
        {showTerms && (
          <div>
            <p className="font-extrabold text-[#1c1b1f]" style={{ fontSize: "calc(16px * var(--fit))", lineHeight: 1.2 }}>
              {labels.terms}
            </p>
            <p className="whitespace-pre-line break-words" style={{ fontSize: "calc(14px * var(--fit))", lineHeight: 1.4, marginTop: "calc(4px * var(--fit))" }}>
              {data.terms}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
