// The invoice form's Preview: the render data the invoice will have once it is saved, built from
// exactly what the form is about to send. It is drawn by the same <A4PagedFrame> / <InvoiceDocument>
// as the share link, the app's Online tab and the free tool — there is no second renderer to drift.
import type { Business, InvoiceAsset, InvoiceDetail, InvoiceRenderData, RenderItem, Template } from "./data";
import type { Client, InvoiceStatus } from "./types";
import { computeLineItem, type DiscountType, type InvoiceTotals } from "./invoice-calc";
import { templateLook } from "./render-look";

/** The fields of an invoice that the form does not show. */
export type KeptInvoiceFields = Pick<
  InvoiceDetail,
  "poNumber" | "termsId" | "paymentInstructionId" | "language" | "signatureOffset" | "stampOffset" | "signatureScale" | "stampScale"
>;

/**
 * What the request carries for the fields the form does not show: the invoice's own values.
 *
 * PUT /v1/invoices/{id} copies each of these from the request onto the invoice
 * (InvoiceService.updateInvoice), so the null the form used to send erased them on every edit: the
 * PO number, the terms, the payment instructions, the language, and where the signature and the
 * stamp had been placed and at what size. A new invoice has none of them and sends null, as before.
 *
 * `paymentMethodId` is the request's name for what the detail calls `paymentInstructionId`.
 */
export function keptInvoiceFields(invoice?: KeptInvoiceFields | null) {
  return {
    poNumber: invoice?.poNumber ?? null,
    termsId: invoice?.termsId ?? null,
    paymentMethodId: invoice?.paymentInstructionId ?? null,
    language: invoice?.language ?? null,
    signatureOffset: invoice?.signatureOffset ?? null,
    stampOffset: invoice?.stampOffset ?? null,
    signatureScale: invoice?.signatureScale ?? null,
    stampScale: invoice?.stampScale ?? null,
  };
}

/**
 * Why an edit cannot be saved from this form, known before anything is typed; null when it can.
 *
 * An invoice's own tax, the one on its total, is stored as a rate on the invoice: 104 live invoices
 * carry one, and 81 of them have no tax record that the form's Tax list could select. The form starts
 * every edit on "No tax" and recomputes the total, so saving would drop that tax without a word. Until
 * the form can show an invoice's own tax, such an invoice is edited in the app.
 */
export function editBlocker(invoice?: { taxAmount?: string | number | null } | null): string | null {
  if (!invoice) return null;
  const tax = Number(invoice.taxAmount ?? 0);
  return Number.isFinite(tax) && tax > 0
    ? "This invoice has a tax on its total that can't be shown here yet. Saving it on the web would remove that tax, so please edit this invoice in the Invotick app."
    : null;
}

export interface FormItemValues {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountValue: string;
  discountType: DiscountType;
  taxValue: string;
}

/**
 * One item as the form sends it (POST/PUT /v1/invoices). Create and Preview both read this, so the
 * preview cannot show an item differently from the one that gets saved.
 *
 * There is no tax rate here because the request has no field for one (`InvoiceItemRequest`): an
 * item's own tax reaches the server only inside `netPrice`. The saved invoice therefore shows 0.00%
 * in the item Tax column while its Amount includes the tax — and so does the preview.
 */
export function savedItemFields(it: FormItemValues) {
  const c = computeLineItem({
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountValue: it.discountValue,
    discountType: it.discountType,
    taxValue: it.taxValue,
  });
  return {
    name: it.name,
    description: it.description || null,
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
    netPrice: c.netPrice,
    discount: it.discountValue ? Number(it.discountValue) : null,
    discountType: it.discountValue ? it.discountType : null,
  };
}

export type SavedItemFields = ReturnType<typeof savedItemFields>;

/** Stands in for the business until one is chosen. Create still refuses without one. */
export const PLACEHOLDER_BUSINESS_NAME = "Your business";

export interface InvoicePreviewInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  /** The PO number an edit keeps. The form has no field for one, so a new invoice has none. */
  poNumber?: string | null;
  status: InvoiceStatus;
  currency: string;
  notes: string;
  /** The items that will be sent: `savedItemFields` of every item with a name. */
  items: SavedItemFields[];
  /** The form's own totals — the same numbers the request carries. */
  totals: InvoiceTotals;
  business: Business | null;
  client: Client | null;
  template: Template | null;
  signatureId: string;
  stampId: string;
  signatures: InvoiceAsset[];
  stamps: InvoiceAsset[];
  headers: InvoiceAsset[];
  backgrounds: InvoiceAsset[];
}

export function invoicePreviewData(p: InvoicePreviewInput): InvoiceRenderData {
  const t = p.template;
  const look = templateLook(t, {
    header: t?.headerId ? p.headers.find((h) => h.id === t.headerId)?.image : null,
    background: t?.backgroundId ? p.backgrounds.find((b) => b.id === t.backgroundId)?.image : null,
  });
  // "None" is sent as null, and a saved invoice without a signature or stamp of its own shows its
  // template's — so the preview does too.
  const signature = p.signatures.find((s) => s.id === (p.signatureId || t?.signatureId));
  const stamp = p.stamps.find((s) => s.id === (p.stampId || t?.stampId));

  // From here on this mirrors getInvoiceRenderData reading the saved invoice back from sync.
  const items: RenderItem[] = p.items.map((it, i) => ({
    sn: i + 1,
    name: it.name,
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountValue: it.discount ?? 0,
    discountType: it.discountType ?? "PERCENTAGE",
    taxRate: 0,
    amount: it.netPrice * it.quantity,
  }));
  const c = p.client;

  return {
    id: "preview",
    invoiceNumber: p.invoiceNumber,
    invoiceDate: p.invoiceDate,
    dueDate: p.dueDate || null,
    // The form has no PO field: an edit keeps the invoice's own, and a new invoice has none.
    poNumber: p.poNumber ?? null,
    status: p.status,
    currency: p.currency,
    subtotal: p.totals.subtotal,
    discountAmount: p.totals.discountAmount,
    taxAmount: p.totals.taxAmount,
    shippingCost: p.totals.shippingCost,
    total: p.totals.total,
    notes: p.notes || null,
    terms: null,
    paymentInstructions: null,
    ...look,
    business: p.business
      ? { name: p.business.name, logo: p.business.logo }
      : { name: PLACEHOLDER_BUSINESS_NAME, logo: null },
    client: c
      ? {
          id: c.id,
          name: c.name,
          companyName: c.companyName,
          emailAddress: c.emailAddress,
          phone: c.phone,
          addressLine1: c.addressLine1,
          city: c.city,
          country: c.country,
          currencyCode: c.currencyCode,
        }
      : null,
    signatureImage: look.toggles.signature ? signature?.image ?? null : null,
    stampImage: look.toggles.stamp ? stamp?.image ?? null : null,
    items,
  };
}
