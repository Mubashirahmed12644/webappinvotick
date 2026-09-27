/**
 * Both discounts, as the document shows them and as the invoice form takes them (owner, 2026-09-27:
 * "dono discounts ko open rakho and jis jagha k jo issue hy usko fix kero").
 *
 * Run: node scripts/checks/run-discount-display-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 *
 * - The Disc column shows a flat discount as money in the invoice's currency, as the native PDF does
 *   ("Rs50.00"); it showed a bare "50.00", which a client cannot tell from 50 %.
 * - The Discount row shows the amount taken off, which the calculation never lets past the subtotal.
 * - The invoice form refuses a discount typed past the price or the subtotal, in the app's words ("Rok de
 *   aur bataye", owner 2026-09-27), and leaves a saved line that it has not changed alone.
 * - Figures are kept at four decimals and shown at two, rounded as the app rounds them.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import type { InvoiceRenderData } from "@/lib/data";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { moneyKey, prepareInvoice, type FormRow } from "@/lib/invoice-preview";
import { formatMoney } from "@/lib/format";

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failed++;
}

// ── The document ────────────────────────────────────────────────────────────────────────────────
const items = [
  { sn: 1, name: "Flat off", quantity: 2, unitPrice: 400, discountValue: 50, discountType: "FLAT", taxRate: 0, amount: 700 },
  { sn: 2, name: "Percent off", quantity: 1, unitPrice: 100, discountValue: 20, discountType: "PERCENTAGE", taxRate: 0, amount: 80 },
  { sn: 3, name: "Stored as FIXED", quantity: 1, unitPrice: 100, discountValue: 10, discountType: "FIXED", taxRate: 0, amount: 90 },
  { sn: 4, name: "No discount", quantity: 1, unitPrice: 30, discountValue: 0, discountType: "FLAT", taxRate: 0, amount: 30 },
];
const totals = computeInvoiceTotals({
  items: [
    { quantity: 2, unitPrice: 400, discountValue: 50, discountType: "FLAT" },
    { quantity: 1, unitPrice: 100, discountValue: 20, discountType: "PERCENTAGE" },
    { quantity: 1, unitPrice: 100, discountValue: 10, discountType: "FLAT" },
    { quantity: 1, unitPrice: 30 },
  ],
  invoiceDiscountType: "FLAT",
  invoiceDiscountValue: 2000, // more than the 900 subtotal: 900 is taken, the total is the shipping
  shippingCost: 25,
});
const data: InvoiceRenderData = {
  id: "inv-1",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-09-27",
  status: "SENT" as InvoiceRenderData["status"],
  currency: "PKR",
  subtotal: totals.subtotal,
  discountAmount: totals.discountAmount,
  taxAmount: totals.taxAmount,
  shippingCost: totals.shippingCost,
  total: totals.total,
  color: "#0D4DC0",
  toggles: { items: true, total: true },
  business: { name: "Shop" } as InvoiceRenderData["business"],
  client: null,
  backgroundOpacity: 0,
  items,
};
const html = renderToStaticMarkup(<InvoiceDocument data={data} />);
const cells = [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1]));
const row = (name: string) => cells.find((r) => r[1] === name) ?? [];

check("a flat discount shows as money in the invoice's currency", row("Flat off")[4] === formatMoney(50, "PKR"), `got ${row("Flat off")[4]}`);
check("a percentage shows as a percentage", row("Percent off")[4] === "20.00%", `got ${row("Percent off")[4]}`);
check("a stored FIXED is a flat amount, as the app reads it", row("Stored as FIXED")[4] === formatMoney(10, "PKR"), `got ${row("Stored as FIXED")[4]}`);
check("a line with no discount shows 0.00, as native", row("No discount")[4] === "0.00", `got ${row("No discount")[4]}`);
check("the subtotal is the lines: 700 + 80 + 90 + 30", totals.subtotal === 900);
check("the Discount row is what was taken off, never past the subtotal", totals.discountAmount === 900 && html.includes(formatMoney(900, "PKR")));
check("the total is never below zero: only the shipping is left", totals.total === 25);

// ── Four decimals calculated, two shown ─────────────────────────────────────────────────────────
const quarter = computeInvoiceTotals({ items: [{ quantity: 1, unitPrice: 14.5 }], invoiceDiscountType: "PERCENTAGE", invoiceDiscountValue: 15 });
check("15 % of 14.50 is kept as 2.1750", quarter.discountAmount === 2.175);
check("and shown as 2.18, as the app shows it (Number rounding read 2.17)", formatMoney(quarter.discountAmount, "USD") === "$2.18", formatMoney(quarter.discountAmount, "USD"));
check("0.70 less 5 % at 1,000 is 665.00, not 660.00", formatMoney(computeInvoiceTotals({ items: [{ quantity: 1000, unitPrice: 0.7, discountValue: 5 }] }).total, "USD") === "$665.00");

// ── The invoice form ────────────────────────────────────────────────────────────────────────────
const blank: FormRow = { name: "Item", description: "", quantity: "1", unitPrice: "50", discountValue: "", discountType: "PERCENTAGE", taxValue: "" };
const form = (rows: FormRow[], discountValue = "", discountType: "PERCENTAGE" | "FLAT" = "PERCENTAGE") =>
  prepareInvoice({ rows, discountValue, discountType, taxRate: 0, shipping: "" });

check("a flat line discount past the price is refused", form([{ ...blank, discountValue: "80", discountType: "FLAT" }]).rowProblems[0] === "Item 1: Discount can't be more than the price.");
check("a line discount above 100 % is refused", form([{ ...blank, discountValue: "150" }]).rowProblems[0] === "Item 1: Discount can't be more than the price.");
check("a line discount of exactly the price is taken", form([{ ...blank, discountValue: "50", discountType: "FLAT" }]).rowProblems[0] === null);
const legacy: FormRow = { ...blank, discountValue: "1500", saved: true };
legacy.kept = { netPrice: 0, tax: { taxRate: 0, taxType: "PERCENTAGE", taxAmount: 0 }, key: moneyKey(legacy) };
check("a saved line left as it was is not refused, whatever it was saved with", form([legacy]).rowProblems[0] === null);
check("an invoice discount past the subtotal is refused", form([blank], "60", "FLAT").problems.includes("Discount can't be more than the subtotal."));
check("an invoice discount above 100 % is refused", form([blank], "101").problems.includes("Discount can't be more than the subtotal."));
check("an invoice discount of the whole subtotal is taken", !form([blank], "100").problems.includes("Discount can't be more than the subtotal."));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
