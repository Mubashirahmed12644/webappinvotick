"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { computeInvoiceTotals, computeLineItem, type DiscountType } from "@/lib/invoice-calc";
import type { Product, Tax, InvoiceDetail, Template, InvoiceAsset } from "@/lib/data";
import type { Client, InvoiceStatus } from "@/lib/types";

interface FormItem {
  id: string;
  inventoryItemId: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountValue: string;
  discountType: DiscountType;
  taxValue: string;
}

interface Props {
  clients: Client[];
  products: Product[];
  taxes: Tax[];
  templates?: Template[];
  signatures?: InvoiceAsset[];
  stamps?: InvoiceAsset[];
  invoice?: InvoiceDetail;
}

const STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
const today = () => new Date().toISOString().slice(0, 10);

function blankItem(): FormItem {
  return { id: uuid(), inventoryItemId: "", name: "", description: "", quantity: "1", unitPrice: "", discountValue: "", discountType: "PERCENTAGE", taxValue: "" };
}

export function InvoiceForm({ clients, products, taxes, templates = [], signatures = [], stamps = [], invoice }: Props) {
  const router = useRouter();
  const isEdit = Boolean(invoice);
  const [templateId, setTemplateId] = useState(invoice?.templateId ?? templates[0]?.id ?? "");
  const [signatureId, setSignatureId] = useState(invoice?.signatureId ?? "");
  const [stampId, setStampId] = useState(invoice?.stampId ?? "");
  const selectedTemplate = templates.find((t) => t.id === templateId);

  const [clientId, setClientId] = useState(invoice?.clientId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? `INV-${Date.now().toString().slice(-5)}`);
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate ?? today());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? today());
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "DRAFT");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [discountValue, setDiscountValue] = useState(invoice?.discountValue && Number(invoice.discountValue) ? invoice.discountValue : "");
  const [discountType, setDiscountType] = useState<DiscountType>((invoice?.discountType as DiscountType) ?? "PERCENTAGE");
  const [taxId, setTaxId] = useState("");
  const [shipping, setShipping] = useState(invoice?.shippingCost && Number(invoice.shippingCost) ? invoice.shippingCost : "");
  const [items, setItems] = useState<FormItem[]>(
    invoice?.items?.length
      ? invoice.items.map((it) => ({
          id: it.id, inventoryItemId: "", name: it.name, description: it.description ?? "",
          quantity: String(Number(it.quantity)), unitPrice: String(Number(it.unitPrice)),
          discountValue: it.discount ? String(Number(it.discount)) : "", discountType: (it.discountType as DiscountType) ?? "PERCENTAGE", taxValue: "",
        }))
      : [blankItem()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTax = taxes.find((t) => t.id === taxId);

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items: items.map((it) => ({ name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, discountValue: it.discountValue, discountType: it.discountType, taxValue: it.taxValue })),
        invoiceDiscountValue: discountValue,
        invoiceDiscountType: discountType,
        invoiceTaxRate: selectedTax?.rate ?? 0,
        shippingCost: shipping,
      }),
    [items, discountValue, discountType, selectedTax, shipping],
  );

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
    if (!clientId) return setError("Please choose a client.");
    if (items.length === 0 || items.every((i) => !i.name)) return setError("Add at least one item.");

    const invoiceId = invoice?.id ?? uuid();
    const payloadItems = items
      .filter((it) => it.name)
      .map((it) => {
        const c = computeLineItem({ quantity: it.quantity, unitPrice: it.unitPrice, discountValue: it.discountValue, discountType: it.discountType, taxValue: it.taxValue });
        return {
          id: it.id, invoiceId, inventoryItemId: it.inventoryItemId || uuid(),
          taxId: null, unitTypeId: null, itemCategoryId: null,
          name: it.name, description: it.description || null,
          quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0, netPrice: c.netPrice,
          discount: it.discountValue ? Number(it.discountValue) : null,
          discountType: it.discountValue ? it.discountType : null,
        };
      });

    const payload = {
      id: invoiceId, clientId, invoiceNumber, invoiceDate, dueDate, poNumber: null,
      subtotal: totals.subtotal, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount,
      shippingCost: totals.shippingCost, totalAmount: totals.total, status,
      discountType: discountValue ? discountType : null, discountValue: discountValue ? Number(discountValue) : null,
      taxId: taxId || null, termsId: null, paymentMethodId: null, notes: notes || null,
      templateId: templateId || null, signatureId: signatureId || null, stampId: stampId || null, language: null, currency,
      signatureOffset: null, stampOffset: null, signatureScale: null, stampScale: null,
      items: payloadItems,
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{isEdit ? "Edit invoice" : "New invoice"}</h1>
        <Button type="submit" loading={saving}>{isEdit ? "Save changes" : "Create invoice"}</Button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>
      )}

      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Client</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const cc = clients.find((c) => c.id === e.target.value)?.currencyCode;
                if (cc) setCurrency(cc.toUpperCase());
              }}
              className={selectCls}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <TextField label="Invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
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
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, blankItem()])}>+ Add item</Button>
        </div>
        <div className="space-y-3">
          {items.map((it, idx) => {
            const c = computeLineItem({ quantity: it.quantity, unitPrice: it.unitPrice, discountValue: it.discountValue, discountType: it.discountType, taxValue: it.taxValue });
            return (
              <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  {products.length > 0 && (
                    <select value={it.inventoryItemId} onChange={(e) => pickProduct(it.id, e.target.value)} className={cn(selectCls, "sm:col-span-12 h-9")}>
                      <option value="">Pick a product (optional)…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.unitPrice, currency)}</option>)}
                    </select>
                  )}
                  <input placeholder="Item name" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} className={cn(selectCls, "sm:col-span-5 h-9")} />
                  <input placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <input placeholder="Unit price" inputMode="decimal" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })} className={cn(selectCls, "sm:col-span-3 h-9")} />
                  <div className="flex items-center justify-end sm:col-span-2">
                    <span className="text-sm font-bold text-[var(--color-on-surface)]">{formatMoney(c.lineTotal, currency)}</span>
                  </div>
                  <input placeholder="Discount" inputMode="decimal" value={it.discountValue} onChange={(e) => updateItem(it.id, { discountValue: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <select value={it.discountType} onChange={(e) => updateItem(it.id, { discountType: e.target.value as DiscountType })} className={cn(selectCls, "sm:col-span-2 h-9")}>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                  <input placeholder="Item tax %" inputMode="decimal" value={it.taxValue} onChange={(e) => updateItem(it.id, { taxValue: e.target.value })} className={cn(selectCls, "sm:col-span-2 h-9")} />
                  <div className="flex items-center sm:col-span-6 sm:justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="text-sm font-semibold text-[var(--color-error)] hover:underline">
                        Remove item {idx + 1}
                      </button>
                    )}
                  </div>
                </div>
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
                <option value="FIXED">Fixed</option>
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
