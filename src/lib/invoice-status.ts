import type { InvoiceStatus } from "./types";

/**
 * An invoice's status as the app computes it, and the money figures built on it: the app's rule, so
 * the web and the phone show the same numbers for the same book.
 *
 * Status — the app's InvoiceStatusRule (`calculatedStatus`):
 * - DRAFT and CANCELLED are decisions a person made, so they are read off the row.
 * - Everything else follows from payments and the calendar, because nothing rewrites a stored
 *   status when a due date passes. Fully paid → PAID; else past the due date → OVERDUE; else part
 *   paid → PARTIAL; else SENT. Paid outranks late, and late outranks part-paid.
 * - Overdue starts the day AFTER the due date, compared as calendar days in the viewer's timezone.
 *
 * Totals — the app's InvoiceListViewModel (`calculateSummary`): a DRAFT is not money anybody owes and
 * a CANCELLED invoice is money nobody owes any more, so neither counts anywhere.
 * - Revenue: the totals of the rest. Collected: what was paid against them.
 * - Outstanding: what is still owed on those not fully paid. Overdue: what is still owed on the
 *   overdue ones. Revenue = Collected + Outstanding.
 *
 * One difference from the app remains: the app converts a mix of currencies into one before adding
 * them up, and the web adds the amounts as they are, as it did before.
 */
export type StatusNow = InvoiceStatus | "PARTIAL";

export interface MoneyRow {
  status: string;
  totalAmount: string | number;
  /** What was paid against this invoice: the sum of its invoice payments. Absent means nothing. */
  paidAmount?: number | null;
  /** YYYY-MM-DD. */
  dueDate?: string | null;
}

const num = (v: string | number | null | undefined): number => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

/** A date as YYYY-MM-DD in this runtime's timezone — in a browser, the viewer's own. */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The status an invoice is actually in on `today` (YYYY-MM-DD). */
export function statusNow(inv: MoneyRow, today: string): StatusNow {
  const stored = (inv.status || "").toUpperCase();
  if (stored === "DRAFT") return "DRAFT";
  if (stored === "CANCELLED") return "CANCELLED";

  const total = num(inv.totalAmount);
  const paid = num(inv.paidAmount);
  const due = (inv.dueDate ?? "").slice(0, 10);

  if (paid >= total && total > 0) return "PAID";
  if (due && today > due) return "OVERDUE";
  if (paid > 0) return "PARTIAL";
  return "SENT";
}

export interface MoneySummary {
  revenue: number;
  collected: number;
  outstanding: number;
  overdue: number;
  /** How many invoices are in each status, as computed. */
  counts: Record<string, number>;
}

export function summarizeInvoices(rows: readonly MoneyRow[], today: string): MoneySummary {
  let revenue = 0;
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  const counts: Record<string, number> = {};
  for (const inv of rows) {
    const st = statusNow(inv, today);
    counts[st] = (counts[st] ?? 0) + 1;
    if (st === "DRAFT" || st === "CANCELLED") continue;
    const total = num(inv.totalAmount);
    const paid = num(inv.paidAmount);
    revenue += total;
    collected += paid;
    if (st !== "PAID") outstanding += total - paid;
    if (st === "OVERDUE") overdue += total - paid;
  }
  return { revenue, collected, outstanding, overdue, counts };
}
