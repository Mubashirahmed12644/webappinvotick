"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CURRENCIES, type FreeInvoice, type FreeLineItem } from "@/lib/free-invoice/types";
import { createEmptyInvoice, nextInvoiceNumber, toRenderData, totalsFor, uuid } from "@/lib/free-invoice/adapter";
import { randomSample } from "@/lib/free-invoice/samples";
import { getAllInvoices, putInvoice, deleteInvoice, getActiveId, setActiveId, hasContent } from "@/lib/free-invoice/store";
import { initialCurrency, setPreferredCurrency } from "@/lib/free-invoice/currency-detect";
import { exportInvoicePdf } from "@/lib/free-invoice/pdf";
import type { InvoiceTemplate } from "@/lib/free-invoice/templates";
import { A4Preview } from "./A4Preview";
import { BackupModal } from "./BackupModal";

// Code-split: the picker JS + the 9 header images load only when opened, so the
// landing page's initial payload stays light for SEO / Core Web Vitals.
const TemplatePicker = dynamic(() => import("./TemplatePicker").then((m) => m.TemplatePicker), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)]" />,
});

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB, client-side only

// Deterministic initial state so server and client render identically (no
// hydration mismatch). The unique id / invoice number are assigned on mount.
function seedInvoice(): FreeInvoice {
  return { ...createEmptyInvoice(), id: "", invoiceNumber: "INV-000000" };
}

