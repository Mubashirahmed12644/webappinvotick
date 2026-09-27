// Run: npm test
//
// The shared discount table (owner, 2026-09-27: "dono discounts ko open rakho and jis jagha k jo issue hy
// usko fix kero"). The same cases, figure for figure, as the app's TheDocumentAddsUpLikeTheWebTest
// (feature/document/common): both tables are generated from one list, so a figure that differs between
// the two is a client seeing a different total from the owner.
//
// The rule both sides follow: each line's discount is taken per unit, to the cent and never past the
// price; the line's tax on the discounted price, to the cent; the net unit price is their sum; the line's
// amount is net × quantity, to the cent. The subtotal is the sum of the amounts; the invoice's discount is
// taken on it, to the cent and never past it; the invoice's tax on what is left; then shipping.
//
// The last five cases are real production invoices with both discounts (read-only, 2026-09-27). The first
// four reproduce their stored totals to the cent; the fifth was saved by a phone that kept unit prices to
// a tenth of a cent, and reads what every other phone and this page already read from the server's lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInvoiceTotals, computeLineItem, type DiscountType } from "./invoice-calc.ts";

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
    nets: ["90.00"], amounts: ["180.00"],
    subtotal: "180.00", discount: "0", tax: "0.00", total: "180.00",
  },
  {
    name: "item percent",
    lines: [L("100", "3", "PERCENTAGE", "15", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["85.00"], amounts: ["255.00"],
    subtotal: "255.00", discount: "0", tax: "0.00", total: "255.00",
  },
  {
    name: "invoice flat",
    lines: [L("100", "2", null, "0", null, "0")],
    discountType: "FLAT", discountValue: "50", taxRate: "0", shipping: "0",
    nets: ["100.00"], amounts: ["200.00"],
    subtotal: "200.00", discount: "50.00", tax: "0.00", total: "150.00",
  },
  {
    name: "invoice percent",
    lines: [L("250", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["250.00"], amounts: ["250.00"],
    subtotal: "250.00", discount: "25.00", tax: "0.00", total: "225.00",
  },
  {
    name: "both",
    lines: [L("100", "2", "PERCENTAGE", "10", null, "0")],
    discountType: "FLAT", discountValue: "20", taxRate: "0", shipping: "0",
    nets: ["90.00"], amounts: ["180.00"],
    subtotal: "180.00", discount: "20.00", tax: "0.00", total: "160.00",
  },
  {
    name: "both, with item tax, invoice tax and shipping",
    lines: [L("80", "3", "FLAT", "5", "PERCENTAGE", "10")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "5", shipping: "12.5",
    nets: ["82.50"], amounts: ["247.50"],
    subtotal: "247.50", discount: "24.75", tax: "11.14", total: "246.39",
  },
  {
    name: "item flat larger than the price",
    lines: [L("50", "2", "FLAT", "80", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.00"], amounts: ["0.00"],
    subtotal: "0.00", discount: "0", tax: "0.00", total: "0.00",
  },
  {
    name: "item percent above 100",
    lines: [L("40", "1", "PERCENTAGE", "150", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.00"], amounts: ["0.00"],
    subtotal: "0.00", discount: "0", tax: "0.00", total: "0.00",
  },
  {
    name: "invoice flat larger than the subtotal",
    lines: [L("100", "1", null, "0", null, "0")],
    discountType: "FLAT", discountValue: "150", taxRate: "0", shipping: "10",
    nets: ["100.00"], amounts: ["100.00"],
    subtotal: "100.00", discount: "100.00", tax: "0.00", total: "10.00",
  },
  {
    name: "invoice percent above 100 (production shape)",
    lines: [L("1", "1", "PERCENTAGE", "9", null, "0")],
    discountType: "PERCENTAGE", discountValue: "1227", taxRate: "0", shipping: "1227",
    nets: ["0.91"], amounts: ["0.91"],
    subtotal: "0.91", discount: "0.91", tax: "0.00", total: "1227.00",
  },
  {
    name: "zero",
    lines: [L("0", "1", "PERCENTAGE", "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["0.00"], amounts: ["0.00"],
    subtotal: "0.00", discount: "0.00", tax: "0.00", total: "0.00",
  },
  {
    name: "half a cent on an item discount",
    lines: [L("10.05", "1", "PERCENTAGE", "10", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["9.04"], amounts: ["9.04"],
    subtotal: "9.04", discount: "0", tax: "0.00", total: "9.04",
  },
  {
    name: "half a cent on the invoice discount",
    lines: [L("0.35", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["0.35"], amounts: ["0.35"],
    subtotal: "0.35", discount: "0.04", tax: "0.00", total: "0.31",
  },
  {
    name: "flat item discount and flat item tax",
    lines: [L("100", "1", "FLAT", "10", "FLAT", "5")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["95.00"], amounts: ["95.00"],
    subtotal: "95.00", discount: "0", tax: "0.00", total: "95.00",
  },
  {
    name: "fractional quantity rounds the line",
    lines: [L("9.99", "2.5", "PERCENTAGE", "3", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["9.69"], amounts: ["24.23"],
    subtotal: "24.23", discount: "0", tax: "0.00", total: "24.23",
  },
  {
    name: "15 % of 14.50 is 2.175: the discount is 2.18",
    lines: [L("14.5", "1", null, "0", null, "0")],
    discountType: "PERCENTAGE", discountValue: "15", taxRate: "0", shipping: "0",
    nets: ["14.50"], amounts: ["14.50"],
    subtotal: "14.50", discount: "2.18", tax: "0.00", total: "12.32",
  },
  {
    name: "15 % tax on 14.50 is 2.175: the tax is 2.18",
    lines: [L("14.5", "1", null, "0", null, "0")],
    discountType: null, discountValue: "0", taxRate: "15", shipping: "0",
    nets: ["14.50"], amounts: ["14.50"],
    subtotal: "14.50", discount: "0", tax: "2.18", total: "16.68",
  },
  {
    name: "17.5 % off a unit price of 12.20 is 2.135: 2.14 a unit",
    lines: [L("12.2", "3", "PERCENTAGE", "17.5", null, "0")],
    discountType: null, discountValue: "0", taxRate: "0", shipping: "0",
    nets: ["10.06"], amounts: ["30.18"],
    subtotal: "30.18", discount: "0", tax: "0.00", total: "30.18",
  },
  {
    name: "real D621D932 (USD)",
    lines: [L("4800", "2", "PERCENTAGE", "10", "PERCENTAGE", "10")],
    discountType: "FLAT", discountValue: "300", taxRate: "10", shipping: "300",
    nets: ["4752.00"], amounts: ["9504.00"],
    subtotal: "9504.00", discount: "300.00", tax: "920.40", total: "10424.40",
  },
  {
    name: "real FD789DCD (INR)",
    lines: [L("300", "67.6", "PERCENTAGE", "1", "PERCENTAGE", "20")],
    discountType: "PERCENTAGE", discountValue: "1", taxRate: "20", shipping: "2100",
    nets: ["356.40"], amounts: ["24092.64"],
    subtotal: "24092.64", discount: "240.93", tax: "4770.34", total: "30722.05",
  },
  {
    name: "real 7FE2B764 (ZAR)",
    lines: [L("1283", "1", "PERCENTAGE", "10", null, "0")],
    discountType: "PERCENTAGE", discountValue: "5", taxRate: "20", shipping: "35",
    nets: ["1154.70"], amounts: ["1154.70"],
    subtotal: "1154.70", discount: "57.74", tax: "219.39", total: "1351.35",
  },
  {
    name: "real 1E5A948C (ZWL)",
    lines: [L("5", "10", "PERCENTAGE", "2", null, "0")],
    discountType: "PERCENTAGE", discountValue: "2", taxRate: "20", shipping: "0",
    nets: ["4.90"], amounts: ["49.00"],
    subtotal: "49.00", discount: "0.98", tax: "9.60", total: "57.62",
  },
  {
    name: "real 16E638A2 (SGD)",
    lines: [L("1.5", "200", "PERCENTAGE", "0.2", null, "0"), L("1.5", "200", "PERCENTAGE", "0.2", null, "0"), L("3.5", "200", "PERCENTAGE", "0.2", null, "0")],
    discountType: "PERCENTAGE", discountValue: "10", taxRate: "0", shipping: "0",
    nets: ["1.50", "1.50", "3.49"], amounts: ["300.00", "300.00", "698.00"],
    subtotal: "1298.00", discount: "129.80", tax: "0.00", total: "1168.20",
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
    // The rows on the page add up to the total, and the Discount row is what was taken off.
    assert.ok(t.discountAmount <= t.subtotal, "discount above the subtotal");
    assert.ok(t.total >= 0, "negative total");
  });
}
