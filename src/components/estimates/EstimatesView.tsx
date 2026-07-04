"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import type { Estimate } from "@/lib/data";

const C = {
  primary: "#0D4DC0",
  primaryVariant: "#0A3D9A",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
  grey: "#6B7280",
  greyLight: "#F3F4F6",
  ink: "#0F172A",
  bg: "#F6F7FB",
} as const;

const n = (v: string | number | null | undefined) => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

function statusStyle(s: string): { label: string; color: string; light: string } {
  switch (s.toUpperCase()) {
    case "ACCEPTED":
    case "APPROVED":
      return { label: "Accepted", color: C.success, light: "#D1FAE5" };
    case "DECLINED":
    case "REJECTED":
      return { label: "Declined", color: C.error, light: "#FEE2E2" };
    case "EXPIRED":
      return { label: "Expired", color: C.warning, light: "#FEF3C7" };
    case "CONVERTED":
      return { label: "Converted", color: C.purple, light: "#EDE9FE" };
    case "SENT":
      return { label: "Sent", color: C.info, light: "#DCEEFB" };
    case "DRAFT":
    default:
      return { label: s ? s[0] + s.slice(1).toLowerCase() : "Draft", color: C.grey, light: C.greyLight };
  }
}

export function EstimatesView({
  estimates,
  names,
  currency,
}: {
  estimates: Estimate[];
  names: Record<string, string>;
  currency: string;
}) {
  const [filter, setFilter] = useState("ALL");

  const { total, counts } = useMemo(() => {
    let total = 0;
    const counts: Record<string, number> = {};
    for (const e of estimates) {
      total += n(e.totalAmount);
      const st = (e.status || "DRAFT").toUpperCase();
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return { total, counts };
  }, [estimates]);

  const filters = useMemo(() => ["ALL", ...Object.keys(counts).sort()], [counts]);
  const shown = filter === "ALL" ? estimates : estimates.filter((e) => (e.status || "DRAFT").toUpperCase() === filter);

  return (
    <div className="-mx-4 -my-6 px-4 py-5 sm:-mx-6 sm:-my-8 sm:px-6 lg:-mx-8 lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: C.ink }}>Estimates</h1>
        <p className="mt-0.5 text-sm" style={{ color: C.grey }}>
          {estimates.length} {estimates.length === 1 ? "estimate" : "estimates"} · worth {formatMoney(total, currency)}
        </p>

        {/* Summary tiles */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-[24px] p-4 text-white" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryVariant})`, boxShadow: "0 8px 20px rgba(13,77,192,0.25)" }}>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.8)" }}>Total Estimates</p>
            <p className="mt-1 text-[28px] font-extrabold leading-none">{estimates.length}</p>
          </div>
          <div className="rounded-[24px] p-4" style={{ background: "#fff", boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
            <p className="text-[12px]" style={{ color: C.grey }}>Total Value</p>
            <p className="mt-1 text-[22px] font-extrabold leading-none" style={{ color: C.ink }}>{formatMoney(total, currency)}</p>
          </div>
        </div>

        {/* Filters */}
        {filters.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {filters.map((f) => {
              const active = filter === f;
              const label = f === "ALL" ? "All" : statusStyle(f).label;
              const count = f === "ALL" ? estimates.length : counts[f] ?? 0;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200"
                  style={active ? { background: C.primary, color: "#fff", boxShadow: "0 4px 12px rgba(13,77,192,0.3)" } : { background: "#fff", color: C.ink, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}
                >
                  {label}
                  <span className="rounded-full px-1.5 text-[11px] font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: C.greyLight, color: C.grey }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        {shown.length === 0 ? (
          <div className="mt-6 rounded-[24px] bg-white py-16 text-center text-sm" style={{ color: C.grey, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
            No estimates here yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((e) => {
              const st = statusStyle(e.status || "DRAFT");
              return (
                <Link
                  key={e.id}
                  href={`/estimates/${e.id}`}
                  className="group relative overflow-hidden rounded-[24px] bg-white p-4 transition-all duration-200 hover:-translate-y-1"
                  style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}
                >
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: st.color }} />
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-extrabold" style={{ color: C.ink }}>{e.estimateNumber}</p>
                      <p className="mt-0.5 truncate text-[13px]" style={{ color: C.grey }}>
                        {e.customerId ? names[e.customerId] ?? "—" : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: st.light, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between pl-2">
                    <p className="text-[20px] font-extrabold" style={{ color: C.ink }}>{formatMoney(e.totalAmount, e.currency)}</p>
                    <p className="flex items-center gap-1 text-[11px]" style={{ color: C.grey }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v3M17 3v3M4 8h16M5 5h14v16H5z" /></svg>
                      {formatDate(e.estimateDate)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
