"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import type { InvoiceSummary } from "@/lib/types";

// The same tokens globals.css defines, read through CSS variables rather than re-typed as hexes.
//
// This was a private copy, and it had already drifted: `success` here was #10B981 while the app's
// was #059669 and StatusBadge's was a third value — three greens for one word, "Paid". Pointing at
// the variables means the drift cannot start again, and it is what makes this component follow the
// theme instead of a snapshot of it.
const C = {
  primary: "var(--color-primary)",
  primaryVariant: "var(--color-primary)",
  success: "var(--color-success)",
  successLight: "var(--color-success-container)",
  warning: "var(--color-warning)",
  warningLight: "var(--color-warning-container)",
  error: "var(--color-error)",
  errorLight: "var(--color-error-container)",
  info: "var(--color-info)",
  infoLight: "var(--color-info-container)",
  grey: "var(--color-on-surface-variant)",
  greyLight: "var(--color-surface-variant)",
  ink: "var(--color-on-surface)",
  bg: "var(--color-background)",
} as const;

const n = (v: string | number | null | undefined) => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

function initials(name: string | null): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function symbolOf(currency: string): string {
  return formatMoney(0, currency).replace(/[\d.,\s]/g, "") || currency;
}

function statusStyle(status: string): { label: string; color: string; light: string } {
  switch (status.toUpperCase()) {
    case "PAID":
      return { label: "Paid", color: C.success, light: C.successLight };
    case "OVERDUE":
      return { label: "Overdue", color: C.error, light: C.errorLight };
    case "PARTIAL":
      return { label: "Partial", color: C.warning, light: C.warningLight };
    case "DRAFT":
      return { label: "Draft", color: C.grey, light: C.greyLight };
    case "CANCELLED":
      return { label: "Cancelled", color: C.grey, light: C.greyLight };
    default:
      return { label: "Sent", color: C.info, light: C.infoLight };
  }
}

const FILTER_ORDER = ["DRAFT", "SENT", "OVERDUE", "PAID", "PARTIAL", "CANCELLED"];

const DocIcon = ({ color = C.primary, size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7zM14 3v5h5" /></svg>
);
const CalIcon = ({ color = C.grey, size = 11 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v3M17 3v3M4 8h16M5 5h14v16H5z" /></svg>
);

function paidUnpaid(inv: InvoiceSummary): { paid: number; unpaid: number; total: number } {
  const total = n(inv.totalAmount);
  const paid = inv.status.toUpperCase() === "PAID" ? total : 0;
  return { paid, unpaid: total - paid, total };
}

/* ---------- Card (mobile / tablet grid) ---------- */
function InvoiceCard({ inv }: { inv: InvoiceSummary }) {
  const st = statusStyle(inv.status);
  const { paid, unpaid, total } = paidUnpaid(inv);
  return (
    <Link
      href={`/invoices/${inv.id}`}
      className="block rounded-[16px] bg-white p-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: C.infoLight }}>
          <DocIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-bold" style={{ color: C.ink }}>{inv.clientName || "—"}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: C.infoLight, color: C.primary }}>{inv.invoiceNumber}</span>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.light, color: st.color }}>{st.label}</span>
          </div>
          <p className="mt-0.5 text-[16px] font-extrabold" style={{ color: C.ink }}>{formatMoney(total, inv.currency)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: C.greyLight, color: C.grey }}>Paid: {formatMoney(paid, inv.currency)}</span>
            <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: C.warningLight, color: "#B45309" }}>Unpaid: {formatMoney(unpaid, inv.currency)}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.grey }}><CalIcon /> Due: {formatDate(inv.dueDate)}</p>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Row (desktop list pane) ---------- */
