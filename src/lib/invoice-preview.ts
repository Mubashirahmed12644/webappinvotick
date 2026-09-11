// The invoice form's Preview: the render data the invoice will have once it is saved, built from
// exactly what the form is about to send. It is drawn by the same <A4PagedFrame> / <InvoiceDocument>
// as the share link, the app's Online tab and the free tool — there is no second renderer to drift.
import type { Business, InvoiceAsset, InvoiceDetail, InvoiceRenderData, RenderItem, Template } from "./data";
import type { Client, InvoiceStatus } from "./types";
import { computeLineItem, discountTypeOf, type DiscountType, type InvoiceTotals, type LineItemInput } from "./invoice-calc";
import { sortByOrder } from "./givens";
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
  /** How the item's own tax is measured. A saved item keeps its own; a new row's is a percentage. */
  taxType?: DiscountType;
  /**
   * A saved item's own net price, with the price, discount and tax it was saved with (moneyKey).
   * While those are unchanged the item goes back at that net price, to the cent. Some live items
   * do not come out at their stored net price when recomputed from what the form shows: a price the
   * server clamped to 0.00, a tax inside the price with no rate recorded, a cent the app rounded
   * its own way. Recomputing an item the user did not touch would change its price.
   */
  kept?: { netPrice: number; key: string };
}

/** A row's price, discount and tax as one value. A saved item's kept net price holds while it is unchanged. */
export function moneyKey(it: Pick<FormItemValues, "unitPrice" | "discountValue" | "discountType" | "taxValue" | "taxType">): string {
  return [it.unitPrice.trim(), it.discountValue.trim(), it.discountType, it.taxValue.trim(), it.taxType ?? "PERCENTAGE"].join("|");
}

/** A row as the calculator reads it. A saved item that has not been changed keeps its own net price. */
export function lineInput(it: FormItemValues): LineItemInput {
  return {
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountValue: it.discountValue,
    discountType: it.discountType,
    taxValue: it.taxValue,
    taxType: it.taxType,
    netPrice: it.kept && it.kept.key === moneyKey(it) ? it.kept.netPrice : undefined,
  };
}

/**
 * One item as the form sends it (POST/PUT /v1/invoices). Create and Preview both read this, so the
 * preview cannot show an item differently from the one that gets saved.
 *
 * There is no tax rate here because the request has no field for one (`InvoiceItemRequest`): an
 * item's own tax reaches the server only inside `netPrice`. A new item therefore shows 0.00% in the
 * item Tax column while its Amount includes the tax, and so does the preview. A saved item keeps the
 * rate it has, because the update does not touch that column.
 */
export function savedItemFields(it: FormItemValues) {
  const c = computeLineItem(lineInput(it));
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

/**
 * One item of a saved invoice as the edit form starts from it: the sync pull's row, which is what the
 * invoice's page shows. The REST detail used to be the source, and it has no item tax, none of the
 * item's links, and it lists the items deleted in the app as well.
 */
export interface SavedInvoiceItem {
  id: string;
  inventoryItemId: string | null;
  taxId: string | null;
  unitTypeId: string | null;
  itemCategoryId: string | null;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  /** What one unit costs on the invoice, its own tax included. */
  netPrice: string;
  discountValue: string | null;
  discountType: string | null;
  taxRate: string | null;
  taxType: string | null;
}

/** The fields of a sync pull item row that the edit form reads. */
export interface PulledInvoiceItem {
  id: string;
  invoiceId?: string | null;
  name: string;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  netPrice: string;
  discountValue?: string | null;
  discountType?: string | null;
  taxRate?: string | null;
  taxType?: string | null;
  taxId?: string | null;
  inventoryItemId?: string | null;
  unitTypeId?: string | null;
  itemCategoryId?: string | null;
  orderIndex?: number | null;
  createdAt?: string | null;
  isDeleted?: boolean;
}

/** An invoice's live items from the sync pull, in the order its page shows them (getInvoiceRenderData). */
export function savedItemsOf(invoiceId: string, items: readonly PulledInvoiceItem[]): SavedInvoiceItem[] {
  return sortByOrder(items.filter((it) => it.invoiceId === invoiceId && !it.isDeleted)).map((it) => ({
    id: it.id,
    inventoryItemId: it.inventoryItemId ?? null,
    taxId: it.taxId ?? null,
    unitTypeId: it.unitTypeId ?? null,
    itemCategoryId: it.itemCategoryId ?? null,
    name: it.name,
    description: it.description ?? null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    netPrice: it.netPrice,
    discountValue: it.discountValue ?? null,
    discountType: it.discountType ?? null,
    taxRate: it.taxRate ?? null,
    taxType: it.taxType ?? null,
  }));
}

/**
 * A saved item as a form row. Every number is as the invoice has it, the item's own tax included,
 * and the item keeps its own net price until its price, discount or tax is changed
 * (FormItemValues.kept), so an edit that changes nothing sends the same prices back. The item's
 * links go back as they are: the update copies each of them from the request, and a null would
 * erase it.
 */
export function formRowFromSaved(it: SavedInvoiceItem) {
  const plain = (v: string | null) => (v == null || v.trim() === "" ? "" : String(Number(v)));
  const unlessZero = (v: string | null) => (Number(v) ? plain(v) : "");
  const money = {
    unitPrice: plain(it.unitPrice),
    discountValue: unlessZero(it.discountValue),
    discountType: discountTypeOf(it.discountType),
    taxValue: unlessZero(it.taxRate),
    taxType: discountTypeOf(it.taxType),
  };
  const stored = Number(it.netPrice);
  return {
    id: it.id,
    inventoryItemId: it.inventoryItemId ?? "",
    taxId: it.taxId,
    unitTypeId: it.unitTypeId,
    itemCategoryId: it.itemCategoryId,
    name: it.name,
    description: it.description ?? "",
    quantity: plain(it.quantity),
    ...money,
    kept: Number.isFinite(stored) ? { netPrice: stored, key: moneyKey(money) } : undefined,
  };
}

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
