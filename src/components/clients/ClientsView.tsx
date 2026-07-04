"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { Client } from "@/lib/types";

const C = {
  primary: "#0D4DC0",
  primaryVariant: "#0A3D9A",
  success: "#10B981",
  grey: "#6B7280",
  greyLight: "#F3F4F6",
  ink: "#0F172A",
  bg: "#F6F7FB",
} as const;

// Gentle deterministic gradient per client so avatars feel lively but consistent.
const GRADIENTS = [
  ["#0D4DC0", "#4F86FF"],
  ["#10B981", "#34D399"],
  ["#8B5CF6", "#C084FC"],
  ["#F59E0B", "#FBBF24"],
  ["#EC4899", "#F472B6"],
  ["#06B6D4", "#22D3EE"],
];
function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length] as [string, string];
}
function initials(name: string): string {
  const w = name.trim().split(/\s+/).slice(0, 2);
  return (w.map((x) => x[0] ?? "").join("") || "?").toUpperCase();
}

export interface ClientStat {
  count: number;
  total: number;
}

export function ClientsView({ clients, stats }: { clients: Client[]; stats: Record<string, ClientStat> }) {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((c) =>
      [c.name, c.companyName, c.emailAddress, c.phone].some((v) => v?.toLowerCase().includes(query)),
    );
  }, [clients, q]);

  return (
    <div className="-mx-4 -my-6 px-4 py-5 sm:-mx-6 sm:-my-8 sm:px-6 lg:-mx-8 lg:px-8" style={{ background: C.bg }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: C.ink }}>Clients</h1>
            <p className="mt-0.5 text-sm" style={{ color: C.grey }}>{clients.length} {clients.length === 1 ? "client" : "clients"}</p>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: C.primary, boxShadow: "0 6px 16px rgba(13,77,192,0.3)" }}
          >
            <span className="text-lg leading-none">+</span> New Client
          </Link>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-3" style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.06)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients by name, company, email…"
            className="w-full bg-transparent text-[14px] outline-none"
            style={{ color: C.ink }}
          />
          {q && (
            <button onClick={() => setQ("")} className="text-[13px] font-semibold" style={{ color: C.grey }}>Clear</button>
          )}
        </div>

        {/* Grid */}
        {shown.length === 0 ? (
          <div className="mt-6 rounded-[24px] bg-white py-16 text-center text-sm" style={{ color: C.grey, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>
            {clients.length === 0 ? "No clients yet." : "No clients match your search."}
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((c) => {
              const [g1, g2] = gradientFor(c.id);
              const st = stats[c.id];
              const location = [c.city, c.country].filter(Boolean).join(", ");
              const subtitle = c.companyName || c.emailAddress || c.phone;
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="group rounded-[18px] bg-white p-3 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ boxShadow: "0 2px 10px rgba(15,23,42,0.05)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-[13px] font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold leading-tight" style={{ color: C.ink }}>{c.name}</p>
                      {subtitle && <p className="mt-0.5 truncate text-[12px] leading-tight" style={{ color: C.grey }}>{subtitle}</p>}
                    </div>
                    {c.currencyCode && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: C.greyLight, color: C.grey }}>{c.currencyCode}</span>
                    )}
                  </div>

                  {st && st.count > 0 && (
                    <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-[12.5px]" style={{ borderColor: "#F1F1F4" }}>
                      <span style={{ color: C.grey }}>{st.count} {st.count === 1 ? "invoice" : "invoices"}</span>
                      <span className="font-extrabold" style={{ color: C.primary }}>{formatMoney(st.total, c.currencyCode || "USD")}</span>
                    </div>
                  )}

                  {location && (
                    <p className="mt-1.5 flex items-center gap-1 truncate text-[11px]" style={{ color: C.grey }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                      {location}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
