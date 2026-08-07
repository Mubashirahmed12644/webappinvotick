/**
 * The invoice's fixed structural labels, in English (the canonical source). Extracted so the shared
 * HTML invoice can be rendered in the receiver's language: the values are translated (via the free
 * Google endpoint) and passed to <InvoiceDocument> as the `labels` prop. Order here == the order the
 * translation pipeline batches them, so keep it stable.
 */
export type InvoiceLabels = {
  invoice: string;
  from: string;
  billTo: string;
  invoiceDetails: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  poNo: string;
  phone: string;
  email: string;
  colSn: string;
  colDescription: string;
  colQty: string;
  colPrice: string;
  colDisc: string;
  colTax: string;
  colAmount: string;
  subTotal: string;
  discount: string;
  tax: string;
  shipping: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  notes: string;
  terms: string;
  paymentInstructions: string;
  authorizedSignature: string;
  footerGenerated: string;
  footerTagline: string;
  footerScan: string;
};

export const LABELS: InvoiceLabels = {
  invoice: "Invoice",
  from: "From",
  billTo: "Bill To",
  invoiceDetails: "Invoice Details",
  invoiceNo: "Invoice #",
  issueDate: "Issue Date",
  dueDate: "Due Date",
  poNo: "P.O #",
  phone: "Phone",
  email: "Email",
  colSn: "S#",
  colDescription: "Description",
  colQty: "Qty",
  colPrice: "Price",
  colDisc: "Disc",
  colTax: "Tax",
  colAmount: "Amount",
  subTotal: "SUB TOTAL",
  discount: "DISCOUNT",
  tax: "TAX",
  shipping: "SHIPPING",
  total: "TOTAL",
  amountPaid: "AMOUNT PAID",
  balanceDue: "BALANCE DUE",
  notes: "Notes",
  terms: "Terms and Conditions",
  paymentInstructions: "Payment Instructions",
  authorizedSignature: "Authorized signature",
  footerGenerated: "Invoice generated using Invotick",
  footerTagline: "Create professional invoices in seconds",
  footerScan: "Scan to download Invotick",
};

/**
 * The same document, quoting a price instead of asking for one.
 *
 * Only the words that would be wrong on an estimate change. Everything else — the party blocks, the
 * item columns, the totals, the signature line — is the same document, which is the whole reason an
 * estimate can share the renderer at all.
 *
 * The keys are identical to [LABELS] on purpose: the translation pipeline batches by [LABEL_KEYS],
 * so an estimate translates through exactly the same path as an invoice, with no second batch and
 * no second order to keep in step.
 *
 * "Valid Until" rather than the model's own `expiryDate`: the field's name is for us, and the line
 * the receiver reads should say how long the price is good for.
 */
export const ESTIMATE_LABELS: InvoiceLabels = {
  ...LABELS,
  invoice: "Estimate",
  invoiceDetails: "Estimate Details",
  invoiceNo: "Estimate #",
  dueDate: "Valid Until",
  footerGenerated: "Estimate generated using Invotick",
};

/** The label set for a document, defaulting to the invoice's. */
export function labelsFor(documentType?: string | null): InvoiceLabels {
  return documentType === "ESTIMATE" ? ESTIMATE_LABELS : LABELS;
}

// Stable key order for batching label translations.
/**
 * What to hand a TRANSLATOR for labels whose English is an abbreviation or otherwise ambiguous.
 *
 * The rendered label stays short — a table column has no room for "Purchase order number" — but the
 * string we ask a machine to translate has to be the thing we actually mean. Sending the abbreviation
 * produced real, shipped nonsense:
 *
 *   "Disc"  → 光盘 / القرص / Scheibe / ディスク   ("optical disc", over the DISCOUNT column)
 *   "P.O #" → 邮政信箱号                          ("PO Box number", not purchase order)
 *   "S#"    → nothing meaningful in any language
 *
 * A translator cannot know "Disc" is short for "Discount"; a reader of the finished invoice cannot
 * know either. Anything added to LABELS whose English is clipped, initialised, or a word with a
 * commoner other meaning belongs in here.
 */
export const LABEL_TRANSLATION_SOURCE: Partial<Record<keyof InvoiceLabels, string>> = {
  colDisc: "Discount",
  poNo: "Purchase order number",
  colSn: "Line number",
  colQty: "Quantity",
  invoiceNo: "Invoice number",
  // "From" alone reads as the preposition and comes back as one. On an invoice it names the party.
  from: "Sender",
  billTo: "Bill to customer",
};

export const LABEL_KEYS = Object.keys(LABELS) as (keyof InvoiceLabels)[];