export function FreeInvoiceTool() {
  const [inv, setInv] = useState<FreeInvoice>(seedInvoice);
  const [saved, setSaved] = useState<FreeInvoice[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [showBizDetails, setShowBizDetails] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showInvoiceMeta, setShowInvoiceMeta] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  const unsyncedCount = saved.filter((i) => !i.isSynced).length;
  // Progressive disclosure: keep cards compact, but auto-reveal the extra fields
  // whenever they already carry data (samples, restored drafts).
  const hasBizDetails = Boolean(inv.businessEmail || inv.businessPhone || inv.businessAddress);
  const bizDetailsOpen = showBizDetails || hasBizDetails;
  const hasClientDetails = Boolean(inv.clientAddress || inv.shipTo);
  const clientDetailsOpen = showClientDetails || hasClientDetails;

  async function downloadPdf() {
    setDownloading(true);
    try {
      await exportInvoicePdf("fi-paper", `${inv.invoiceNumber || "invoice"}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setDownloading(false);
    }
  }

  // Client-only mount: restore the last-open draft (redirect/reload safe) or give
  // the seed its real identifiers, and load the saved-invoices list.
  useEffect(() => {
    (async () => {
      const list = await getAllInvoices();
      setSaved(list);
      const active = list.find((i) => i.id === getActiveId());
      if (active) setInv(active);
      // New visitor / blank draft: open in the country-based (or last-picked) currency.
      else setInv((prev) => (prev.id ? prev : { ...prev, id: uuid(), invoiceNumber: nextInvoiceNumber(), currency: initialCurrency() }));
    })();
  }, []);

  // Autosave the current draft locally (debounced), skipping blank seeds.
  useEffect(() => {
    if (!inv.id || !hasContent(inv)) return;
    const t = setTimeout(async () => {
      await putInvoice(inv);
      setActiveId(inv.id);
      setSaved(await getAllInvoices());
    }, 600);
    return () => clearTimeout(t);
  }, [inv]);

  // Collapse the progressive-disclosure cards back to their compact state when
  // switching invoices (auto-open still kicks in for cards that carry data).
  function resetDisclosures() {
    setShowBizDetails(false);
    setShowClientDetails(false);
    setShowInvoiceMeta(false);
  }
  function applyTemplate(t: InvoiceTemplate) {
    if (t.id === "simple") {
      // Simple = solid band; keep the current colour rather than resetting it.
      set({ templateId: "simple", headerImage: null, titleColor: null });
    } else {
      set({ templateId: t.id, headerImage: t.headerImage, color: t.color, titleColor: t.titleColor ?? null });
    }
  }
  // "Surprise me": a random sample that already carries an industry-matched
  // template — so the header design, business and line items all fit together.
  function surpriseMe() {
    const s = randomSample();
    setInv(s);
    setActiveId(s.id);
    resetDisclosures();
  }
  function newInvoice() {
    const fresh = { ...createEmptyInvoice(), currency: initialCurrency() };
    setInv(fresh);
    setActiveId(fresh.id);
    resetDisclosures();
  }
  // Changing currency anywhere remembers it as the user's preference for next time.
  function changeCurrency(v: string) {
    set({ currency: v });
    setPreferredCurrency(v);
  }
  function openInvoice(id: string) {
    const found = saved.find((i) => i.id === id);
    if (found) {
      setInv(found);
      setActiveId(found.id);
      setShowSaved(false);
      resetDisclosures();
    }
  }
  async function removeSaved(id: string) {
    await deleteInvoice(id);
    setSaved(await getAllInvoices());
    if (id === inv.id) newInvoice();
  }

  const set = (patch: Partial<FreeInvoice>) =>
    setInv((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }));
  const setItem = (id: string, patch: Partial<FreeLineItem>) =>
    setInv((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      updatedAt: Date.now(),
    }));
  const addItem = () =>
    set({ items: [...inv.items, { id: uuid(), description: "", quantity: "1", rate: "" }] });
  const removeItem = (id: string) =>
    set({ items: inv.items.length > 1 ? inv.items.filter((it) => it.id !== id) : inv.items });

  function onLogo(file?: File | null) {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setLogoError("Please choose an image file.");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Logo must be under 2MB.");
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const totals = useMemo(() => totalsFor(inv), [inv]);
  const renderData = useMemo(() => toRenderData(inv), [inv]);
  const cur = inv.currency;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] xl:grid-cols-[minmax(0,28fr)_minmax(0,54fr)_minmax(0,18fr)] xl:gap-6">
      {/* ---------------- LEFT: data entry form ---------------- */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={surpriseMe}>
            ✨ Surprise me
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={newInvoice}>
            + New invoice
          </Button>
          {saved.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSaved((v) => !v)}>
              {showSaved ? "Hide" : "Saved"} invoices ({saved.length})
            </Button>
          )}
        </div>

        {showSaved && saved.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-2">
            <ul className="divide-y divide-[var(--color-outline-variant)]">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-2 py-2.5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openInvoice(s.id)}>
                    <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">
                      {s.invoiceNumber} · {s.clientName || "No client"}
                      {s.id === inv.id && <span className="ml-2 rounded bg-[var(--color-primary-container)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-on-primary-container)]">Editing</span>}
                    </p>
                    <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                      {formatMoney(totalsFor(s).total, s.currency)} · updated {formatDate(new Date(s.updatedAt).toISOString().slice(0, 10))}
                    </p>
                  </button>
                  <button type="button" aria-label="Delete saved invoice" className="rounded-full p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]" onClick={() => removeSaved(s.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Section title="Your business">
          {/* Compact first look — logo tile + business name, bottom-aligned so
              the tile and the input line up cleanly (tile height = label+input). */}
          <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              aria-label={inv.logoDataUrl ? "Change logo" : "Upload logo"}
              className="flex h-[70px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-variant)] text-center text-[11px] font-semibold leading-tight text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary)]"
            >
              {inv.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inv.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span>＋<br />Logo</span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <TextField label="Business name" placeholder="Acme Studio" value={inv.businessName} onChange={(e) => set({ businessName: e.target.value })} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="font-semibold text-[var(--color-primary)]" onClick={() => logoInput.current?.click()}>
              {inv.logoDataUrl ? "Change logo" : "Upload logo"}
            </button>
            {inv.logoDataUrl && (
              <button type="button" className="font-medium text-[var(--color-error)]" onClick={() => set({ logoDataUrl: null })}>Remove</button>
            )}
          </div>
          {logoError && <p className="mt-1.5 text-xs font-medium text-[var(--color-error)]">{logoError}</p>}

          {/* Extra details revealed only on demand (or when already filled). */}
          {!bizDetailsOpen ? (
            <DisclosureToggle open={false} label="Add email, phone & address" onToggle={() => setShowBizDetails(true)} />
          ) : (
            <div className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Email" type="email" placeholder="you@business.com" value={inv.businessEmail} onChange={(e) => set({ businessEmail: e.target.value })} />
                <TextField label="Phone" placeholder="+1 (555) 000-0000" value={inv.businessPhone} onChange={(e) => set({ businessPhone: e.target.value })} />
                <div className="sm:col-span-2">
                  <TextField label="Address" placeholder="Street, City, ZIP" value={inv.businessAddress} onChange={(e) => set({ businessAddress: e.target.value })} />
                </div>
              </div>
              {!hasBizDetails && (
                <DisclosureToggle open label="Hide details" onToggle={() => setShowBizDetails(false)} />
              )}
            </div>
          )}
        </Section>

        <Section title="Bill to">
          {/* Compact by default — name + email are what shows on the invoice. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Client name" placeholder="Client or company" value={inv.clientName} onChange={(e) => set({ clientName: e.target.value })} />
            <TextField label="Client email" type="email" placeholder="client@email.com" value={inv.clientEmail} onChange={(e) => set({ clientEmail: e.target.value })} />
          </div>
          {!clientDetailsOpen ? (
            <DisclosureToggle open={false} label="Add address & ship-to" onToggle={() => setShowClientDetails(true)} />
          ) : (
            <div className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Client address" placeholder="Street, City, ZIP" value={inv.clientAddress} onChange={(e) => set({ clientAddress: e.target.value })} />
                <TextField label="Ship to (optional)" placeholder="If different" value={inv.shipTo} onChange={(e) => set({ shipTo: e.target.value })} />
              </div>
              {!hasClientDetails && (
                <DisclosureToggle open label="Hide details" onToggle={() => setShowClientDetails(false)} />
              )}
            </div>
          )}
        </Section>

        <Section title="Line items" action={<CurrencySelect value={cur} onChange={changeCurrency} />}>
          <div className="flex flex-col gap-3">
            {inv.items.map((it, i) => {
              const amount = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
              return (
                <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 text-xs font-bold text-[var(--color-on-surface-variant)]">{i + 1}</span>
                    <div className="flex-1">
                      <TextField placeholder="Description of work or item" value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })} />
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <TextField placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(it.id, { quantity: e.target.value })} />
                        <TextField placeholder="Rate" inputMode="decimal" value={it.rate} onChange={(e) => setItem(it.id, { rate: e.target.value })} />
                        <div className="flex h-11 items-center justify-end rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)] px-3 text-sm font-bold">
                          {formatMoney(amount, cur)}
                        </div>
                      </div>
                    </div>
                    <button type="button" aria-label="Remove item" className="mt-1.5 rounded-full p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)] disabled:opacity-30" disabled={inv.items.length === 1} onClick={() => removeItem(it.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add line item</Button>
            </div>
          </div>
        </Section>

        <Section title="Totals & adjustments">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Tax rate (%)" inputMode="decimal" placeholder="0" value={inv.taxRate} onChange={(e) => set({ taxRate: e.target.value })} />
            <TextField label="Shipping" inputMode="decimal" placeholder="0" value={inv.shippingCost} onChange={(e) => set({ shippingCost: e.target.value })} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--color-on-surface)]">Discount</label>
              <div className="flex gap-2">
                <TextField className="flex-1" inputMode="decimal" placeholder="0" value={inv.discountValue} onChange={(e) => set({ discountValue: e.target.value })} />
                <Toggle
                  value={inv.discountType}
                  onChange={(v) => set({ discountType: v })}
                  options={[{ value: "PERCENTAGE", label: "%" }, { value: "FIXED", label: cur }]}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-[var(--color-outline-variant)] pt-3 text-sm">
            <TotalLine label="Subtotal" value={formatMoney(totals.subtotal, cur)} />
            {totals.discountAmount > 0 && <TotalLine label="Discount" value={`- ${formatMoney(totals.discountAmount, cur)}`} />}
            {totals.taxAmount > 0 && <TotalLine label="Tax" value={formatMoney(totals.taxAmount, cur)} />}
            {totals.shippingCost > 0 && <TotalLine label="Shipping" value={formatMoney(totals.shippingCost, cur)} />}
            <div className="flex items-center justify-between pt-1 text-base font-extrabold text-[var(--color-primary)]">
              <span>Total</span>
              <span>{formatMoney(totals.total, cur)}</span>
            </div>
          </div>
        </Section>

        <Section title="Invoice details">
          {/* Auto-filled — collapsed to a compact summary strip so users reach
              the important fields first. Expand to edit. */}
          {!showInvoiceMeta ? (
            <button
              type="button"
              onClick={() => setShowInvoiceMeta(true)}
              aria-expanded={false}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 truncate text-sm text-[var(--color-on-surface-variant)]">
                <span className="font-bold text-[var(--color-on-surface)]">{inv.invoiceNumber}</span>
                {" · Issued "}{formatDate(inv.issueDate)}
                {inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}
                {inv.paymentTerms ? ` · ${inv.paymentTerms}` : ""}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--color-primary)]">
                Edit <Chevron open={false} />
              </span>
            </button>
          ) : (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Invoice number" value={inv.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
                <TextField label="Payment terms" placeholder="Net 14" value={inv.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
                <TextField label="Issue date" type="date" value={inv.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
                <TextField label="Due date" type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
                <div className="sm:col-span-2">
                  <TextField label="PO number" placeholder="Optional" value={inv.poNumber} onChange={(e) => set({ poNumber: e.target.value })} />
                </div>
              </div>
              <DisclosureToggle open label="Hide details" onToggle={() => setShowInvoiceMeta(false)} />
            </div>
          )}
        </Section>

        <Section title="Notes & terms">
          <div className="grid gap-3">
            <Textarea label="Notes" placeholder="Thank you for your business!" value={inv.notes} onChange={(v) => set({ notes: v })} />
            <Textarea label="Terms" placeholder="Payment due within 14 days." value={inv.terms} onChange={(v) => set({ terms: v })} />
          </div>
        </Section>
      </div>

      {/* ---------------- CENTER: live A4 preview ---------------- */}
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <A4Preview currency={cur} onCurrencyChange={changeCurrency}>
          <InvoiceDocument data={renderData} />
        </A4Preview>
      </div>

      {/* ---------------- RIGHT: actions + templates rail ---------------- */}
      <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
        <div className="flex flex-col gap-4">
          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="md" loading={downloading} onClick={downloadPdf} className="flex-1 xl:w-full xl:flex-none">
              ⬇ Download PDF
            </Button>
            <Button type="button" variant="outline" size="md" onClick={() => setBackupOpen(true)} className="flex-1 xl:w-full xl:flex-none">
              ☁ Back up my invoices
            </Button>
            <span className="w-full text-xs text-[var(--color-on-surface-variant)]">Download is free · no sign-up needed</span>
          </div>

          {/* Templates — always visible; images lazy-load so the page stays light */}
          <div>
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Templates</h3>
            <TemplatePicker selectedId={inv.templateId} currentColor={inv.color} onSelect={applyTemplate} />
          </div>
        </div>
      </div>

      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} count={unsyncedCount} />
    </div>
  );
}

/* ---------- small local UI helpers (match the app's tokens) ---------- */

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-on-surface-variant)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Compact global currency dropdown — shares the single `inv.currency` state, so
// changing it here updates line items, totals and the preview at once.
function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        aria-label="Invoice currency"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface)] pl-3 pr-7 text-xs font-bold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[var(--color-on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
    </span>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[var(--color-on-surface-variant)]">
      <span className="font-semibold">{label}</span>
      <span className="font-semibold text-[var(--color-on-surface)]">{value}</span>
    </div>
  );
}

// Chevron that points down when collapsed, up when open — shared by all the
// progressive-disclosure toggles so they feel identical.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Consistent "Add …" / "Hide details" toggle used by the Business, Bill To and
// Invoice Details cards.
function DisclosureToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline",
        open ? "text-[var(--color-on-surface-variant)]" : "text-[var(--color-primary)]",
      )}
    >
      <Chevron open={open} />
      {label}
    </button>
  );
}

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 min-w-11 px-3 text-sm font-bold",
            value === o.value ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface)] text-[var(--color-on-surface-variant)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[var(--color-on-surface)]">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="min-h-[64px] rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
    </div>
  );
}
