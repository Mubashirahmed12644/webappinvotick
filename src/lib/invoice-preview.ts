// The invoice form's Preview: the render data the invoice will have once it is saved, built from
// exactly what the form is about to send. It is drawn by the same <A4PagedFrame> / <InvoiceDocument>
// as the share link, the app's Online tab and the free tool — there is no second renderer to drift.
import type { Business, InvoiceAsset, InvoiceDetail, InvoiceRenderData, RenderItem, Template } from "./data";
import type { Client, InvoiceStatus } from "./types";
import {
  computeInvoiceTotals,
  computeLineItem,
  discountTypeOf,
  typeWord,
  type DiscountType,
  type InvoiceTotals,
  type LineItemInput,
} from "./invoice-calc";
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

/** A form row as prepareInvoice reads it. */
export interface FormRow extends FormItemValues {
  /**
   * On the saved invoice already. The update only adds and changes items, so an item it is not sent
   * stays on the invoice: a saved row is always sent.
   */
  saved?: boolean;
}

const PLAIN_NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * A number exactly as typed: digits with at most one decimal point, spaces around it ignored, and a
 * blank field as 0. Anything else is NaN: "1,000", "-5", "2e3", "12abc". The form used to read such
 * input two ways at once, parseFloat for the totals and Number for the request, so "1,000" counted
 * as 1 in the totals and went out as 0.
 */
export function typedNumber(raw: string): number {
  const s = raw.trim();
  if (s === "") return 0;
  return PLAIN_NUMBER.test(s) ? Number(s) : NaN;
}

