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
  authorizedSignature: "Authorized signature",
  footerGenerated: "Invoice generated using Invotick",
  footerTagline: "Create professional invoices in seconds",
  footerScan: "Scan to download Invotick",
};

// Stable key order for batching label translations.
export const LABEL_KEYS = Object.keys(LABELS) as (keyof InvoiceLabels)[];
