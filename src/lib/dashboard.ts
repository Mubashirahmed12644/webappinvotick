import "server-only";
import type { WorkspaceData } from "./data";
import type { InvoiceSummary } from "./types";
import { countsAsMoney, statusNow, type MoneyRow } from "./invoice-status";
import { dashboardMetrics, invoiceActivityLabel, invoiceBadge, type DashboardMetrics } from "./dashboard-figures";

export type { DashboardMetrics };

// Mirrors the mobile app's dashboard model (feature/dashboard DashboardUiState).
export type DashboardActivityType = "INVOICE_CREATED" | "PAYMENT_RECEIVED" | "EXPENSE_ADDED";

/** The word under an activity's amount. */
export type DashboardActivityLabel = "Income" | "Expense" | "Draft" | "Cancelled";

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  status: string | null;
  /** A draft or a cancelled invoice keeps its line but reads "Draft" or "Cancelled", never "Income". */
  label: DashboardActivityLabel;
  /** For an invoice: its row as the rule reads it, so the page can work the badge out again on the viewer's date. */
  invoice?: MoneyRow;
}

export interface DashboardTopCustomer {
  id: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // short month name
  revenue: number;
  expense: number;
}

export interface DashboardModel {
  currency: string;
  businessName: string | null;
  /** The date (YYYY-MM-DD) the figures below were worked out on: the server's. */
  today: string;
  metrics: DashboardMetrics;
  topCustomers: DashboardTopCustomer[];
  activities: DashboardActivity[];
  monthly: MonthlyPoint[];
  /** Every invoice as the rule reads it, so the page can work the figures out again on the viewer's own date. */
  invoices: MoneyRow[];
}

const n = (v: string | number | null | undefined): number => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

// Only what the rule reads, so the model stays small on its way to the browser.
const moneyRow = (i: InvoiceSummary): MoneyRow => ({
  status: i.status,
  totalAmount: i.totalAmount,
  paidAmount: i.paidAmount ?? 0,
  dueDate: i.dueDate ?? null,
});

// Pure, server-side derivation of the mobile dashboard metrics from the sync
// workspace. No fabrication — every number comes from synced invoices,
// payments, expenses and clients.
//
// Money follows the invoice list's rule (invoice-status.ts, decision 0084):
// - A DRAFT or a CANCELLED invoice counts in no figure: not Revenue, Outstanding or Overdue, not the
//   Invoices card, not a top customer's total, and not a month of the trend. It keeps its line in
//   Recent Activity, labelled "Draft" or "Cancelled", never "Income".
// - A status comes from the invoice's payments and its due date on `today`, never from the row. So a
//   draft is never overdue, and an invoice marked OVERDUE by hand but paid in full counts as paid.
// - `today` is the server's date. The page works the figures that depend on it out again on the
//   viewer's own date (DashboardView), as the invoice list does.
export function buildDashboard(ws: WorkspaceData, today: string): DashboardModel {
  const invoices = ws.invoices;
  const real = invoices.filter(countsAsMoney);
  const rows = invoices.map(moneyRow);
  const totalExpenses = ws.expenses.reduce((s, e) => s + n(e.total), 0);

  // Top customers: group real invoices by client, sum revenue.
  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const inv of real) {
    if (!inv.clientId) continue;
    const cur = byClient.get(inv.clientId) ?? { name: inv.clientName || "—", total: 0, count: 0 };
    cur.total += n(inv.totalAmount);
    cur.count += 1;
    cur.name = inv.clientName || cur.name;
    byClient.set(inv.clientId, cur);
  }
  const topCustomers = [...byClient.entries()]
    .map(([id, v]) => ({ id, name: v.name, totalRevenue: v.total, invoiceCount: v.count }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Recent activity: invoices + payments + expenses, newest first.
  const merchantById = new Map(ws.merchants.map((m) => [m.id, m.name]));
  const acts: DashboardActivity[] = [];
  for (const inv of invoices) {
    acts.push({
      id: `inv-${inv.id}`,
      type: "INVOICE_CREATED",
      title: `Invoice ${inv.invoiceNumber}`,
      subtitle: inv.clientName || "—",
      amount: n(inv.totalAmount),
      date: inv.invoiceDate,
      status: invoiceBadge(statusNow(inv, today)),
      label: invoiceActivityLabel(inv),
      invoice: moneyRow(inv),
    });
  }
  for (const p of ws.payments) {
    acts.push({
      id: `pay-${p.id}`,
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      subtitle: p.paymentNumber || "Payment",
      amount: n(p.amount),
      date: p.paymentDate,
      status: null,
      label: "Income",
    });
  }
  for (const e of ws.expenses) {
    acts.push({
      id: `exp-${e.id}`,
      type: "EXPENSE_ADDED",
      title: e.category || "Expense",
      subtitle: (e.merchantId ? merchantById.get(e.merchantId) : null) || e.description || "Expense",
      amount: n(e.total),
      date: e.date,
      status: null,
      label: "Expense",
    });
  }
  const activities = acts
    .filter((a) => a.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  // Monthly revenue/expense series (last 6 months) for the trend + comparison charts.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mkey = (d: string) => (d || "").slice(0, 7);
  const revByMonth: Record<string, number> = {};
  const expByMonth: Record<string, number> = {};
  for (const inv of real) {
    const k = mkey(inv.invoiceDate);
    if (k) revByMonth[k] = (revByMonth[k] ?? 0) + n(inv.totalAmount);
  }
  for (const e of ws.expenses) {
    const k = mkey(e.date);
    if (k) expByMonth[k] = (expByMonth[k] ?? 0) + n(e.total);
  }
  const allKeys = [...Object.keys(revByMonth), ...Object.keys(expByMonth)].sort();
  const anchor = allKeys.length ? allKeys[allKeys.length - 1] : new Date().toISOString().slice(0, 7);
  const [ay, am] = anchor.split("-").map(Number);
  const monthly: MonthlyPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    let y = ay;
    let mo = am - i;
    while (mo <= 0) {
      mo += 12;
      y -= 1;
    }
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    monthly.push({ month: key, label: MONTHS[mo - 1], revenue: revByMonth[key] ?? 0, expense: expByMonth[key] ?? 0 });
  }

  return {
    currency: invoices[0]?.currency || ws.businesses[0]?.currencyCode || "USD",
    businessName: ws.businesses[0]?.name ?? null,
    today,
    monthly,
    metrics: dashboardMetrics(rows, today, totalExpenses),
    topCustomers,
    activities,
    invoices: rows,
  };
}
