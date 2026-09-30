/**
 * An invoice paid past its total shows BALANCE DUE as the negative figure in brackets (owner's decision, 2026-09-30).
 *
 * Run: node scripts/checks/run-overpaid-balance-check.mjs
 *
 * Total Rs658.00, paid Rs2,158.00: the app's invoice card reads "Balance Rs(1,500.00)", and the document now reads
 * "BALANCE DUE Rs(1,500.00)" where it read "Rs0.00" — through each of the three ways a document is drawn (the bare
 * document, the paged A4 frame of the app's offline bundle and /embed/render, and the share page's viewer), in every
 * language a document can be written in. On a right-to-left page the bracketed figure is isolated (FSI … PDI) like
 * every other figure, so it keeps its own order. AMOUNT PAID, TOTAL and the PAID stamp are untouched; an invoice that
 * is not overpaid is pinned byte for byte by the English golden.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import type { InvoiceRenderData } from "@/lib/data";
import { DOCUMENT_LANGUAGES, documentDir, writtenLabelsFor } from "@/lib/document-language";
import { formatBalanceDue, formatMoney } from "@/lib/format";
import { FIXTURES } from "./french-invoice.fixtures";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);

function text(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]*>/g, "\n").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/** The owner's invoice: total Rs658.00, two payments adding to Rs2,158.00, PAID. */
const overpaid = (language: string | null): InvoiceRenderData => ({
  ...FIXTURES.discountAndTax,
  currency: "Rs",
  subtotal: 658,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: 658,
  amountPaid: 2158,
  balanceDue: -1500,
  paymentStatus: "PAID",
  paymentStampImage: "/uploads/paid.png",
  language,
}) as InvoiceRenderData;

const views: Record<string, (d: InvoiceRenderData) => string> = {
  document: (d) => renderToStaticMarkup(<InvoiceDocument data={d} qrDataUrl="/qr.jpg" />),
  paged: (d) => renderToStaticMarkup(<A4PagedFrame data={d} qrDataUrl="/qr.jpg" />),
  share: (d) => renderToStaticMarkup(<SharedInvoiceViewer data={d} qrDataUrl="/qr.jpg" />),
};

// English, as the owner reads it.
for (const [view, render] of Object.entries(views)) {
  const t = text(render(overpaid(null)));
  check(`en ${view}: BALANCE DUE reads Rs(1,500.00)`, /BALANCE DUE\n+Rs\(1,500\.00\)/.test(t), t.slice(t.indexOf("BALANCE DUE"), t.indexOf("BALANCE DUE") + 60));
  check(`en ${view}: no Rs0.00 under BALANCE DUE`, !/BALANCE DUE\n+Rs0\.00/.test(t));
  check(`en ${view}: no minus sign on the balance`, !t.includes("Rs-1,500.00"));
  check(`en ${view}: AMOUNT PAID is still Rs2,158.00`, /AMOUNT PAID\n+Rs2,158\.00/.test(t));
  check(`en ${view}: TOTAL is still Rs658.00`, /TOTAL\n+Rs658\.00/.test(t));
}
check("paged: the PAID stamp is still drawn", /alt="Payment stamp"/.test(views.paged(overpaid(null))));

// Every document language: the balance is formatBalanceDue's, isolated on a right-to-left page.
for (const lang of DOCUMENT_LANGUAGES) {
  const d = overpaid(lang === "en" ? null : lang);
  const labels = writtenLabelsFor(lang, "INVOICE");
  const rtl = documentDir(d.language) === "rtl";
  const figure = formatBalanceDue(-1500, "Rs", lang);
  const expected = rtl ? `${FSI}${figure}${PDI}` : figure;
  check(`${lang}: the balance figure has brackets and no minus`, figure.includes("(") && figure.includes(")") && !figure.includes("-"), figure);
  check(`${lang}: the bracketed figure is the paid-in-full amount's digits`, figure.replace("(", "").replace(")", "") === formatMoney(1500, "Rs", lang), figure);
  for (const [view, render] of Object.entries(views)) {
    const t = text(render(d));
    const at = t.indexOf(labels.balanceDue);
    const after = at >= 0 ? t.slice(at + labels.balanceDue.length).replace(/^\n+/, "") : "";
    check(`${lang} ${view}: ${labels.balanceDue} → ${JSON.stringify(expected)}`, after.startsWith(expected), JSON.stringify(after.slice(0, 40)));
  }
}

// Not overpaid: the balance row is formatMoney's, as before.
for (const [name, fixture] of Object.entries(FIXTURES)) {
  if (fixture.balanceDue == null) continue;
  for (const [view, render] of Object.entries(views)) {
    const t = text(render(fixture as InvoiceRenderData));
    check(`${name} ${view}: an owed balance has no brackets`, !t.includes(`(${formatMoney(fixture.balanceDue, fixture.currency).replace(/^\D+/, "")})`));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
