// Invoice math — a 1:1 port of the mobile app's calculation logic so the
// webapp and mobile always produce identical totals.
// Source of truth: InvoiceItemUiState.kt (per-item) + CreateInvoiceUiState.kt.

export type DiscountType = "PERCENTAGE" | "FIXED";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNum(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
}

export interface LineItemInput {
  name?: string;
  quantity: string | number;
  unitPrice: string | number;
  discountValue?: string | number;
  discountType?: DiscountType;
  taxValue?: string | number;
  taxType?: DiscountType;
}

export interface LineItemComputed {
  unitPrice: number;
  quantity: number;
  discountAmount: number; // per unit
  taxAmount: number; // per unit
  netPrice: number; // per unit (discountedPrice + taxAmount)
  lineTotal: number; // netPrice * quantity
}

// Per-unit item math (quantity is applied later, at invoice subtotal).
export function computeLineItem(item: LineItemInput): LineItemComputed {
  const unitPrice = toNum(item.unitPrice);
  const quantity = item.quantity === "" || item.quantity == null ? 1 : toNum(item.quantity);
  const discountValue = toNum(item.discountValue);
  const taxValue = toNum(item.taxValue);
  const discountType = item.discountType ?? "PERCENTAGE";
  const taxType = item.taxType ?? "PERCENTAGE";

  const discountAmount =
    discountType === "PERCENTAGE" ? (unitPrice * discountValue) / 100 : discountValue;
  const discountedPrice = unitPrice - discountAmount;
  const taxAmount = taxType === "PERCENTAGE" ? (discountedPrice * taxValue) / 100 : taxValue;
  const netPrice = discountedPrice + taxAmount;

  return {
    unitPrice,
    quantity,
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    netPrice: round2(netPrice),
    lineTotal: round2(netPrice * quantity),
  };
}

export interface InvoiceTotalsInput {
  items: LineItemInput[];
  invoiceDiscountValue?: string | number;
  invoiceDiscountType?: DiscountType;
  invoiceTaxRate?: string | number; // invoice-level tax is always percentage
  shippingCost?: string | number;
  payments?: Array<string | number>;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  totalPayments: number;
  balanceDue: number;
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(
    input.items.reduce((acc, it) => acc + computeLineItem(it).lineTotal, 0),
  );

  const discountValue = toNum(input.invoiceDiscountValue);
  const discountType = input.invoiceDiscountType ?? "PERCENTAGE";
  const discountAmount = round2(
    discountType === "PERCENTAGE" ? (subtotal * discountValue) / 100 : discountValue,
  );

  const discountedSubtotal = round2(subtotal - discountAmount);
  const taxRate = toNum(input.invoiceTaxRate);
  const taxAmount = round2((discountedSubtotal * taxRate) / 100);
  const shippingCost = round2(toNum(input.shippingCost));
  const total = round2(discountedSubtotal + taxAmount + shippingCost);

  const totalPayments = round2((input.payments ?? []).reduce((a: number, p) => a + toNum(p), 0));
  const balanceDue = round2(total - totalPayments);

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    taxAmount,
    shippingCost,
    total,
    totalPayments,
    balanceDue,
  };
}
