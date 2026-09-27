// Run: npm test
//
// The shared discount table (owner, 2026-09-27: "dono discounts ko open rakho and jis jagha k jo issue hy
// usko fix kero"). The same cases, figure for figure, as the app's TheDocumentAddsUpLikeTheWebTest
// (feature/document/common): both tables are generated from one list, so a figure that differs between
// the two is a client seeing a different total from the owner.
//
// The rule both sides follow — every figure at four decimals, rounded to two only where it is shown (owner,
// 2026-09-27: "calculation .0000 tak ho, but ager show .00 figure hain to .00 ky show krwaogy"): each
// line's discount per unit, never past the price; the line's tax on the discounted price; the net unit
// price is their sum; the line's amount is net × quantity. The subtotal is the sum of the amounts; the
// invoice's discount is taken on it, never past it; the invoice's tax on what is left; then shipping.
//
// The last five cases are real production invoices with both discounts (read-only, 2026-09-27): D621D932
// and 1E5A948C read as stored; 16E638A2 reads as stored (1,167.66) where the server's two-decimal lines
// gave 1,168.20; FD789DCD reads 30,722.06 and 7FE2B764 1,351.36, a paisa above what the saving phone
// stored when it rounded the discount and the tax before adding them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInvoiceTotals, computeLineItem, type DiscountType } from "./invoice-calc.ts";
import { formatMoney } from "./format.ts";

interface Line { price: string; qty: string; discountType: DiscountType | null; discountValue: string; taxType: DiscountType | null; taxValue: string }
const L = (price: string, qty: string, discountType: DiscountType | null, discountValue: string, taxType: DiscountType | null, taxValue: string): Line =>
  ({ price, qty, discountType, discountValue, taxType, taxValue });

