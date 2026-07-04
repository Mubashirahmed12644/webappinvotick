import "server-only";
import type { WorkspaceData } from "./data";
import type { InvoiceStatus } from "./types";

// Mirrors the mobile app's dashboard model (feature/dashboard DashboardUiState).
export type DashboardActivityType = "INVOICE_CREATED" | "PAYMENT_RECEIVED" | "EXPENSE_ADDED";

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  status: string | null;
}

export interface DashboardTopCustomer {
  id: string;
  name: string;
  totalRevenue: number;
  invoiceCount: number;
}

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

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // short month name
  revenue: number;
  expense: number;
}

export interface DashboardModel {
  currency: string;
  businessName: string | null;
  metrics: DashboardMetrics;
  topCustomers: DashboardTopCustomer[];
  activities: DashboardActivity[];
  monthly: MonthlyPoint[];
}

const n = (v: string | number | null | undefined): number => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

function statusLabel(s: InvoiceStatus): string | null {
  switch (s) {
    case "PAID":
      return "Paid";
    case "OVERDUE":
      return "Overdue";
    case "SENT":
      return "Pending";
    default:
      return null; // DRAFT / CANCELLED → no badge (mirrors mobile)
  }
}

// Pure, server-side derivation of the mobile dashboard metrics from the sync
// workspace. No fabrication — every number comes from synced invoices,
// payments, expenses and clients.
export function buildDashboard(ws: WorkspaceData): DashboardModel {
  const invoices = ws.invoices;

  const totalRevenue = invoices.reduce((s, i) => s + n(i.totalAmount), 0);
  const paidList = invoices.filter((i) => i.status === "PAID");
  const overdueList = invoices.filter((i) => i.status === "OVERDUE");
  const paid = paidList.reduce((s, i) => s + n(i.totalAmount), 0);
  const overdueAmount = overdueList.reduce((s, i) => s + n(i.totalAmount), 0);
  const totalExpenses = ws.expenses.reduce((s, e) => s + n(e.total), 0);

  // Top customers: group invoices by client, sum revenue.
  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const inv of invoices) {
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
      status: statusLabel(inv.status),
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
  for (const inv of invoices) {
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
    monthly,
    metrics: {
      totalRevenue,
      outstanding: totalRevenue - paid,
      totalInvoices: invoices.length,
      overdueAmount,
      paidInvoices: paidList.length,
      unpaidInvoices: Math.max(0, invoices.length - paidList.length - overdueList.length),
      overdueInvoices: overdueList.length,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    },
    topCustomers,
    activities,
  };
}