function decimalsOf(raw: string): number {
  const s = raw.trim();
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** A row's price, discount and tax as one value. A saved item's kept net price holds while it is unchanged. */
export function moneyKey(it: Pick<FormItemValues, "unitPrice" | "discountValue" | "discountType" | "taxValue" | "taxType">): string {
  return [it.unitPrice.trim(), it.discountValue.trim(), it.discountType, it.taxValue.trim(), it.taxType ?? "PERCENTAGE"].join("|");
}

/**
 * A row as the calculator reads it: every number through typedNumber, and a saved item that has not
 * been changed at its own net price.
 */
export function lineInput(it: FormItemValues): LineItemInput {
  return {
    quantity: typedNumber(it.quantity),
    unitPrice: typedNumber(it.unitPrice),
    discountValue: typedNumber(it.discountValue),
    discountType: it.discountType,
    taxValue: typedNumber(it.taxValue),
    taxType: it.taxType,
    netPrice: it.kept && it.kept.key === moneyKey(it) ? it.kept.netPrice : undefined,
  };
}

/**
 * One item as the form sends it (POST/PUT /v1/invoices). Create and Preview both read this, so the
 * preview cannot show an item differently from the one that gets saved.
 *
 * Every number is the one typed (typedNumber), with no fallback: prepareInvoice sends only rows whose
 * numbers it could read. The form used to send a quantity it could not read, or a 0, as 1.
 *
 * There is no tax rate here because the request has no field for one (`InvoiceItemRequest`): an
 * item's own tax reaches the server only inside `netPrice`. A new item therefore shows 0.00% in the
 * item Tax column while its Amount includes the tax, and so does the preview. A saved item keeps the
 * rate it has, because the update does not touch that column.
 */
export function savedItemFields(it: FormItemValues) {
  const c = computeLineItem(lineInput(it));
  const discount = typedNumber(it.discountValue);
  return {
    name: it.name,
    description: it.description || null,
    quantity: typedNumber(it.quantity),
    unitPrice: typedNumber(it.unitPrice),
    netPrice: c.netPrice,
    discount: discount ? discount : null,
    // The word the app reads (typeWord): a fixed amount is FLAT, never FIXED.
    discountType: discount ? typeWord(it.discountType) : null,
  };
}

export type SavedItemFields = ReturnType<typeof savedItemFields>;

export interface PreparedInvoice<R extends FormRow> {
  /** The rows that will be sent, each with the fields it is sent with. The totals come from these alone. */
  sent: { row: R; fields: SavedItemFields }[];
  totals: InvoiceTotals;
  /** What stands between the form and Save, in the form's order. Empty when it can be sent. */
  problems: string[];
  /** Each row's own problem, by its index in the rows given; null for a row with none, or one left out. */
  rowProblems: (string | null)[];
  /** The invoice's own discount and shipping, as they will be sent. */
  discountValue: number;
  shippingCost: number;
}

const SKIP = Symbol("skip");

/**
 * The invoice as Save would send it, read once from the form: which rows go, what each goes with, the
 * totals over exactly those rows, and what stands in the way. Save, the Summary and the Preview all
 * read this one result, so none of them can count a row that another leaves out. The form's totals
 * used to run over every row while the request carried only the named ones, with a quantity of 0 sent
 * as 1: rows adding up to 214 went out under a subtotal of 239.
 *
 * - A row left completely empty is the one the form offers, and is not sent. A row with anything in it
 *   and no name is a problem, so a typed price cannot vanish from the invoice.
 * - A saved row is always sent (FormRow.saved).
 * - A quantity is any number above 0 with at most 2 decimals, and it is sent exactly as typed: the
 *   server stores it as sent, 0.5 included. Until fix/rest-invoice-items-and-quantity (7dd2aec) it
 *   raised anything below 1 to 1, so the form refused those.
 * - A number the server would store as a different one is refused rather than sent: more than 2
 *   decimals (it keeps 2), and a discount past the price or past the subtotal (it stores the negative
 *   amount as 0.00).
 */
export function prepareInvoice<R extends FormRow>(input: {
  rows: R[];
  discountValue: string;
  discountType: DiscountType;
  /** The chosen tax's rate. The invoice's own tax is always a percentage. */
  taxRate: number | string;
  shipping: string;
}): PreparedInvoice<R> {
  const problems: string[] = [];
  const rowProblems: (string | null)[] = [];
  const sent: { row: R; fields: SavedItemFields }[] = [];
  input.rows.forEach((row, i) => {
    const problem = rowProblem(row, i + 1);
    if (problem === SKIP) {
      rowProblems.push(null);
      return;
    }
    rowProblems.push(problem);
    if (problem) problems.push(problem);
    else sent.push({ row, fields: savedItemFields(row) });
  });
  if (sent.length === 0 && problems.length === 0) problems.push("Add at least one item.");

  const discountValue = invoiceNumber("The discount", input.discountValue, problems);
  const shippingCost = invoiceNumber("The shipping", input.shipping, problems);
  const totals = computeInvoiceTotals({
    // Each row at the net price it is sent with, to the cent as the server keeps it, so the subtotal
    // is what the invoice's rows add up to on its page (netPrice × quantity). From the unrounded unit
    // price, 99.99 + 5% at a quantity of 100 came to 10,498.95 against rows showing 10,499.00.
    items: sent.map(({ row, fields }) => ({ ...lineInput(row), netPrice: fields.netPrice })),
    invoiceDiscountValue: discountValue,
    invoiceDiscountType: input.discountType,
    invoiceTaxRate: input.taxRate,
    shippingCost,
  });
  if (totals.discountedSubtotal < 0) problems.push("The discount is more than the subtotal.");
  return { sent, totals, problems, rowProblems, discountValue, shippingCost };
}

function rowProblem(row: FormRow, n: number): string | null | typeof SKIP {
  if (!row.name.trim()) {
    const empty = [row.description, row.unitPrice, row.discountValue, row.taxValue].every((v) => !v.trim());
    if (empty && !row.saved) return SKIP;
    return row.saved
      ? `Item ${n} has no name. Give it its name back: a saved item can't be removed on the web yet.`
      : `Item ${n} has no name. Give it one, or remove the row.`;
  }
  const q = row.quantity.trim();
  if (!q) return `Item ${n}: enter a quantity.`;
  const quantity = typedNumber(q);
  if (Number.isNaN(quantity)) return `Item ${n}: "${q}" is not a quantity. Use a number such as 2 or 1.5.`;
  if (quantity <= 0) return `Item ${n}: the quantity must be more than 0.`;
  if (decimalsOf(q) > 2) return `Item ${n}: the quantity can have at most 2 decimal places.`;
  const typed = [
    ["price", row.unitPrice],
    ["discount", row.discountValue],
    ["tax", row.taxValue],
  ] as const;
  for (const [label, raw] of typed) {
    if (Number.isNaN(typedNumber(raw))) return `Item ${n}: the ${label} "${raw.trim()}" is not a number. Use digits only, such as 1500 or 12.50.`;
  }
  if (decimalsOf(row.unitPrice) > 2) return `Item ${n}: the price can have at most 2 decimal places.`;
  if (decimalsOf(row.discountValue) > 2) return `Item ${n}: the discount can have at most 2 decimal places.`;
  if (savedItemFields(row).netPrice < 0) return `Item ${n}: the discount is more than the price.`;
  return null;
}

/** The invoice's own discount or shipping as typed; a problem, and 0, when it cannot be read. */
function invoiceNumber(label: string, raw: string, problems: string[]): number {
  const value = typedNumber(raw);
  if (Number.isNaN(value)) {
    problems.push(`${label} "${raw.trim()}" is not a number. Use digits only, such as 500 or 12.50.`);
    return 0;
  }
  if (decimalsOf(raw) > 2) problems.push(`${label} can have at most 2 decimal places.`);
  return value;
}

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
    saved: true,
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
  /** The items that will be sent: prepareInvoice's `sent`. */
  items: SavedItemFields[];
  /** The totals over exactly those items: the same numbers the request carries. */
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
