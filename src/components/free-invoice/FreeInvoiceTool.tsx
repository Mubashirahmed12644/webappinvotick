"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { totalsFor } from "@/lib/free-invoice/adapter";
import type { FreeInvoiceController } from "./useFreeInvoice";
import { A4Preview } from "./A4Preview";

// Code-split: the picker JS + the 9 header images load only when opened, so the
// landing page's initial payload stays light for SEO / Core Web Vitals.
const TemplatePicker = dynamic(() => import("./TemplatePicker").then((m) => m.TemplatePicker), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)]" />,
});

/**
 * The full editor — every field the free tool has, in one scrolling page.
 *
 * **It owns no state.** The draft, the autosave, the funnel events and the PDF all live in
 * `useFreeInvoice`, which the guided flow holds (decision 0165), because there is one invoice on
 * this page and two views of it. Everything below was left exactly as it was; only the `useState`
 * and `useEffect` calls moved out, so nothing here fires at a different moment than it used to.
 *
 * The two things this component no longer renders, and why neither is an omission: the hidden
 * file input belongs to the shell (one input, one ref — see `useFreeInvoice`), and `BackupModal` /
 * `InstallOffer` belong to the shell too, so a download from step 4 and a download from here put
 * up exactly one of each.
 */
export function FreeInvoiceTool({ fi, onPickLogo }: { fi: FreeInvoiceController; onPickLogo: () => void }) {
  const {
    inv, set, setItem, addItem, removeItem,
    saved, showSaved, setShowSaved, openInvoice, removeSaved,
    surpriseMe, newInvoice, changeCurrency, applyTemplate, noteTyping,
    downloadPdf, downloading, setBackupOpen,
    logoError,
    setShowBizDetails, bizDetailsOpen, hasBizDetails,
    setShowClientDetails, clientDetailsOpen, hasClientDetails,
    showInvoiceMeta, setShowInvoiceMeta,
    totals, renderData, currencies,
  } = fi;
  const cur = inv.currency;

  return (
    /*
      `grid-cols-1` is load-bearing on a phone and was missing.

      Below `lg` this grid had no column definition at all, so the single implicit column was
      `auto` — sized to the widest thing inside it. The widest thing is `#fi-paper`, which is a
      FIXED `width: 794px` element shrunk with `transform: scale()`, and a transform does not
      change what an element occupies in layout. So the column asked for 478 px inside a 343 px
      page, and every card, label and input in the form was drawn past the right edge of a 375 px
      phone with the page quietly scrolling sideways to cover it.

      Measured on `65a6bab` — the build live today, before this change: `clientWidth` 375,
      `scrollWidth` 494, `grid-template-columns: 478.531px`. So this is not new, and on the page
      that takes 88.5 % of the non-Pakistan traffic it has been true the whole time.

      `grid-cols-1` is `repeat(1, minmax(0, 1fr))`: a column that is exactly the container, with a
      floor of 0 so a fixed-width child cannot push it open. `min-w-0` on each child is the same
      rule one level down — a grid item's automatic minimum is its min-content, which is the other
      half of how 794 px escapes.
    */
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] xl:grid-cols-[minmax(0,28fr)_minmax(0,54fr)_minmax(0,18fr)] xl:gap-6">
      {/* ---------------- LEFT: data entry form ---------------- */}
      <div className="flex min-w-0 flex-col gap-5">
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
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => onPickLogo()}
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
              {/* NOT `fi-business-name`: that id belongs to the guided flow's step 1, which is what
                  the landing focuses after the CTA press. Both views are in the document at once
                  (the editor is hidden, not unmounted), so one id on both would be a duplicate —
                  invalid, and it silently breaks whichever `<label for>` loses. */}
              <TextField id="fi-editor-business-name" label="Business name" placeholder="Acme Studio" value={inv.businessName} onChange={(e) => { noteTyping("business", e.target.value); set({ businessName: e.target.value }); }} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="font-semibold text-[var(--color-primary)]" onClick={() => onPickLogo()}>
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
            <TextField label="Client name" placeholder="Client or company" value={inv.clientName} onChange={(e) => { noteTyping("client", e.target.value); set({ clientName: e.target.value }); }} />
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

        <Section title="Line items" action={<CurrencySelect value={cur} onChange={changeCurrency} options={currencies} />}>
          <div className="flex flex-col gap-3">
            {inv.items.map((it, i) => {
              const amount = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
              return (
                <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 text-xs font-bold text-[var(--color-on-surface-variant)]">{i + 1}</span>
                    {/* `min-w-0`: a flex item's automatic minimum is its min-content, so without it
                        this column could not shrink below the width the inputs inside it wanted. */}
                    <div className="min-w-0 flex-1">
                      <TextField placeholder="Description of work or item" value={it.description} onChange={(e) => { noteTyping("item", e.target.value); setItem(it.id, { description: e.target.value }); }} />
                      {/*
                        Qty and Rate share a row; the amount gets a row of its own, at every width.

                        It used to be a third cell in `grid-cols-3`. At 375 px that is a 72 px box,
                        and a real line total — `Rs1,284,500.75` — is about 105 px, so it was drawn
                        straight across the Rate field the user had just typed into. Measured, not
                        predicted. `LAYOUT_RULES.md` names both halves of this: never assume two
                        things fit side by side, and money shrinks or wraps but is never cut — and a
                        computed total lying on top of the number it was computed from is worse than
                        either, because it makes the arithmetic itself look wrong (G3).

                        Its own row cannot overlap anything, at any width or font scale. The row
                        wraps rather than squeezing, so when the money and its label stop fitting
                        together the LABEL gives way and the figure stays whole.
                      */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <TextField placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(it.id, { quantity: e.target.value })} />
                        <TextField placeholder="Rate" inputMode="decimal" value={it.rate} onChange={(e) => setItem(it.id, { rate: e.target.value })} />
                        <div className="col-span-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)] px-3 py-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
                            Amount
                          </span>
                          {/*
                            `min-w-0` + `overflow-wrap` measured 2026-09-24: at 375 px with a 1.5×
                            font the figure was painted 4 px past the right edge of its own pill.
                            Small, and still money drawn outside its box. The row already lets the
                            LABEL give way; this is the floor under that, for a figure wider than
                            the whole row — it wraps rather than escaping, because the rule is that
                            money is never cut, not that it never wraps.
                          */}
                          <span className="min-w-0 text-sm font-bold tabular-nums text-[var(--color-on-surface)]" style={{ overflowWrap: "anywhere" }}>
                            {formatMoney(amount, cur)}
                          </span>
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
      <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
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
function CurrencySelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        aria-label="Invoice currency"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface)] pl-3 pr-7 text-xs font-bold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {options.map((c) => (
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
