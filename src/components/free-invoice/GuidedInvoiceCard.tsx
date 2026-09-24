"use client";

import { formatDate, formatMoney } from "@/lib/format";
import { initialsFor } from "@/lib/free-invoice/logo-mark";
import type { FreeInvoice } from "@/lib/free-invoice/types";

/**
 * The invoice the guided flow is building, drawn small and live (decision 0165).
 *
 * ## It is a picture of the draft, not the renderer
 *
 * Same rule as `InvoiceGlimpse`, and for the same reason: `InvoiceDocument` is the invariant shared
 * with the app's offline bundle (AGENTS.md §4.1), and a tweak made for a landing-page card must not
 * be able to change what the app prints. This shows the fields that exist so far; the **real**
 * render is the A4 paper the full editor and the PDF both use, which is what the person gets when
 * they download.
 *
 * ## Why it cannot break on a phone
 *
 * Everything is sized in `cqw` — hundredths of this card's own width — so it is one drawing that
 * scales rather than a layout that can run out of room. Reading it at 320 px and at 1280 px is the
 * same picture at two sizes.
 *
 * The one thing that is NOT decoration is the money, and it is treated as money: the total and the
 * names wrap rather than being cut, because `LAYOUT_RULES.md`'s rule holds harder here than in the
 * app — nobody would think to check a number they are only being shown.
 *
 * It is `aria-hidden`: every value in it is already in a labelled form field beside it, and a
 * screen-reader user being read the same invoice twice on every keystroke is worse than not being
 * read the decoration at all.
 */
export function GuidedInvoiceCard({ inv, total }: { inv: FreeInvoice; total: number }) {
  const initials = initialsFor(inv.businessName);
  const brand = inv.color || "#1F4FD8";

  return (
    <div
      aria-hidden="true"
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] bg-white shadow-[0_10px_30px_-14px_rgba(0,26,72,0.45)] ring-1 ring-black/5"
      style={{ containerType: "inline-size" }}
    >
      {/* Header band — the brand colour, the way the app's own "simple" template prints it. */}
      <div className="flex items-center justify-between" style={{ background: brand, padding: "4cqw 5cqw", gap: "3cqw" }}>
        <div className="flex min-w-0 items-center" style={{ gap: "2.5cqw" }}>
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/20 font-extrabold text-white"
            style={{ width: "9cqw", height: "9cqw", fontSize: initials.length > 1 ? "3.6cqw" : "4.6cqw" }}
          >
            {inv.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inv.logoDataUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              initials
            )}
          </div>
          {/* Wraps, never truncates. A business name cut to "Northgate Coffee C" on the card that
              is meant to show the person their own invoice reads as our mistake with their name. */}
          <div className="min-w-0 font-bold text-white" style={{ fontSize: "3.6cqw", lineHeight: 1.25, overflowWrap: "anywhere" }}>
            {inv.businessName || <span className="text-white/55">Your business</span>}
          </div>
        </div>
        <div className="shrink-0 font-extrabold tracking-[0.18em] text-white" style={{ fontSize: "4.2cqw" }}>
          INVOICE
        </div>
      </div>

      <div style={{ padding: "4cqw 5cqw" }}>
        <div className="flex items-start justify-between" style={{ gap: "4cqw" }}>
          <div className="min-w-0">
            <Label>Billed to</Label>
            <div
              className="font-bold text-[#1c1b1f]"
              style={{ fontSize: "3.2cqw", lineHeight: 1.35, overflowWrap: "anywhere" }}
            >
              {inv.clientName || <span className="font-semibold text-[#b6b2bf]">—</span>}
            </div>
          </div>
          <div className="shrink-0 text-end">
            <Label>Due</Label>
            <div className="font-bold text-[#1c1b1f]" style={{ fontSize: "3.2cqw", lineHeight: 1.35 }}>
              {inv.dueDate ? formatDate(inv.dueDate) : "—"}
            </div>
          </div>
        </div>

        {/* The lines that carry anything. An empty draft shows one dashed placeholder row rather
            than nothing, so the shape of what is coming is visible from the first screen. */}
        <div style={{ marginTop: "3.5cqw" }}>
          {inv.items.filter((it) => it.description.trim() || it.rate.trim()).length === 0 ? (
            <div
              className="rounded-md border border-dashed border-[#e2dfe9]"
              style={{ height: "7cqw" }}
            />
          ) : (
            inv.items
              .filter((it) => it.description.trim() || it.rate.trim())
              .slice(0, 4)
              .map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between border-b border-[#efedf3]"
                  style={{ gap: "3cqw", paddingBlock: "2cqw" }}
                >
                  <span className="min-w-0 flex-1 truncate text-[#3f3b47]" style={{ fontSize: "2.8cqw" }}>
                    {it.description || "—"}
                  </span>
                  <span className="shrink-0 font-bold text-[#1c1b1f]" style={{ fontSize: "2.8cqw" }}>
                    {formatMoney((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), inv.currency)}
                  </span>
                </div>
              ))
          )}
        </div>

        {/* Balance due — the figure wraps under its label rather than shrinking, at every width. */}
        <div
          className="mt-[3cqw] flex flex-wrap items-baseline justify-between rounded-md bg-[var(--color-primary-container)]"
          style={{ gap: "1cqw 3cqw", padding: "2.4cqw 3cqw" }}
        >
          <span className="font-bold uppercase tracking-wide text-[var(--color-on-primary-container)]" style={{ fontSize: "2.6cqw" }}>
            Balance due
          </span>
          <span className="font-extrabold tabular-nums text-[var(--color-on-primary-container)]" style={{ fontSize: "4.2cqw" }}>
            {formatMoney(total, inv.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div
      className="font-bold uppercase tracking-[0.16em] text-[#9a96a3]"
      style={{ fontSize: "2.2cqw", marginBottom: "1cqw" }}
    >
      {children}
    </div>
  );
}
