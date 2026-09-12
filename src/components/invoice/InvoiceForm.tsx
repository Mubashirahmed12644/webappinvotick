"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { discountTypeOf, typeWord, type DiscountType } from "@/lib/invoice-calc";
import { nextBusinessInvoiceNumber } from "@/lib/invoice-number";
import {
  editBlocker,
  formRowFromSaved,
  invoicePreviewData,
  keptInvoiceFields,
  newFormRow,
  newId,
  prepareInvoice,
  type FormItem,
  type SavedInvoiceItem,
} from "@/lib/invoice-preview";
import { InvoicePreviewDialog } from "./InvoicePreviewDialog";
import type { Business, Product, Tax, InvoiceDetail, Template, InvoiceAsset } from "@/lib/data";
import type { Client, InvoiceStatus } from "@/lib/types";

interface Props {
  businesses: Business[];
  clients: Client[];
  products: Product[];
  taxes: Tax[];
  templates?: Template[];
  signatures?: InvoiceAsset[];
  stamps?: InvoiceAsset[];
  /** Header and background images, so Preview draws a template the way the saved invoice will. */
  headers?: InvoiceAsset[];
  backgrounds?: InvoiceAsset[];
  invoice?: InvoiceDetail;
  /** The edited invoice's items as its page shows them (getInvoiceItemsForEdit). */
  savedItems?: SavedInvoiceItem[];
  /** The business to start with: the one chosen on the invoices page, or the invoice's own. */
  initialBusinessId?: string | null;
  /** Invoice numbers already taken, so a new invoice continues its business's series. */
  takenNumbers?: { businessId?: string | null; invoiceNumber: string }[];
}

const STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];
const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceForm({
  businesses,
  clients,
  products,
  taxes,
  templates = [],
  signatures = [],
  stamps = [],
  headers = [],
  backgrounds = [],
  invoice,
  savedItems = [],
  initialBusinessId = null,
  takenNumbers = [],
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(invoice);
  // An invoice whose own tax this form cannot show is not saved over from here (editBlocker).
  const blocker = isEdit ? editBlocker(invoice) : null;
  const [templateId, setTemplateId] = useState(invoice?.templateId ?? templates[0]?.id ?? "");
  const [signatureId, setSignatureId] = useState(invoice?.signatureId ?? "");
  const [stampId, setStampId] = useState(invoice?.stampId ?? "");
  const selectedTemplate = templates.find((t) => t.id === templateId);
  // Preview only shows (the owner, 2026-09-11): it opens before a business is chosen and saves nothing.
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // Every invoice is issued from a business — the owner's rule, 2026-09-11. This form had no such
  // field, so INV-69850 reached the server with none. A client belongs to one business, so the
  // client list follows the business chosen here, and choosing a client picks its business.
  const knownBusiness = (id?: string | null) => (id && businesses.some((b) => b.id === id) ? id : "");
  const businessOfClient = (id: string) => clients.find((c) => c.id === id)?.businessId ?? null;
  const [businessId, setBusinessId] = useState(() =>
    invoice
      ? knownBusiness(initialBusinessId) || knownBusiness(businessOfClient(invoice.clientId))
      : knownBusiness(initialBusinessId) || (businesses.length === 1 ? businesses[0].id : ""),
  );
  const numberFor = (id: string) => {
    const b = businesses.find((x) => x.id === id);
    if (!b) return "";
    return nextBusinessInvoiceNumber(b.name, takenNumbers.filter((t) => t.businessId === b.id).map((t) => t.invoiceNumber));
  };

  const [clientId, setClientId] = useState(invoice?.clientId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(() => invoice?.invoiceNumber ?? numberFor(businessId));
  // A number the user typed is theirs; only a number this form wrote follows a change of business.
  const [numberTyped, setNumberTyped] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate ?? today());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? today());
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "DRAFT");
  const [currency, setCurrency] = useState(
    () => invoice?.currency ?? (businesses.find((b) => b.id === businessId)?.currencyCode?.toUpperCase() || "USD"),
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [discountValue, setDiscountValue] = useState(invoice?.discountValue && Number(invoice.discountValue) ? invoice.discountValue : "");
  const [discountType, setDiscountType] = useState<DiscountType>(discountTypeOf(invoice?.discountType));
  const [taxId, setTaxId] = useState("");
  const [shipping, setShipping] = useState(invoice?.shippingCost && Number(invoice.shippingCost) ? invoice.shippingCost : "");
  // A saved item starts as the invoice's page shows it, with its own tax and its links. Rows are made
  // here and in Add item only, each with its product id (newFormRow), and kept in state from then on.
  const [items, setItems] = useState<FormItem[]>(() => (savedItems.length ? savedItems.map(formRowFromSaved) : [newFormRow()]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each row's own problem shows beside it once Save has been tried; the Summary never counts it.
  const [showRowProblems, setShowRowProblems] = useState(false);

  const selectedTax = taxes.find((t) => t.id === taxId);
  const shownClients = businessId ? clients.filter((c) => !c.businessId || c.businessId === businessId) : clients;

  // What Save sends, and what the Summary and the Preview show: the rows read once, the totals over
  // exactly the rows that go, and what stands in the way (prepareInvoice).
  const prepared = useMemo(
    () => prepareInvoice({ rows: items, discountValue, discountType, taxRate: selectedTax?.rate ?? 0, shipping }),
    [items, discountValue, discountType, selectedTax, shipping],
  );
  const totals = prepared.totals;
  const sentFields = new Map(prepared.sent.map((s) => [s.row.id, s.fields] as const));

  function chooseBusiness(id: string) {
    setBusinessId(id);
    const clientBusiness = clientId ? businessOfClient(clientId) : null;
    const keepsClient = Boolean(clientId) && (!clientBusiness || clientBusiness === id);
    if (clientId && !keepsClient) setClientId("");
    if (!isEdit && !numberTyped) setInvoiceNumber(numberFor(id));
    const cc = businesses.find((b) => b.id === id)?.currencyCode;
    if (cc && !keepsClient) setCurrency(cc.toUpperCase());
  }

  function chooseClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c?.currencyCode) setCurrency(c.currencyCode.toUpperCase());
    const cb = knownBusiness(c?.businessId);
    if (cb && cb !== businessId) {
      setBusinessId(cb);
      if (!isEdit && !numberTyped) setInvoiceNumber(numberFor(cb));
    }
  }

  function updateItem(id: string, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function pickProduct(id: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (p) updateItem(id, { inventoryItemId: p.id, name: p.name, unitPrice: p.unitPrice });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (blocker) return setError(blocker);
    if (!businessId) return setError("Please choose a business — every invoice is issued from one.");
    if (!clientId) return setError("Please choose a client.");
    const clientBusiness = businessOfClient(clientId);
    if (clientBusiness && clientBusiness !== businessId) return setError("This client belongs to another business.");
    if (prepared.problems.length) {
      setShowRowProblems(true);
      return setError(prepared.problems.join("\n"));
    }

    const invoiceId = invoice?.id ?? newId();
    // Exactly the rows prepareInvoice read, each with the fields it computed; the totals are theirs.
    const payloadItems = prepared.sent.map(({ row, fields }) => ({
      id: row.id, invoiceId,
      // The row's own product id, never one made here: the server makes a product for a typed row's
      // id, so a retry must send the same id to find it rather than make another (FormItem).
      inventoryItemId: row.inventoryItemId,
      // A saved item's links go back as it has them: the update copies each, and a null erases it.
      taxId: row.taxId, unitTypeId: row.unitTypeId, itemCategoryId: row.itemCategoryId,
      ...fields,
    }));

    const payload = {
      id: invoiceId, businessId, clientId, invoiceNumber, invoiceDate, dueDate,
      subtotal: totals.subtotal, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount,
      shippingCost: totals.shippingCost, totalAmount: totals.total, status,
      // Sent even when cleared: the update keeps the old discount when it is sent null. The type goes
      // as the word the app reads (typeWord), never FIXED.
      discountType: typeWord(discountType), discountValue: prepared.discountValue,
      taxId: taxId || null, notes: notes || null,
      templateId: templateId || null, signatureId: signatureId || null, stampId: stampId || null, currency,
      // What the form does not show goes back as the invoice has it: the update would erase a null.
      ...keptInvoiceFields(invoice),
      items: payloadItems,
      // The items are the invoice's whole list, so an edit asks the server to remove a saved item the
      // list leaves out: without it the update only adds and changes items, and Remove would take an
      // item off the totals while the server kept it. Create ignores it.
      replaceItems: isEdit,
    };

    setSaving(true);
    try {
      const url = isEdit ? `/api/invoices/${invoiceId}` : "/api/invoices";
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) return setError(data.message || "Could not save the invoice.");
      router.push(`/invoices/${invoiceId}`);
      router.refresh();
    } catch {
      setError("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  const labelCls = "text-sm font-semibold text-[var(--color-on-surface)]";
  const selectCls = "h-11 rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

  const saveLabel = isEdit ? "Save changes" : "Create invoice";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{isEdit ? "Edit invoice" : "New invoice"}</h1>
        <div className="flex gap-2">
          {/* Enabled before a business is chosen, on purpose: a preview may come first, an invoice may not. */}
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button type="submit" loading={saving}>{saveLabel}</Button>
        </div>
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>
      )}
      {blocker && error !== blocker && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-secondary-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-secondary-container)]">{blocker}</div>
      )}

      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Business</label>
            {businesses.length === 0 ? (
              <p className="text-sm text-[var(--color-on-surface-variant)]">
                An invoice is issued from a business, and you have none yet.{" "}
                <Link href="/settings/business/new" className="font-semibold text-[var(--color-primary)] hover:underline">Add a business</Link>
              </p>
            ) : (
              <select value={businessId} onChange={(e) => chooseBusiness(e.target.value)} className={selectCls} aria-required="true">
                <option value="">Select a business…</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Client</label>
            <select value={clientId} onChange={(e) => chooseClient(e.target.value)} className={selectCls}>
              <option value="">Select a client…</option>
              {shownClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <TextField
            label="Invoice number"
            value={invoiceNumber}
            placeholder={businessId ? undefined : "Set by the business"}
            onChange={(e) => { setInvoiceNumber(e.target.value); setNumberTyped(true); }}
          />
          <TextField label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} className={selectCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
      </Card>

      {(templates.length > 0 || signatures.length > 0 || stamps.length > 0) && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-[var(--color-on-surface)]">Design</h2>
            {selectedTemplate && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedTemplate.color }} /> theme color
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {templates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Template</label>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={selectCls}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {signatures.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Signature</label>
                <select value={signatureId} onChange={(e) => setSignatureId(e.target.value)} className={selectCls}>
                  <option value="">None</option>
                  {signatures.map((s) => <option key={s.id} value={s.id}>{s.name || "Signature"}</option>)}
                </select>
              </div>
            )}
            {stamps.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Stamp</label>
                <select value={stampId} onChange={(e) => setStampId(e.target.value)} className={selectCls}>
                  <option value="">None</option>
                  {stamps.map((s) => <option key={s.id} value={s.id}>{s.name || "Stamp"}</option>)}
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-[var(--color-on-surface)]">Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, newFormRow()])}>+ Add item</Button>
        </div>
        <div className="space-y-3">
          {items.map((it, idx) => {
            // Only a row that will be sent has an amount, and the Summary adds up exactly these.
            const fields = sentFields.get(it.id);
            const problem = showRowProblems ? prepared.rowProblems[idx] : null;
            return (
              <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  {/* A typed row's own product id is in no list, so its picker shows the placeholder. */}
                  {products.length > 0 && (
                    <select value={products.some((p) => p.id === it.inventoryItemId) ? it.inventoryItemId : ""} onChange={(e) => pickProduct(it.id, e.target.value)} className={cn(selectCls, "sm:col-span-12 h-9")}>
                      <option value="">Pick a product (optional)…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.unitPrice, currency)}</option>)}
                    </select>
                  )}
                  <input placeholder="Item name" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} className={cn(selectCls, "sm:col-span-5 h-9")} />
                  <input placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <input placeholder="Unit price" inputMode="decimal" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })} className={cn(selectCls, "sm:col-span-3 h-9")} />
                  <div className="flex items-center justify-end sm:col-span-2">
                    <span className="text-sm font-bold text-[var(--color-on-surface)]">{fields ? formatMoney(fields.netPrice * fields.quantity, currency) : "—"}</span>
                  </div>
                  <input placeholder="Discount" inputMode="decimal" value={it.discountValue} onChange={(e) => updateItem(it.id, { discountValue: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <select value={it.discountType} onChange={(e) => updateItem(it.id, { discountType: e.target.value as DiscountType })} className={cn(selectCls, "sm:col-span-2 h-9")}>
                    <option value="PERCENTAGE">%</option>
                    <option value="FLAT">Fixed</option>
                  </select>
                  {/* Sent as the item's own tax (taxRate, taxType, taxAmount), a saved item's as well. */}
                  <input placeholder="Item tax %" inputMode="decimal" value={it.taxValue} onChange={(e) => updateItem(it.id, { taxValue: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <div className="flex items-center sm:col-span-6 sm:justify-end">
                    {/* A saved item too: an edit sends the whole list with replaceItems, so the server
                        removes the item the list no longer carries. */}
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="text-sm font-semibold text-[var(--color-error)] hover:underline">
                        Remove item {idx + 1}
                      </button>
                    )}
                  </div>
                </div>
                {problem && <p className="mt-2 text-xs font-medium text-[var(--color-error)]">{problem}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-[var(--color-on-surface)]">Adjustments</h2>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Discount" inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className={selectCls}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Fixed</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tax</label>
            <select value={taxId} onChange={(e) => setTaxId(e.target.value)} className={selectCls}>
              <option value="">No tax</option>
              {taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({Number(t.rate)}%)</option>)}
            </select>
          </div>
          <TextField label="Shipping" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(selectCls, "h-auto py-2")} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-[var(--color-on-surface)]">Summary</h2>
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            {totals.discountAmount > 0 && <Row label="Discount" value={`- ${formatMoney(totals.discountAmount, currency)}`} />}
            {totals.taxAmount > 0 && <Row label="Tax" value={formatMoney(totals.taxAmount, currency)} />}
            {totals.shippingCost > 0 && <Row label="Shipping" value={formatMoney(totals.shippingCost, currency)} />}
            <div className="flex justify-between border-t border-[var(--color-outline-variant)] pt-2">
              <span className="font-bold text-[var(--color-on-surface)]">Total</span>
              <span className="text-lg font-extrabold text-[var(--color-primary)]">{formatMoney(totals.total, currency)}</span>
            </div>
          </div>
        </Card>
      </div>
      {previewOpen && (
        <InvoicePreviewDialog
          // Built from what Create would send, read back the way the saved invoice's page reads it.
          data={invoicePreviewData({
            invoiceNumber, invoiceDate, dueDate, status, currency, notes,
            poNumber: invoice?.poNumber ?? null,
            items: prepared.sent.map((s) => s.fields),
            totals,
            business: businesses.find((b) => b.id === businessId) ?? null,
            client: clients.find((c) => c.id === clientId) ?? null,
            template: selectedTemplate ?? null,
            signatureId, stampId, signatures, stamps, headers, backgrounds,
          })}
          businessMissing={!businessId}
          problems={prepared.problems}
          saveLabel={saveLabel}
          onClose={closePreview}
        />
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--color-on-surface-variant)]">{label}</span>
      <span className="font-semibold text-[var(--color-on-surface)]">{value}</span>
    </div>
  );
}
