// Invoice math — a 1:1 port of the mobile app's calculation logic so the
// webapp and mobile always produce identical totals.
// Source of truth: InvoiceItemUiState.kt (per-item) + CreateInvoiceUiState.kt.

/**
 * How a discount or a tax is measured: a percentage, or a fixed amount per unit.
 *
 * FLAT is the fixed amount's name in the app and in the database. FIXED stays as the free tool's own
 * name, and nothing is sent with it: every type the web sends goes through typeWord. The math below
 * treats everything other than PERCENTAGE as a fixed amount.
 */
export type DiscountType = "PERCENTAGE" | "FLAT" | "FIXED";

/**
 * A stored discount or tax type, read the way the app reads it (`DiscountType.parseOrNull`, then
 * `toDiscountType`, since 2026-09-27). Every word that has been written for a fixed amount is FLAT:
 * FLAT (the app, the server), FIXED (this form until 9c0b2d8, and the app's pull when the server sent
 * none) and AMOUNT (seen once on the server). Case and spaces do not matter; PERCENTAGE, PERCENT, a
 * missing value and anything unknown are a percentage.
 *
 * It read only "flat" as fixed until then, so a stored FIXED opened here as "%" (the app now shows it
 * as a fixed amount), and the form's math took 50 as 50 %.
 */
export function discountTypeOf(stored: string | null | undefined): DiscountType {
  switch (stored?.trim().toUpperCase()) {
    case "FLAT":
    case "FIXED":
    case "AMOUNT":
      return "FLAT";
    default:
      return "PERCENTAGE";
  }
}

/**
 * The word a discount or tax type is sent as, the reverse of discountTypeOf: PERCENTAGE, or FLAT for
 * any fixed amount. FIXED never leaves the web: app builds before 2026-09-27 read it as a percentage,
 * so a fixed 50 would open there as 50%, and the server refuses it as an item's tax type.
 */
export function typeWord(type: DiscountType): "PERCENTAGE" | "FLAT" {
  return type === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";
}

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
  /** A net price already known, used as it is: a saved item the form has not changed keeps its own. */
  netPrice?: number;
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
  const netPrice = item.netPrice ?? discountedPrice + taxAmount;

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
