/**
 * A document written in French (decision 0185) draws the curated French labels and French figures, and the
 * figures are the same numbers the English document shows.
 *
 * Run: node scripts/checks/run-french-invoice-check.mjs
 * (bundles this file with the repo's rolldown, then renders with react-dom/server — no DOM needed).
 * The English side — byte-identical output — is english-golden.check.tsx.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import type { InvoiceRenderData } from "@/lib/data";
import { documentLabels, translateDocument } from "@/lib/translate-document";
import { FR_ESTIMATE_LABELS, FR_LABELS, frenchLabelsFor } from "@/lib/invoice-labels-fr";
import { LABELS } from "@/lib/invoice-labels";
import { formatMoney } from "@/lib/format";
import { FIXTURES } from "./french-invoice.fixtures";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const fr = (d: InvoiceRenderData) => ({ ...d, language: "fr" }) as InvoiceRenderData;
/** Visible text only, entities decoded, so a label can be looked for as a reader sees it. */
function text(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

const NNBSP = " ";
const NBSP = " ";

for (const [name, base] of Object.entries(FIXTURES)) {
  const d = fr(base);
  const isEstimate = d.documentType === "ESTIMATE";
  const labels = isEstimate ? { ...FR_LABELS, ...FR_ESTIMATE_LABELS } : FR_LABELS;
  for (const [view, html] of [
    ["document", renderToStaticMarkup(<InvoiceDocument data={d} qrDataUrl="/qr.jpg" />)],
    ["paged", renderToStaticMarkup(<A4PagedFrame data={d} qrDataUrl="/qr.jpg" />)],
    ["share", renderToStaticMarkup(<SharedInvoiceViewer data={d} qrDataUrl="/qr.jpg" />)],
  ] as const) {
    const t = text(html);
    const tag = `${name}.${view}`;
    check(`${tag}: title is ${labels.invoice}`, t.includes(`\n${labels.invoice}\n`));
    for (const k of ["billTo", "invoiceDetails", "colQty", "colPrice", "colTax", "colAmount", "subTotal", "discount", "tax", "shipping", "notes"] as const) {
      check(`${tag}: shows ${k} = "${labels[k]}"`, t.includes(labels[k]));
    }
    check(`${tag}: "${labels.invoiceNo} : N°" with a no-break space before the colon`, t.includes(`${labels.invoiceNo}${NBSP}: ${d.invoiceNumber}`));
    // Not one English label of the document is left.
    for (const k of ["billTo", "invoiceDetails", "subTotal", "balanceDue", "amountPaid", "shipping", "issueDate", "dueDate", "paymentInstructions", "terms"] as const) {
      check(`${tag}: no English "${LABELS[k]}"`, !t.includes(LABELS[k]));
    }
    check(`${tag}: no English "Invoice #" / "Estimate #"`, !/(Invoice|Estimate) #/.test(t));
    // The total: TTC only when the document carries a tax.
    const hasTax = d.taxAmount !== 0 || d.items.some((it) => it.taxRate !== 0);
    check(`${tag}: TOTAL TTC exactly when there is a tax (${hasTax})`, t.includes("TOTAL TTC") === hasTax);
    // Figures: the French text of every total, and it reads back as the fixture's number.
    for (const [k, v] of [["subtotal", d.subtotal], ["discountAmount", d.discountAmount], ["taxAmount", d.taxAmount], ["total", d.total]] as const) {
      const shown = formatMoney(v, d.currency, "fr");
      check(`${tag}: ${k} shown as ${JSON.stringify(shown)}`, t.includes(shown));
      const back = Number(shown.split(NBSP)[0].replaceAll(NNBSP, "").replace(",", "."));
      check(`${tag}: ${k} reads back as ${v}`, Math.abs(back - Math.round(v * 100) / 100) < 1e-9, String(back));
    }
    check(`${tag}: no English-style amount (1,234.56) anywhere`, !/\d,\d{3}\.\d\d/.test(t));
    check(`${tag}: dates written the French way`, /\d{1,2} (janv\.|févr\.|mars|avr\.|mai|juin|juil\.|août|sept\.|oct\.|nov\.|déc\.) \d{4}/.test(t));
    check(`${tag}: no NaN / undefined`, !/NaN|undefined|Invalid Date/.test(t));
    if (!isEstimate && d.balanceDue != null) {
      check(`${tag}: RESTE À PAYER is on an invoice`, t.includes(FR_LABELS.balanceDue));
    }
    if (isEstimate) {
      check(`${tag}: an estimate has no RESTE À PAYER`, !t.includes(FR_LABELS.balanceDue));
      check(`${tag}: Valable jusqu'au`, t.includes(`Valable jusqu'au${NBSP}: `));
    }
  }
}

// The share page's picker: French is the curated set, never a translator's; a French document opens on it.
const doc = fr(FIXTURES.discountAndTax);
check("picker: documentLabels(invoice, fr) is the curated set", JSON.stringify(documentLabels("INVOICE", "fr")) === JSON.stringify(frenchLabelsFor("INVOICE")));
check("picker: documentLabels(estimate, fr) is the curated set", JSON.stringify(documentLabels("ESTIMATE", "fr")) === JSON.stringify(frenchLabelsFor("ESTIMATE")));
check("picker: a French document's picker starts on Français", /<option value="fr" selected="">/.test(renderToStaticMarkup(<SharedInvoiceViewer data={doc} />)));
check("picker: an English document's picker still starts on English", /<option value="en" selected="">/.test(renderToStaticMarkup(<SharedInvoiceViewer data={FIXTURES.discountAndTax} />)));

let calls = 0;
const never = async () => { calls++; return null; };
const toEn = await translateDocument(doc, "en", never);
check("reading a French document in English: English labels", toEn.labels.balanceDue === LABELS.balanceDue);
check("reading a French document in English: English figures", toEn.data.language === "en" && text(renderToStaticMarkup(<InvoiceDocument data={toEn.data} labels={toEn.labels} />)).includes("€3,965.74"));
const toFr = await translateDocument(FIXTURES.discountAndTax, "fr", async (texts) => texts);
check("reading an English document in French: curated labels", toFr.labels.balanceDue === FR_LABELS.balanceDue);
check("reading an English document in French: French figures", text(renderToStaticMarkup(<InvoiceDocument data={toFr.data} labels={toFr.labels} />)).includes(`3${NNBSP}965,74${NBSP}€`));
check("reading in English never calls the translator", calls === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
