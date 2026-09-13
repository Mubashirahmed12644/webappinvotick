import { countsAsMoney, summarizeInvoices, type MoneyRow, type StatusNow } from "./invoice-status";

/**
 * The dashboard's figures, by the invoice list's rule (invoice-status.ts, decision 0084). A DRAFT or a
 * CANCELLED invoice counts in no figure. A status comes from payments and the due date, never from
 * the row.
 *
 * This lives apart from dashboard.ts, which is server-only, because the browser works these figures
 * out again on the viewer's own date.
 */
export interface DashboardMetrics {
  totalRevenue: number;
  outstanding: number;
  totalInvoices: number;
  overdueAmount: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalExpenses: number;
  netIncome: number;
}

/**
 * - Revenue, Outstanding and Overdue are the invoice list's own figures for these invoices on `today`.
 * - Invoices, Paid, Unpaid and Overdue count real invoices only. Paid means paid in full. Unpaid means
 *   owed and not late (SENT or PARTIAL). Overdue means late. A draft or a cancelled invoice is in none
 *   of them, so Paid + Unpaid + Overdue always add up to Invoices (owner, 2026-09-14: "Sirf asal
 *   invoices").
 */
export function dashboardMetrics(invoices: readonly MoneyRow[], today: string, totalExpenses: number): DashboardMetrics {
  const s = summarizeInvoices(invoices, today);
  const count = (st: StatusNow) => s.counts[st] ?? 0;
  return {
    totalRevenue: s.revenue,
    outstanding: s.outstanding,
    totalInvoices: invoices.filter(countsAsMoney).length,
    overdueAmount: s.overdue,
    paidInvoices: count("PAID"),
    unpaidInvoices: count("SENT") + count("PARTIAL"),
    overdueInvoices: count("OVERDUE"),
    totalExpenses,
    netIncome: s.revenue - totalExpenses,
  };
}

/** A Recent Activity invoice's badge. A draft or a cancelled invoice has none, so it is never "Overdue". */
export function invoiceBadge(status: StatusNow): string | null {
  switch (status) {
    case "PAID":
      return "Paid";
    case "OVERDUE":
      return "Overdue";
    case "PARTIAL":
      return "Partial";
    case "SENT":
      return "Pending";
    default:
      return null;
  }
}

/**
 * The word under an invoice's amount in Recent Activity. A draft or a cancelled invoice keeps its
 * line, under its own word, because it is not money: it is never "Income" (owner, 2026-09-14: "Apna
 * nishan do").
 */
export function invoiceActivityLabel(inv: Pick<MoneyRow, "status">): "Income" | "Draft" | "Cancelled" {
  if (countsAsMoney(inv)) return "Income";
  return (inv.status || "").toUpperCase() === "DRAFT" ? "Draft" : "Cancelled";
}
