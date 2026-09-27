// Invoice math — the same calculation as the mobile app's, so the web and the app always produce identical
// totals. Source of truth: LineUnitPrice.kt (per line) + DocumentTotals.kt (the document), both in the app's
// :domain. The shared discount table (discount-cases.test.ts here, TheDocumentAddsUpLikeTheWebTest there)
// holds both to the same figures.

import { type DiscountType } from "./discount-type.ts";

export { discountTypeOf, typeWord, type DiscountType } from "./discount-type.ts";

// ─── Money arithmetic ───────────────────────────────────────────────────────────────────────────
//
// Decimal, not binary floating point, and four decimals, not two. The owner, 2026-09-27: "Dikhny wala
// figure round kr sakty ho but calculation wala nhi — infact calculation .0000 tak ho, but ager show .00
// figure hain to .00 ky show krwaogy." So every figure below is an exact decimal (a BigInt count of
// 10^-scale units) carried at four decimals, half away from zero — the app's toCalcAmount — and only
// formatMoney (format.ts) rounds to two, for the reader. Number arithmetic used to hold 15 % of 14.50 as
// 2.1749999… where the app holds 2.1750.

/** An exact decimal: n × 10^-s. */
interface Dec {
  n: bigint;
  s: number;
}

const B0 = BigInt(0);
const B1 = BigInt(1);
const B2 = BigInt(2);
const B10 = BigInt(10);

const ZERO: Dec = { n: B0, s: 0 };

/** 10^k, by multiplication: `**` on a bigint needs an ES2016+ target at every step of every build. */
function pow10(k: number): bigint {
  let p = B1;
  for (let i = 0; i < k; i++) p *= B10;
  return p;
}

/** A number or a typed value as an exact decimal. What parseFloat cannot read is 0, as it always was here. */
function dec(v: string | number | null | undefined): Dec {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  if (!Number.isFinite(x)) return ZERO;
  // String(x) is the shortest text that reads back as x: the decimal that was typed.
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x));
  if (!m) return ZERO;
  const [, sign, int, frac = "", exp = "0"] = m;
  const n = BigInt(sign + int + frac);
  const s = frac.length - Number(exp);
  return s < 0 ? { n: n * pow10(-s), s: 0 } : { n, s };
}

function atScale(d: Dec, s: number): bigint {
  return d.n * pow10(s - d.s);
}

function add(a: Dec, b: Dec): Dec {
  const s = Math.max(a.s, b.s);
  return { n: atScale(a, s) + atScale(b, s), s };
}

function sub(a: Dec, b: Dec): Dec {
  return add(a, { n: -b.n, s: b.s });
}

function mul(a: Dec, b: Dec): Dec {
  return { n: a.n * b.n, s: a.s + b.s };
}

/** [rate] per cent of [base]. */
function percentOf(base: Dec, rate: Dec): Dec {
  const p = mul(base, rate);
  return { n: p.n, s: p.s + 2 };
}