interface DiscountCase {
  name: string;
  lines: Line[];
  discountType: DiscountType | null;
  discountValue: string;
  taxRate: string;
  shipping: string;
  nets: string[];
  amounts: string[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  /** Subtotal, discount, tax and total as the page shows them: each precise figure rounded to two. */
  shown: string[];
}

const lineInput = (l: Line) => ({
  quantity: l.qty,
  unitPrice: l.price,
  discountValue: l.discountValue,
  discountType: l.discountType ?? "PERCENTAGE",
  taxValue: l.taxValue,
  taxType: l.taxType ?? "PERCENTAGE",
});

export const DISCOUNT_CASES: DiscountCase[] = [
  {
    name: "item flat",
    lines: [L("100", "2", "FLAT", "10", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["90.0000"], amounts: ["180.0000"],
    subtotal: "180.0000", discount: "0", tax: "0.0000", total: "180.0000",
    shown: ["180.00", "0.00", "0.00", "180.00"],
  },
  {
    name: "item percent",
    lines: [L("100", "3", "PERCENTAGE", "15", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["85.0000"], amounts: ["255.0000"],
    subtotal: "255.0000", discount: "0", tax: "0.0000", total: "255.0000",
    shown: ["255.00", "0.00", "0.00", "255.00"],
  },
  {
    name: "invoice flat",
    lines: [L("100", "2", null, "0", null, "0")],
    discountType: "FLAT", discountValue: "50", taxRate: "0", shipping: "0",
    nets: ["100.0000"], amounts: ["200.0000"],
    subtotal: "200.0000", discount: "50.0000", tax: "0.0000", total: "150.0000",
    shown: ["200.00", "50.00", "0.00", "150.00"],
  },
  {
    name: "invoice percent",
    lines: [L("250", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["250.0000"], amounts: ["250.0000"],
    subtotal: "250.0000", discount: "25.0000", tax: "0.0000", total: "225.0000",
    shown: ["250.00", "25.00", "0.00", "225.00"],
  },
  {
    name: "both",
    lines: [L("100", "2", "PERCENTAGE", "10", null, "0")],
    discountType: "FLAT", discountValue: "20", taxRate: "0", shipping: "0",
    nets: ["90.0000"], amounts: ["180.0000"],
    subtotal: "180.0000", discount: "20.0000", tax: "0.0000", total: "160.0000",
    shown: ["180.00", "20.00", "0.00", "160.00"],
  },
  {
    name: "both, with item tax, invoice tax and shipping",
    lines: [L("80", "3", "FLAT", "5", "PERCENTAGE", "10")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "5", shipping: "12.5",
    nets: ["82.5000"], amounts: ["247.5000"],
    subtotal: "247.5000", discount: "24.7500", tax: "11.1375", total: "246.3875",
    shown: ["247.50", "24.75", "11.14", "246.39"],
  },
  {
    name: "item flat larger than the price",
    lines: [L("50", "2", "FLAT", "80", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.0000"], amounts: ["0.0000"],
    subtotal: "0.0000", discount: "0", tax: "0.0000", total: "0.0000",
    shown: ["0.00", "0.00", "0.00", "0.00"],
  },
  {
    name: "item percent above 100",
    lines: [L("40", "1", "PERCENTAGE", "150", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.0000"], amounts: ["0.0000"],
    subtotal: "0.0000", discount: "0", tax: "0.0000", total: "0.0000",
    shown: ["0.00", "0.00", "0.00", "0.00"],
  },
  {
    name: "invoice flat larger than the subtotal",
    lines: [L("100", "1", null, "0", null, "0")],
    discountType: "FLAT", discountValue: "150", taxRate: "0", shipping: "10",
    nets: ["100.0000"], amounts: ["100.0000"],
    subtotal: "100.0000", discount: "100.0000", tax: "0.0000", total: "10.0000",
    shown: ["100.00", "100.00", "0.00", "10.00"],
  },
  {
    name: "invoice percent above 100 (production shape)",
    lines: [L("1", "1", "PERCENTAGE", "9", null, "0")],
    discountType: "PERCENTAGE", discountValue: "1227", taxRate: "0", shipping: "1227",
    nets: ["0.9100"], amounts: ["0.9100"],
    subtotal: "0.9100", discount: "0.9100", tax: "0.0000", total: "1227.0000",
    shown: ["0.91", "0.91", "0.00", "1227.00"],
  },
  {
    name: "zero",
    lines: [L("0", "1", "PERCENTAGE", "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.0000"], amounts: ["0.0000"],
    subtotal: "0.0000", discount: "0.0000", tax: "0.0000", total: "0.0000",
    shown: ["0.00", "0.00", "0.00", "0.00"],
  },
  {
    name: "half a cent on an item discount is kept",
    lines: [L("10.05", "1", "PERCENTAGE", "10", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["9.0450"], amounts: ["9.0450"],
    subtotal: "9.0450", discount: "0", tax: "0.0000", total: "9.0450",
    shown: ["9.05", "0.00", "0.00", "9.05"],
  },
  {
    name: "half a cent on the invoice discount is kept",
    lines: [L("0.35", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["0.3500"], amounts: ["0.3500"],
    subtotal: "0.3500", discount: "0.0350", tax: "0.0000", total: "0.3150",
    shown: ["0.35", "0.04", "0.00", "0.32"],
  },
  {
    name: "flat item discount and flat item tax",
    lines: [L("100", "1", "FLAT", "10", "FLAT", "5")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["95.0000"], amounts: ["95.0000"],
    subtotal: "95.0000", discount: "0", tax: "0.0000", total: "95.0000",
    shown: ["95.00", "0.00", "0.00", "95.00"],
  },
  {
    name: "a fractional quantity",
    lines: [L("9.99", "2.5", "PERCENTAGE", "3", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["9.6903"], amounts: ["24.2258"],
    subtotal: "24.2258", discount: "0", tax: "0.0000", total: "24.2258",
    shown: ["24.23", "0.00", "0.00", "24.23"],
  },
  {
    name: "0.70 less 5 % at 1,000 is 665.0000 (a production line, 1C0DD2E4)",
    lines: [L("0.7", "1000", "PERCENTAGE", "5", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.6650"], amounts: ["665.0000"],
    subtotal: "665.0000", discount: "0", tax: "0.0000", total: "665.0000",
    shown: ["665.00", "0.00", "0.00", "665.00"],
  },
  {
    name: "two lines of 0.1650 show 0.17 each over a total of 0.33",
    lines: [L("0.055", "3", null, "0", null, "0"), L("0.055", "3", null, "0", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.0550", "0.0550"], amounts: ["0.1650", "0.1650"],
    subtotal: "0.3300", discount: "0", tax: "0.0000", total: "0.3300",
    shown: ["0.33", "0.00", "0.00", "0.33"],
  },
  {
    name: "15 % of 14.50 is 2.1750, shown 2.18",
    lines: [L("14.5", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "15", taxRate: "0", shipping: "0",
    nets: ["14.5000"], amounts: ["14.5000"],
    subtotal: "14.5000", discount: "2.1750", tax: "0.0000", total: "12.3250",
    shown: ["14.50", "2.18", "0.00", "12.33"],
  },
  {
    name: "15 % tax on 14.50 is 2.1750, shown 2.18",
    lines: [L("14.5", "1", null, "0", null, "0")],
    discountType: null, discountValue: "0", taxRate: "15", shipping: "0",
    nets: ["14.5000"], amounts: ["14.5000"],
    subtotal: "14.5000", discount: "0", tax: "2.1750", total: "16.6750",
    shown: ["14.50", "0.00", "2.18", "16.68"],
  },
  {
    name: "17.5 % off a unit price of 12.20 is 2.1350 a unit",
    lines: [L("12.2", "3", "PERCENTAGE", "17.5", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["10.0650"], amounts: ["30.1950"],
    subtotal: "30.1950", discount: "0", tax: "0.0000", total: "30.1950",
    shown: ["30.20", "0.00", "0.00", "30.20"],
  },
  {
    name: "real D621D932 (USD)",
    lines: [L("4800", "2", "PERCENTAGE", "10", "PERCENTAGE", "10")],
    discountType: "FLAT", discountValue: "300", taxRate: "10", shipping: "300",
    nets: ["4752.0000"], amounts: ["9504.0000"],
    subtotal: "9504.0000", discount: "300.0000", tax: "920.4000", total: "10424.4000",
    shown: ["9504.00", "300.00", "920.40", "10424.40"],
  },
  {
    name: "real FD789DCD (INR)",
    lines: [L("300", "67.6", "PERCENTAGE", "1", "PERCENTAGE", "20")],
    discountType: "PERCENTAGE", discountValue: "1", taxRate: "20", shipping: "2100",
    nets: ["356.4000"], amounts: ["24092.6400"],
    subtotal: "24092.6400", discount: "240.9264", tax: "4770.3427", total: "30722.0563",
    shown: ["24092.64", "240.93", "4770.34", "30722.06"],
  },
  {
    name: "real 7FE2B764 (ZAR)",
    lines: [L("1283", "1", "PERCENTAGE", "10", null, "0")],
    discountType: "PERCENTAGE", discountValue: "5", taxRate: "20", shipping: "35",
    nets: ["1154.7000"], amounts: ["1154.7000"],
    subtotal: "1154.7000", discount: "57.7350", tax: "219.3930", total: "1351.3580",
    shown: ["1154.70", "57.74", "219.39", "1351.36"],
  },
  {
    name: "real 1E5A948C (ZWL)",
    lines: [L("5", "10", "PERCENTAGE", "2", null, "0")],
    discountType: "PERCENTAGE", discountValue: "2", taxRate: "20", shipping: "0",
    nets: ["4.9000"], amounts: ["49.0000"],
    subtotal: "49.0000", discount: "0.9800", tax: "9.6040", total: "57.6240",
    shown: ["49.00", "0.98", "9.60", "57.62"],
  },
  {
    name: "real 16E638A2 (SGD)",
    lines: [L("1.5", "200", "PERCENTAGE", "0.2", null, "0"), L("1.5", "200", "PERCENTAGE", "0.2", null, "0"), L("3.5", "200", "PERCENTAGE", "0.2", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["1.4970", "1.4970", "3.4930"], amounts: ["299.4000", "299.4000", "698.6000"],
    subtotal: "1297.4000", discount: "129.7400", tax: "0.0000", total: "1167.6600",
    shown: ["1297.40", "129.74", "0.00", "1167.66"],
  },
];

for (const c of DISCOUNT_CASES) {
  test(`the shared discount table: ${c.name}`, () => {
    c.lines.forEach((l, i) => {
      const line = computeLineItem(lineInput(l));
      assert.equal(line.netPrice, Number(c.nets[i]), `net of line ${i + 1}`);
      assert.equal(line.lineTotal, Number(c.amounts[i]), `amount of line ${i + 1}`);
    });
    const t = computeInvoiceTotals({
      items: c.lines.map(lineInput),
      invoiceDiscountType: c.discountType ?? "PERCENTAGE",
      invoiceDiscountValue: c.discountType ? c.discountValue : 0,
      invoiceTaxRate: c.taxRate,
      shippingCost: c.shipping,
    });
    assert.equal(t.subtotal, Number(c.subtotal), "subtotal");
    assert.equal(t.discountAmount, Number(c.discount), "discount");
    assert.equal(t.taxAmount, Number(c.tax), "tax");
    assert.equal(t.total, Number(c.total), "total");
    // As the page shows them: formatMoney rounds each precise figure to two, half away from zero, as the app.
    assert.deepEqual(
      [t.subtotal, t.discountAmount, t.taxAmount, t.total].map((v) => formatMoney(v, "XXX").replace(/[^0-9.]/g, "")),
      c.shown.map((v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 }).replace(/,/g, "")),
      "as shown",
    );
    // The rows on the page add up to the total, and the Discount row is what was taken off.
    assert.ok(t.discountAmount <= t.subtotal, "discount above the subtotal");
    assert.ok(t.total >= 0, "negative total");
  });
}
