// Bridges the free-tool model to the app's existing invoice primitives so the
// live preview reuses the real <InvoiceDocument> (no duplicate render logic).
import type { InvoiceRenderData, RenderItem, ClientDetail } from "@/lib/data";
import { computeInvoiceTotals, computeLineItem } from "@/lib/invoice-calc";
import type { FreeInvoice } from "./types";

export const uuid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// Human-friendly sequential-ish number, unique enough for a local draft.
export function nextInvoiceNumber(): string {
  return `INV-${Date.now().toString().slice(-6)}`;
}

export function createEmptyInvoice(): FreeInvoice {
  const now = Date.now();
  return {
    id: uuid(),
    businessName: "",
    businessAddress: "",
    businessEmail: "",
    businessPhone: "",
    logoDataUrl: null,
    invoiceNumber: nextInvoiceNumber(),
    issueDate: today(),
    dueDate: plusDays(14),
    paymentTerms: "Net 14",
    poNumber: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    shipTo: "",
    items: [{ id: uuid(), description: "", quantity: "1", rate: "" }],
    taxRate: "",
    discountValue: "",
    discountType: "PERCENTAGE",
    shippingCost: "",
    notes: "",
    terms: "",
    currency: "USD",
    color: "#0D4DC0",
    templateId: "simple",
    headerImage: null,
    titleColor: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Invoice-level totals (also used by the form's summary rows).
export function totalsFor(inv: FreeInvoice) {
  return computeInvoiceTotals({
    items: inv.items.map((it) => ({ quantity: it.quantity, unitPrice: it.rate })),
    invoiceDiscountValue: inv.discountValue,
    invoiceDiscountType: inv.discountType,
    invoiceTaxRate: inv.taxRate,
    shippingCost: inv.shippingCost,
  });
}

// Map the free model onto the render shape consumed by <InvoiceDocument>.
export function toRenderData(inv: FreeInvoice): InvoiceRenderData {
  const totals = totalsFor(inv);

  const items: RenderItem[] = inv.items.map((it, i) => {
    const line = computeLineItem({ quantity: it.quantity, unitPrice: it.rate });
    return {
      sn: i + 1,
      name: it.description || "—",
      description: null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountValue: 0,
      discountType: "PERCENTAGE",
      taxRate: 0,
      amount: line.lineTotal,
    };
  });

  const client: ClientDetail = {
    id: "local",
    name: inv.clientName || "—",
    emailAddress: inv.clientEmail || null,
    addressLine1: inv.clientAddress || null,
  };

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.issueDate,
    dueDate: inv.dueDate || null,
    poNumber: inv.poNumber || null,
    status: "DRAFT",
    currency: inv.currency,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    shippingCost: totals.shippingCost,
    total: totals.total,
    notes: [inv.notes, inv.terms].filter(Boolean).join("\n\n") || null,
    color: inv.color,
    titleColor: inv.titleColor,
    toggles: {
      title: true,
      sender: true,
      receiver: true,
      items: true,
      total: true,
      notes: Boolean(inv.notes || inv.terms),
      logo: Boolean(inv.logoDataUrl),
    },
    business: { name: inv.businessName || "Your business", logo: inv.logoDataUrl },
    client,
    headerImage: inv.headerImage,
    backgroundImage: null,
    backgroundOpacity: 1,
    signatureImage: null,
    stampImage: null,
    items,
  };
}