function cmp(a: Dec, b: Dec): number {
  const s = Math.max(a.s, b.s);
  const x = atScale(a, s);
  const y = atScale(b, s);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Four decimals, half away from zero: the app's toCalcAmount (RoundingMode.ROUND_HALF_AWAY_FROM_ZERO). */
function money(d: Dec): Dec {
  if (d.s <= 4) return { n: atScale(d, 4), s: 4 };
  const unit = pow10(d.s - 4);
  const abs = d.n < B0 ? -d.n : d.n;
  let cents = abs / unit;
  if ((abs % unit) * B2 >= unit) cents += B1;
  return { n: d.n < B0 ? -cents : cents, s: 4 };
}

/** Between zero and [limit]; zero when [limit] itself is below zero. The app's DocumentTotals.atMost. */
function atMost(d: Dec, limit: Dec): Dec {
  if (cmp(d, limit) > 0) return cmp(limit, ZERO) < 0 ? ZERO : limit;
  if (cmp(d, ZERO) < 0) return ZERO;
  return d;
}

function num(d: Dec): number {
  // Both operands are exact, and IEEE division is correctly rounded: the Number nearest the decimal.
  return Number(d.n) / 10 ** d.s;
}

/** What a discount or a tax of [value] takes from [base]: a share of it, or the value itself. */
function amountOn(type: DiscountType, base: Dec, value: Dec): Dec {
  return type === "PERCENTAGE" ? percentOf(base, value) : value;
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
  discountAmount: number; // per unit, what was taken off (four decimals, as every figure here)
  taxAmount: number; // per unit
  netPrice: number; // per unit (unit price − discount + tax)
  lineTotal: number; // netPrice × quantity
}

/**
 * One line, per unit, then times its quantity. The same steps as the app's LineUnitPrice.of and
 * DocumentTotals.lineAmount, each figure at four decimals:
 * 1. the discount on the unit price (a percentage of it, or a flat amount per unit), never more than
 *    the price — the form refuses a larger one (discountExceeds); this stop is the last safety net;
 * 2. the tax on the discounted price;
 * 3. the net unit price = price − discount + tax;
 * 4. the line's amount = net × quantity.
 */
export function computeLineItem(item: LineItemInput): LineItemComputed {
  const unitPrice = dec(item.unitPrice);
  const quantity = item.quantity === "" || item.quantity == null ? 1 : toNum(item.quantity);
  const discount = atMost(money(amountOn(item.discountType ?? "PERCENTAGE", unitPrice, dec(item.discountValue))), unitPrice);
  const discounted = sub(unitPrice, discount);
  const tax = money(amountOn(item.taxType ?? "PERCENTAGE", discounted, dec(item.taxValue)));
  const net = item.netPrice != null ? money(dec(item.netPrice)) : money(add(discounted, tax));

  return {
    unitPrice: num(unitPrice),
    quantity,
    discountAmount: num(discount),
    taxAmount: num(tax),
    netPrice: num(net),
    lineTotal: num(money(mul(net, dec(quantity)))),
  };
}

/** The words for a refused discount — the app's DiscountLimit.ABOVE_PRICE / ABOVE_SUBTOTAL, letter for letter. */
export const DISCOUNT_ABOVE_PRICE = "Discount can't be more than the price.";
export const DISCOUNT_ABOVE_SUBTOTAL = "Discount can't be more than the subtotal.";

/**
 * Whether a discount of [value] asks for more than [base]: a percentage above 100, or a flat amount above
 * the base — the app's DiscountLimit.exceeds. Exactly 100 %, or exactly the base, is allowed. The owner,
 * 2026-09-27: "Rok de aur bataye" — the form refuses such a discount and says why, on the web as in the app.
 */
export function discountExceeds(type: DiscountType, base: string | number, value: string | number): boolean {
  return type === "PERCENTAGE" ? cmp(dec(value), dec(100)) > 0 : cmp(dec(value), dec(base)) > 0;
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

/**
 * The document's money rows, as the app's DocumentTotals.of adds them up, every figure at four decimals:
 * the subtotal is the sum of the line amounts; the discount is taken on it (a percentage, or a flat
 * amount), never more than the subtotal; the tax is the rate on what is left; then shipping. Each row is
 * shown as its own figure rounded to two, and the total as the precise total rounded to two, so a column
 * can differ from the total by a paisa, as accounting software prints it.
 */
export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = input.items.reduce((acc, it) => add(acc, dec(computeLineItem(it).lineTotal)), ZERO);
  const discount = atMost(
    money(amountOn(input.invoiceDiscountType ?? "PERCENTAGE", subtotal, dec(input.invoiceDiscountValue))),
    subtotal,
  );
  const discountedSubtotal = sub(subtotal, discount);
  const tax = money(percentOf(discountedSubtotal, dec(input.invoiceTaxRate)));
  const shipping = money(dec(input.shippingCost));
  const total = add(add(discountedSubtotal, tax), shipping);

  const totalPayments = money((input.payments ?? []).reduce((a: Dec, p) => add(a, dec(p)), ZERO));

  return {
    subtotal: num(money(subtotal)),
    discountAmount: num(discount),
    discountedSubtotal: num(money(discountedSubtotal)),
    taxAmount: num(tax),
    shippingCost: num(shipping),
    total: num(money(total)),
    totalPayments: num(totalPayments),
    balanceDue: num(money(sub(total, totalPayments))),
  };
}
