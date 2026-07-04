import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import type { DashboardModel, DashboardActivity, MonthlyPoint } from "@/lib/dashboard";

// Exact palette from the mobile app (DashboardColors).
const C = {
  primary: "#0D4DC0",
  primaryVariant: "#0A3D9A",
  primaryLight: "#D6E2FF",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DCEEFB",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
  grey: "#6B7280",
  greyLight: "#F3F4F6",
  background: "#F6F7FB",
  card: "#FFFFFF",
  ink: "#0F172A",
} as const;

const money = (v: number, currency: string) => formatMoney(v, currency);

/* ---------- tiny inline icons (stroke, 1.8) ---------- */
function Icon({ path, size = 16, color = "currentColor", fill = "none" }: { path: string; size?: number; color?: string; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? color : "none"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
const P = {
  trendingUp: "M3 17l6-6 4 4 8-8M21 7h-4M21 7v4",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5",
  warning: "M12 3l9 16H3zM12 10v4M12 17h.01",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5z",
  swap: "M7 8h13l-3-3M17 16H4l3 3",
  payment: "M3 7h18v10H3zM3 11h18",
  cart: "M3 4h2l2 12h11l2-8H7M9 20a1 1 0 100-2 1 1 0 000 2m8 0a1 1 0 100-2 1 1 0 000 2",
  clockSmall: "M12 8v4l2 1M12 21a9 9 0 100-18 9 9 0 000 18z",
};

/* ============================ Sections ============================ */

function BusinessCard({ name }: { name: string | null }) {
  return (
    <Link
      href="/settings"
      className="block overflow-hidden rounded-[16px]"
      style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}
    >
      <div
        className="flex items-center justify-between gap-3 p-3.5"
        style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.primaryVariant})` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            {(name?.trim()?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>Selected Business</p>
            <p className="truncate text-sm font-bold text-white">{name ?? "No business selected"}</p>
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.2)" }}>
          <Icon path={P.swap} size={18} color="#fff" />
        </div>
      </div>
    </Link>
  );
}

function DateRangePill() {
  return (
    <div className="flex items-center justify-between rounded-full px-4 py-1.5" style={{ background: C.primaryLight }}>
      <div className="flex items-center gap-2.5">
        <Icon path={P.calendar} size={20} color={C.primary} />
        <div className="leading-tight">
          <p className="text-[11px]" style={{ color: C.grey }}>Date Range</p>
          <p className="text-[13px] font-semibold text-black">All Time</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color, light }: { title: string; value: string; icon: string; color: string; light: string }) {
  return (
    <div className="flex-1 rounded-[8px] p-2.5" style={{ background: light, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <div className="flex items-center gap-1.5">
        <Icon path={icon} size={14} color={color} />
        <span className="text-[11px] font-medium" style={{ color }}>{title}</span>
      </div>
      <p className="mt-1.5 text-[17px] font-bold leading-tight" style={{ color }}>{value}</p>
    </div>
  );
}

function KeyMetrics({ m, currency }: { m: DashboardModel["metrics"]; currency: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-[13px] font-bold" style={{ color: C.ink }}>Key Metrics</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard title="Revenue" value={money(m.totalRevenue, currency)} icon={P.trendingUp} color={C.success} light={C.successLight} />
        <KpiCard title="Outstanding" value={money(m.outstanding, currency)} icon={P.clock} color={C.warning} light={C.warningLight} />
        <KpiCard title="Invoices" value={String(m.totalInvoices)} icon={P.doc} color={C.info} light={C.infoLight} />
        <KpiCard title="Overdue" value={money(m.overdueAmount, currency)} icon={P.warning} color={C.error} light={C.errorLight} />
      </div>
    </div>
  );
}

function StatusItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 rounded-[8px] p-3 text-center" style={{ background: `${color}1A` }}>
      <p className="text-[22px] font-bold leading-none" style={{ color }}>{count}</p>
      <p className="mt-1 text-[11px]" style={{ color: C.grey }}>{label}</p>
    </div>
  );
}

function InvoiceStatus({ m }: { m: DashboardModel["metrics"] }) {
  return (
    <div className="rounded-[16px] p-3" style={{ background: C.card, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <h2 className="mb-2.5 text-[13px] font-bold" style={{ color: C.ink }}>Invoice Status</h2>
      <div className="flex gap-2">
        <StatusItem label="Paid" count={m.paidInvoices} color={C.success} />
        <StatusItem label="Unpaid" count={m.unpaidInvoices} color={C.warning} />
        <StatusItem label="Overdue" count={m.overdueInvoices} color={C.error} />
      </div>
    </div>
  );
}

function TopCustomers({ customers, currency }: { customers: DashboardModel["topCustomers"]; currency: string }) {
  const medal = (rank: number) => {
    switch (rank) {
      case 1: return { emoji: "🥇", color: "#FFD700", bg: "#FFF9E6" };
      case 2: return { emoji: "🥈", color: "#C0C0C0", bg: "#F5F5F5" };
      case 3: return { emoji: "🥉", color: "#CD7F32", bg: "#FFF4E6" };
      default: return { emoji: `#${rank}`, color: C.primary, bg: C.primaryLight };
    }
  };
  return (
    <div className="rounded-[16px] p-3" style={{ background: C.card, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none">🏆</span>
          <h2 className="text-[13px] font-bold" style={{ color: C.ink }}>Top Customers</h2>
        </div>
        {customers.length > 0 && (
          <Link href="/clients" className="text-[11px] font-semibold" style={{ color: C.primary }}>View All</Link>
        )}
      </div>
      {customers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: C.greyLight }}>
            <Icon path="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" size={24} color={C.grey} />
          </div>
          <p className="text-sm" style={{ color: C.grey }}>No customers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((cust, i) => {
            const md = medal(i + 1);
            return (
              <div key={cust.id} className="flex items-center gap-3 rounded-[16px] p-3" style={{ background: md.bg, border: `1px solid ${md.color}4D` }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${md.color}33`, color: md.color }}>
                  {md.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold" style={{ color: C.ink }}>{cust.name}</p>
                  <div className="mt-0.5 flex items-center gap-1" style={{ color: C.grey }}>
                    <Icon path={P.doc} size={12} color={C.grey} />
                    <span className="text-[11px]">{cust.invoiceCount} invoices</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold" style={{ color: C.success }}>{money(cust.totalRevenue, currency)}</p>
                  <p className="text-[11px]" style={{ color: C.grey }}>Revenue</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function activityStyle(type: DashboardActivity["type"]) {
  switch (type) {
    case "PAYMENT_RECEIVED": return { color: C.success, light: C.successLight, icon: P.payment, kind: "Income" };
    case "EXPENSE_ADDED": return { color: C.error, light: C.errorLight, icon: P.cart, kind: "Expense" };
    default: return { color: C.info, light: C.infoLight, icon: P.doc, kind: "Income" };
  }
}
function statusChip(status: string) {
  const map: Record<string, { color: string; light: string }> = {
    Paid: { color: C.success, light: C.successLight },
    Pending: { color: C.warning, light: C.warningLight },
    Overdue: { color: C.error, light: C.errorLight },
  };
  return map[status] ?? { color: C.grey, light: C.greyLight };
}

function RecentActivity({ activities, currency }: { activities: DashboardModel["activities"]; currency: string }) {
  return (
    <div className="overflow-hidden rounded-[16px]" style={{ background: C.card, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <div
        className="flex items-center justify-between px-3 py-3.5"
        style={{ background: `linear-gradient(90deg, ${C.purple}1A, ${C.primary}1A)` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.primary})` }}>
            <Icon path="M4 12h4l2-6 4 12 2-6h4" size={18} color="#fff" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold" style={{ color: C.ink }}>Recent Activity</p>
            <p className="text-[11px]" style={{ color: C.grey }}>
              {activities.length > 0 ? `${activities.length} transactions` : "No activity"}
            </p>
          </div>
        </div>
        {activities.length > 0 && (
          <Link href="/invoices" className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: `${C.primary}26`, color: C.primary }}>
            View All →
          </Link>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: C.greyLight }}>
            <Icon path="M4 12h4l2-6 4 12 2-6h4" size={40} color={C.grey} />
          </div>
          <p className="text-sm font-semibold" style={{ color: C.grey }}>No recent activity</p>
        </div>
      ) : (
        <div className="p-3">
          {activities.map((a, i) => {
            const st = activityStyle(a.type);
            const isLast = i === activities.length - 1;
            return (
              <div key={a.id} className="flex gap-2.5">
                {/* timeline column */}
                <div className="flex w-9 shrink-0 flex-col items-center">
                  <div className="h-1" />
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: st.color, border: "2px solid #fff" }}
                  >
                    <Icon path={st.icon} size={15} color="#fff" />
                  </div>
                  {!isLast && <div className="w-0.5 flex-1" style={{ background: `${st.color}4D`, minHeight: 12 }} />}
                </div>
                {/* content */}
                <div className={isLast ? "flex-1" : "flex-1 pb-2"}>
                  <div className="flex items-center justify-between gap-2 rounded-[10px] p-2.5" style={{ background: "#fff", border: `1px solid ${st.color}33` }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold" style={{ color: C.ink }}>{a.title}</p>
                      <p className="truncate text-[12px]" style={{ color: C.grey }}>{a.subtitle}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: C.grey }}>
                          <Icon path={P.clockSmall} size={10} color={C.grey} />
                          {formatDate(a.date)}
                        </span>
                        {a.status && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: statusChip(a.status).light, color: statusChip(a.status).color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusChip(a.status).color }} />
                            {a.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-[8px] px-2 py-1.5 text-right" style={{ background: st.light }}>
                      <p className="text-[13px] font-bold" style={{ color: st.color }}>{money(a.amount, currency)}</p>
                      <p className="text-[10px]" style={{ color: `${st.color}B3` }}>{st.kind}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function compact(v: number, currency: string): string {
  const sym = formatMoney(0, currency).replace(/[\d.,\s]/g, "") || "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}K`;
  return `${sym}${v.toFixed(0)}`;
}

function RevenueTrendCard({ monthly, currency }: { monthly: MonthlyPoint[]; currency: string }) {
  const W = 320;
  const H = 130;
  const pad = 12;
  const base = H - 22;
  const max = Math.max(1, ...monthly.map((p) => p.revenue));
  const stepX = monthly.length > 1 ? (W - 2 * pad) / (monthly.length - 1) : 0;
  const px = (i: number) => pad + i * stepX;
  const py = (v: number) => pad + (1 - v / max) * (base - pad);
  const line = monthly.map((p, i) => `${px(i)},${py(p.revenue)}`).join(" ");
  const area = `${px(0)},${base} ${line} ${px(monthly.length - 1)},${base}`;
  const total = monthly.reduce((s, p) => s + p.revenue, 0);
  return (
    <div className="rounded-[16px] p-3" style={{ background: C.card, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-bold" style={{ color: C.ink }}>Revenue Trend</h2>
        <span className="text-[12px] font-semibold" style={{ color: C.success }}>{compact(total, currency)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 130 }}>
        <polygon points={area} fill={`${C.primary}14`} />
        <polyline points={line} fill="none" stroke={C.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {monthly.map((p, i) => (
          <circle key={p.month} cx={px(i)} cy={py(p.revenue)} r={2.5} fill={C.primary} />
        ))}
        {monthly.map((p, i) => (
          <text key={p.month} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill={C.grey}>{p.label}</text>
        ))}
      </svg>
    </div>
  );
}

function IncomeExpenseCard({ monthly, currency }: { monthly: MonthlyPoint[]; currency: string }) {
  const W = 320;
  const H = 130;
  const pad = 12;
  const base = H - 22;
  const max = Math.max(1, ...monthly.flatMap((p) => [p.revenue, p.expense]));
  const groupW = (W - 2 * pad) / monthly.length;
  const barW = Math.min(12, groupW / 3);
  const h = (v: number) => (v / max) * (base - pad);
  return (
    <div className="rounded-[16px] p-3" style={{ background: C.card, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-bold" style={{ color: C.ink }}>Income vs Expense</h2>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: C.grey }}>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.success }} />Income</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.error }} />Expense</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 130 }}>
        {monthly.map((p, i) => {
          const cx = pad + i * groupW + groupW / 2;
          return (
            <g key={p.month}>
              <rect x={cx - barW - 1} y={base - h(p.revenue)} width={barW} height={h(p.revenue)} rx={2} fill={C.success} />
              <rect x={cx + 1} y={base - h(p.expense)} width={barW} height={h(p.expense)} rx={2} fill={C.error} />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill={C.grey}>{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================ Root ============================ */

export function DashboardView({ model }: { model: DashboardModel }) {
  return (
    <div className="-mx-4 -my-6 px-3 py-3 sm:-mx-6 sm:-my-8 lg:-mx-8" style={{ background: C.background }}>
      <div className="mx-auto max-w-6xl space-y-2.5">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch">
          <div className="md:flex-1">
            <BusinessCard name={model.businessName} />
          </div>
          <div className="md:w-72 md:shrink-0 md:self-center lg:w-80">
            <DateRangePill />
          </div>
        </div>
        <KeyMetrics m={model.metrics} currency={model.currency} />
        <div className="grid gap-2.5 md:grid-cols-2">
          <RevenueTrendCard monthly={model.monthly} currency={model.currency} />
          <IncomeExpenseCard monthly={model.monthly} currency={model.currency} />
        </div>
        <div className="grid gap-2.5 md:grid-cols-2 md:items-start">
          <div className="space-y-2.5">
            <InvoiceStatus m={model.metrics} />
            <TopCustomers customers={model.topCustomers} currency={model.currency} />
          </div>
          <RecentActivity activities={model.activities} currency={model.currency} />
        </div>
      </div>
    </div>
  );
}