function InvoiceRow({ inv, active, onSelect }: { inv: InvoiceSummary; active: boolean; onSelect: () => void }) {
  const st = statusStyle(inv.status);
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-[14px] p-2.5 text-left transition-colors"
      style={active ? { background: "#EAF0FF", boxShadow: `inset 0 0 0 1.5px ${C.primary}` } : { background: "#fff", boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: C.infoLight }}><DocIcon size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-bold" style={{ color: C.ink }}>{inv.clientName || "—"}</span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.light, color: st.color }}>{st.label}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-[11px]" style={{ color: C.grey }}>{inv.invoiceNumber}</span>
            <span className="shrink-0 text-[13px] font-extrabold" style={{ color: C.ink }}>{formatMoney(n(inv.totalAmount), inv.currency)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------- Detail pane (desktop) ---------- */
function DetailPane({ inv }: { inv: InvoiceSummary | null }) {
  if (!inv) {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-[20px] bg-white text-sm" style={{ color: C.grey, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
        Select an invoice to preview.
      </div>
    );
  }
  const st = statusStyle(inv.status);
  const { paid, unpaid, total } = paidUnpaid(inv);
  return (
    <div className="sticky top-3 rounded-[20px] bg-white p-5" style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: st.light, color: st.color }}>{st.label}</span>
          <h2 className="mt-2 truncate text-[22px] font-extrabold" style={{ color: C.ink }}>{inv.invoiceNumber}</h2>
          <p className="truncate text-[14px]" style={{ color: C.grey }}>{inv.clientName || "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px]" style={{ color: C.grey }}>Total</p>
          <p className="text-[24px] font-extrabold leading-tight" style={{ color: C.ink }}>{formatMoney(total, inv.currency)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-[14px] p-3" style={{ background: "#D1FAE5" }}>
          <p className="text-[11px] font-semibold" style={{ color: C.success }}>Paid</p>
          <p className="mt-0.5 text-[16px] font-extrabold" style={{ color: C.success }}>{formatMoney(paid, inv.currency)}</p>
        </div>
        <div className="rounded-[14px] p-3" style={{ background: C.warningLight }}>
          <p className="text-[11px] font-semibold" style={{ color: "#B45309" }}>Unpaid</p>
          <p className="mt-0.5 text-[16px] font-extrabold" style={{ color: "#B45309" }}>{formatMoney(unpaid, inv.currency)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 border-t pt-4" style={{ borderColor: "#F1F1F4" }}>
        <div className="flex items-center justify-between text-[13px]">
          <span style={{ color: C.grey }}>Invoice date</span>
          <span className="font-semibold" style={{ color: C.ink }}>{formatDate(inv.invoiceDate)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span style={{ color: C.grey }}>Due date</span>
          <span className="font-semibold" style={{ color: C.ink }}>{formatDate(inv.dueDate)}</span>
        </div>
      </div>

      <div className="mt-5 flex gap-2.5">
        <Link href={`/invoices/${inv.id}`} className="flex-1 rounded-full py-2.5 text-center text-[13px] font-bold text-white transition-all hover:-translate-y-0.5" style={{ background: C.primary, boxShadow: "0 6px 16px rgba(13,77,192,0.3)" }}>
          Open full invoice →
        </Link>
        <Link href={`/invoices/${inv.id}/edit`} className="rounded-full px-4 py-2.5 text-center text-[13px] font-bold" style={{ background: C.greyLight, color: C.ink }}>
          Edit
        </Link>
      </div>
    </div>
  );
}

/* ---------- First-time / empty home (onboarding) ---------- */
function StepIcon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function WelcomeHome({ userName }: { userName: string | null }) {
  const first = userName?.trim().split(/\s+/)[0] || "there";
  const steps = [
    { href: "/settings", title: "Set up your business", desc: "Logo, currency & company details.", color: C.info, light: C.infoLight, d: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01" },
    { href: "/clients/new", title: "Add a client", desc: "Save the people you invoice.", color: C.success, light: "#D1FAE5", d: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" },
    { href: "/products/new", title: "Add a product or service", desc: "Reuse items across invoices.", color: "#8B5CF6", light: "#EDE9FE", d: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" },
    { href: "/invoices/new", title: "Create your first invoice", desc: "Bill a client and get paid faster.", color: C.primary, light: "#EAF0FF", d: "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M12 11v4" },
  ];
  return (
    <div className="-mx-4 -my-6 px-4 py-6 sm:-mx-6 sm:-my-8 sm:px-6 lg:-mx-8 lg:flex lg:min-h-[calc(100vh-4rem)] lg:items-center lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto w-full max-w-4xl">
        {/* Hero */}
        <div className="overflow-hidden rounded-[22px] p-5 text-white sm:rounded-[28px] sm:p-8" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryVariant})`, boxShadow: "0 14px 34px rgba(13,77,192,0.30)" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>Welcome to Invotick</p>
              <h1 className="mt-0.5 text-[23px] font-extrabold leading-tight sm:text-[28px]">Hi {first} 👋</h1>
              <p className="mt-1.5 max-w-md text-[13px] sm:text-[14px]" style={{ color: "rgba(255,255,255,0.88)" }}>
                Set up your business first, then create and send professional invoices in minutes.
              </p>
              <Link href="/settings" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5 sm:mt-5" style={{ color: C.primary }}>
                Set up your business <span className="text-lg leading-none">→</span>
              </Link>
            </div>
            <div className="hidden shrink-0 self-center sm:block">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <rect x="24" y="16" width="70" height="90" rx="12" fill="#ffffff" opacity="0.96" />
                <rect x="37" y="33" width="44" height="7" rx="3.5" fill="#0D4DC0" opacity="0.55" />
                <rect x="37" y="49" width="30" height="5" rx="2.5" fill="#94A3B8" />
                <rect x="37" y="61" width="44" height="5" rx="2.5" fill="#E2E8F0" />
                <rect x="37" y="71" width="44" height="5" rx="2.5" fill="#E2E8F0" />
                <rect x="37" y="86" width="26" height="9" rx="4.5" fill="#10B981" />
                <circle cx="94" cy="30" r="15" fill="#FCD34D" />
                <path d="M94 23v14M87 30h14" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick start */}
        <h2 className="mb-3 mt-7 text-[15px] font-bold" style={{ color: C.ink }}>Quick start</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-3.5 rounded-[20px] bg-white p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: s.light, color: s.color }}>
                <StepIcon d={s.d} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold" style={{ color: C.ink }}>{s.title}</span>
                <span className="block truncate text-[12.5px]" style={{ color: C.grey }}>{s.desc}</span>
              </span>
              <span className="text-lg" style={{ color: C.grey }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvoiceHome({
  invoices,
  businesses,
  currency,
  userName,
}: {
  invoices: InvoiceSummary[];
  businesses: { id: string; name: string; currencyCode?: string | null }[];
  currency: string;
  userName?: string | null;
}) {
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null = "All Businesses" (combined). Users with several businesses switch here.
  const [businessId, setBusinessId] = useState<string | null>(null);

  const activeBusiness = businesses.find((b) => b.id === businessId) ?? null;
  const activeName = activeBusiness?.name ?? "All Businesses";
  const activeCurrency = activeBusiness?.currencyCode || currency;
  const sym = symbolOf(activeCurrency);

  // Invoices scoped to the selected business (or all).
  const businessInvoices = useMemo(
    () => (businessId ? invoices.filter((i) => i.businessId === businessId) : invoices),
    [invoices, businessId]
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let collected = 0;
    let overdue = 0;
    let sent = 0;
    const counts: Record<string, number> = {};
    for (const inv of businessInvoices) {
      const amt = n(inv.totalAmount);
      const st = (inv.status || "").toUpperCase();
      revenue += amt;
      if (st === "PAID") collected += amt;
      if (st === "OVERDUE") overdue += amt;
      if (st === "SENT") sent += 1;
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return { revenue, collected, outstanding: revenue - collected, overdue, sent, counts };
  }, [businessInvoices]);

  const filters = useMemo(() => {
    const present = new Set(businessInvoices.map((i) => (i.status || "").toUpperCase()));
    const ordered = FILTER_ORDER.filter((s) => present.has(s));
    for (const s of present) if (!FILTER_ORDER.includes(s)) ordered.push(s);
    return ["ALL", ...ordered];
  }, [businessInvoices]);

  const shown = filter === "ALL" ? businessInvoices : businessInvoices.filter((i) => (i.status || "").toUpperCase() === filter);
  const selected = shown.find((i) => i.id === selectedId) ?? shown[0] ?? null;

  // First-time user (no invoices yet) → friendly welcome + onboarding.
  if (invoices.length === 0) {
    return <WelcomeHome userName={userName ?? null} />;
  }

  return (
    <div className="-mx-4 -my-6 px-4 py-5 sm:-mx-6 sm:-my-8 sm:px-6 lg:-mx-8 lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-6xl">
        {/* Summary card */}
        <div className="rounded-[20px] p-4 text-white" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryVariant})`, boxShadow: "0 8px 20px rgba(13,77,192,0.25)" }}>
          <div className="flex items-stretch gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-[13px] font-extrabold" style={{ background: "rgba(255,255,255,0.18)" }}>{initials(activeName)}</div>
                <div className="min-w-0">
                  {/* Business switcher — "All Businesses" + each business (mirrors the mobile app). */}
                  {businesses.length > 1 ? (
                    <div className="relative inline-flex items-center">
                      <select
                        value={businessId ?? ""}
                        onChange={(e) => { setBusinessId(e.target.value || null); setSelectedId(null); }}
                        aria-label="Business"
                        className="max-w-[220px] cursor-pointer truncate rounded-md bg-white/10 py-0.5 pl-2 pr-6 text-[16px] font-bold leading-tight text-white outline-none hover:bg-white/20 [&>option]:text-neutral-900"
                      >
                        <option value="">All Businesses</option>
                        {businesses.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-1.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  ) : (
                    <p className="truncate text-[16px] font-bold leading-tight">{activeName}</p>
                  )}
                  <span className="mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.18)" }}>{activeCurrency} ({sym})</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-[12.5px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                <span className="flex items-center gap-1"><DocIcon color="#fff" size={13} /> {businessInvoices.length} Invoices</span>
                <span>➤ {totals.sent} Sent</span>
              </div>
              <div className="mt-3">
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>Total Revenue</p>
                <p className="text-[24px] font-extrabold leading-tight">{formatMoney(totals.revenue, activeCurrency)}</p>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2.5 border-l pl-4 text-right" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
              <div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>Collected</p>
                <p className="text-[14px] font-bold">{formatMoney(totals.collected, activeCurrency)}</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>Outstanding</p>
                <p className="text-[14px] font-bold">{formatMoney(totals.outstanding, activeCurrency)}</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>Overdue</p>
                <p className="text-[14px] font-bold" style={{ color: "#FCD34D" }}>{formatMoney(totals.overdue, activeCurrency)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((f) => {
            const active = filter === f;
            const label = f === "ALL" ? "All" : statusStyle(f).label;
            const count = f === "ALL" ? businessInvoices.length : totals.counts[f] ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
                style={active ? { background: C.primary, color: "#fff", boxShadow: "0 4px 12px rgba(13,77,192,0.3)" } : { background: "#fff", color: C.ink, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}
              >
                {label}
                {count > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: C.infoLight, color: C.primary }}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="mb-2.5 mt-4 flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: C.grey }}>
            Recent Invoices <span style={{ color: C.primary }}>({shown.length})</span>
          </p>
          <Link href="/invoices/new" className="hidden items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 xl:inline-flex" style={{ background: C.primary, boxShadow: "0 4px 12px rgba(13,77,192,0.3)" }}>
            <span className="text-base leading-none">+</span> New Invoice
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-[16px] bg-white py-12 text-center text-sm" style={{ color: C.grey, boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}>No invoices in this filter.</div>
        ) : (
          <>
            {/* Mobile / tablet: card grid */}
            <div className="grid gap-2.5 pb-4 md:grid-cols-2 xl:hidden">
              {shown.map((inv) => <InvoiceCard key={inv.id} inv={inv} />)}
            </div>

            {/* Desktop: list + detail */}
            <div className="hidden gap-3 pb-4 xl:grid xl:grid-cols-[360px_1fr] xl:items-start">
              <div className="max-h-[72vh] space-y-2 overflow-auto pr-1">
                {shown.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} active={selected?.id === inv.id} onSelect={() => setSelectedId(inv.id)} />
                ))}
              </div>
              <DetailPane inv={selected} />
            </div>
          </>
        )}

        {/* Create invoice */}
        <div className="sticky bottom-4 flex justify-end xl:hidden">
          <Link href="/invoices/new" className="inline-flex items-center gap-2 rounded-[14px] px-5 py-3 text-[15px] font-bold text-white" style={{ background: C.primary, boxShadow: "0 6px 16px rgba(13,77,192,0.4)" }}>
            <span className="text-xl leading-none">+</span> Create Invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
