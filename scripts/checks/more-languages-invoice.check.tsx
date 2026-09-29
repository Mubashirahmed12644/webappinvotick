/**
 * A document written in Portuguese, Spanish or Arabic (decision 0187) draws its hand-written labels, its own figures
 * and dates, and the figures are the same numbers the English document shows. An Arabic document reads right to left
 * and isolates every figure, date, phone number and invoice number, so none of them reorders.
 *
 * Run: node scripts/checks/run-more-languages-invoice-check.mjs
 * The English side — byte-identical output — is english-golden.check.tsx; French is french-invoice.check.tsx.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import type { InvoiceRenderData } from "@/lib/data";
import { documentLabels, translateDocument } from "@/lib/translate-document";
import { DOCUMENT_LANGUAGES, documentDir, documentLanguage, pageLine, writtenLabelsFor, type DocumentLanguage } from "@/lib/document-language";
import { LABELS } from "@/lib/invoice-labels";
import { formatDate, formatMoney } from "@/lib/format";
import { FIXTURES } from "./french-invoice.fixtures";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);
const NBSP = String.fromCharCode(0xa0);

function text(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

/** The number a figure of [lang] says. Portuguese: "1 234,50 €"; Spanish and Arabic: the English "€1,234.50". */
function valueOf(lang: DocumentLanguage, s: string): number {
  if (lang === "pt") return Number(s.split(NBSP).slice(0, -1).join("").replace(",", "."));
  // Wave 2: German "1.234,50 €", Dutch "€ 1.234,50", Indonesian "€1.234,50" (dot thousands), Swedish "1 234,50 €".
  if (lang === "de" || lang === "nl" || lang === "id" || lang === "sv") {
    const group = lang === "sv" ? NBSP : "\\.";
    const runs = s.match(new RegExp(`\\d{1,3}(?:${group}\\d{3})*(?:,\\d+)?`, "g")) ?? ["NaN"];
    if (runs.length !== 1) return NaN;
    return (s.includes("-") ? -1 : 1) * Number(runs[0].split(lang === "sv" ? NBSP : ".").join("").replace(",", "."));
  }
  const figures = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? ["NaN"];
  return (s.includes("-") ? -1 : 1) * Number(figures[figures.length - 1].replaceAll(",", ""));
}

const LANGS = ["pt", "es", "ar", "de", "id", "nl", "sv"] as const;
const DATE_RE: Record<(typeof LANGS)[number], RegExp> = {
  pt: /\d{1,2}\s(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.\s\d{4}/,
  es: /\d{1,2}\s(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.\s\d{4}/,
  ar: /\d{2}\/\d{2}\/\d{4}/,
  de: /\d{2}\.\d{2}\.\d{4}/,
  id: /\d{1,2}\s(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s\d{4}/,
  nl: /\d{1,2}\s(jan\.|feb\.|mrt\.|apr\.|mei|jun\.|jul\.|aug\.|sep\.|okt\.|nov\.|dec\.)\s\d{4}/,
  sv: /\d{4}-\d{2}-\d{2}/,
};

for (const lang of LANGS) {
  for (const [name, base] of Object.entries(FIXTURES)) {
    const d = { ...base, language: lang } as InvoiceRenderData;
    const isEstimate = d.documentType === "ESTIMATE";
    const labels = writtenLabelsFor(lang, d.documentType);
    const rtl = lang === "ar";
    for (const [view, html] of [
      ["document", renderToStaticMarkup(<InvoiceDocument data={d} qrDataUrl="/qr.jpg" />)],
      ["paged", renderToStaticMarkup(<A4PagedFrame data={d} qrDataUrl="/qr.jpg" />)],
      ["share", renderToStaticMarkup(<SharedInvoiceViewer data={d} qrDataUrl="/qr.jpg" />)],
    ] as const) {
      const t = text(html);
      const tag = `${lang}.${name}.${view}`;
      check(`${tag}: title is ${labels.invoice}`, t.includes(`\n${labels.invoice}\n`));
      for (const k of ["billTo", "invoiceDetails", "colQty", "colPrice", "colTax", "colAmount", "subTotal", "discount", "tax", "shipping", "notes"] as const) {
        check(`${tag}: shows ${k} = "${labels[k]}"`, t.includes(labels[k]));
      }
      const num = rtl ? `${FSI}${d.invoiceNumber}${PDI}` : d.invoiceNumber;
      check(`${tag}: "${labels.invoiceNo}: N°"${rtl ? " with the number isolated" : ""}`, t.includes(`${labels.invoiceNo}: ${num}`));
      for (const k of ["billTo", "invoiceDetails", "subTotal", "balanceDue", "amountPaid", "shipping", "issueDate", "dueDate", "paymentInstructions", "terms"] as const) {
        check(`${tag}: no English "${LABELS[k]}"`, !t.includes(LABELS[k]));
      }
      check(`${tag}: no English "Invoice #" / "Estimate #"`, !/(Invoice|Estimate) #/.test(t));
      check(`${tag}: no TTC outside French`, !t.includes("TTC"));
      for (const [k, v] of [["subtotal", d.subtotal], ["discountAmount", d.discountAmount], ["taxAmount", d.taxAmount], ["total", d.total]] as const) {
        const shown = formatMoney(v, d.currency, lang);
        const drawn = rtl ? `${FSI}${shown}${PDI}` : shown;
        check(`${tag}: ${k} shown as ${JSON.stringify(drawn)}`, t.includes(drawn));
        check(`${tag}: ${k} reads back as ${v}`, Math.abs(valueOf(lang, shown) - Math.round(v * 100) / 100) < 1e-9, String(valueOf(lang, shown)));
      }
      check(`${tag}: dates written the ${lang} way`, DATE_RE[lang].test(t));
      check(`${tag}: no NaN / undefined`, !/NaN|undefined|Invalid Date/.test(t));
      check(`${tag}: dir is ${rtl ? "rtl" : "ltr"}`, html.includes(`dir="${rtl ? "rtl" : "ltr"}"`) && !html.includes(`dir="${rtl ? "ltr" : "rtl"}"`));
      if (rtl) {
        check(`${tag}: the client's phone is isolated`, t.includes(`${FSI}${d.client?.phone}${PDI}`));
        check(`${tag}: the issue date is isolated`, t.includes(`${FSI}${formatDate(d.invoiceDate, "ar")}${PDI}`));
      } else {
        check(`${tag}: nothing is isolated on a left-to-right page`, !t.includes(FSI));
      }
      if (!isEstimate && d.balanceDue != null) check(`${tag}: ${labels.balanceDue} is on an invoice`, t.includes(labels.balanceDue));
      if (isEstimate) {
        check(`${tag}: an estimate has no ${labels.balanceDue}`, !t.includes(writtenLabelsFor(lang, "INVOICE").balanceDue));
        check(`${tag}: ${labels.dueDate}`, t.includes(`${labels.dueDate}: `));
      }
    }
    // The share page's picker opens a document on the language it is written in.
    check(`${lang}.${name}: the picker starts on "${lang}"`, new RegExp(`<option value="${lang}" selected="">`).test(renderToStaticMarkup(<SharedInvoiceViewer data={d} />)));
  }
  check(`${lang}: documentLabels(invoice) is the curated set`, JSON.stringify(documentLabels("INVOICE", lang)) === JSON.stringify(writtenLabelsFor(lang, "INVOICE")));
  check(`${lang}: documentLabels(estimate) is the curated set`, JSON.stringify(documentLabels("ESTIMATE", lang)) === JSON.stringify(writtenLabelsFor(lang, "ESTIMATE")));
}

// The language table itself.
check("the written languages are en, fr, pt, es, ar, de, id, nl, sv", JSON.stringify(DOCUMENT_LANGUAGES) === JSON.stringify(["en", "fr", "pt", "es", "ar", "de", "id", "nl", "sv"]));
for (const [tag, lang] of [["pt-AO", "pt"], ["pt_BR", "pt"], ["es-419", "es"], ["ES", "es"], ["ar-EG", "ar"], ["de-AT", "de"], ["id-TL", "id"], ["in-ID", "id"], ["nl-SR", "nl"], ["sv_SE", "sv"], ["ja", "en"], [null, "en"], ["", "en"]] as const) {
  check(`documentLanguage(${JSON.stringify(tag)}) = ${lang}`, documentLanguage(tag) === lang);
}
check("an Arabic document reads right to left", documentDir("ar-DZ") === "rtl");
check("no other document does", ["en", "fr", "pt", "es", null, "fa"].every((l) => documentDir(l) === "ltr"));
check("page lines", pageLine("pt", 1, 3) === "Página 1 de 3" && pageLine("es", 2, 3) === "Página 2 de 3" && pageLine("ar", 1, 2) === "الصفحة 1 من 2" && pageLine("en", 1, 2) === "Page 1 of 2");
check("wave 2 page lines", pageLine("de", 1, 3) === "Seite 1 von 3" && pageLine("id", 2, 3) === "Halaman 2 dari 3" && pageLine("nl", 1, 2) === "Pagina 1 van 2" && pageLine("sv", 1, 2) === "Sida 1 av 2");
check("wave 2 figures", formatMoney(1234.5, "EUR", "de") === `1.234,50${NBSP}€` && formatMoney(1234.5, "EUR", "nl") === `€${NBSP}1.234,50` && formatMoney(1234.5, "IDR", "id").endsWith("1.234,50") && formatMoney(1234.5, "SEK", "sv") === `1${NBSP}234,50${NBSP}kr`, [formatMoney(1234.5, "EUR", "de"), formatMoney(1234.5, "EUR", "nl"), formatMoney(1234.5, "IDR", "id"), formatMoney(1234.5, "SEK", "sv")].join(" | "));
check("wave 2 dates", formatDate("2026-09-29", "de") === "29.09.2026" && formatDate("2026-09-29", "sv") === "2026-09-29" && formatDate("2026-09-29", "nl") === `29${NBSP}sep.${NBSP}2026` && formatDate("2026-08-05", "id") === `5${NBSP}Agu${NBSP}2026`);
// German, Dutch and Swedish say "incl. tax" on the total only when the document carries a tax (as French "TTC").
for (const lang of ["de", "nl", "sv"] as const) {
  const withTax = text(renderToStaticMarkup(<InvoiceDocument data={{ ...FIXTURES.discountAndTax, language: lang } as InvoiceRenderData} qrDataUrl="/qr.jpg" />));
  check(`${lang}: the taxed total says ${writtenLabelsFor(lang, "INVOICE").totalWithTax}`, withTax.includes(writtenLabelsFor(lang, "INVOICE").totalWithTax!));
}

// Reading across languages on the share page.
const never = async () => null;
const arDoc = { ...FIXTURES.discountAndTax, language: "ar" } as InvoiceRenderData;
const arToEn = await translateDocument(arDoc, "en", never);
check("reading an Arabic document in English: English labels, left to right", arToEn.labels.balanceDue === LABELS.balanceDue && arToEn.dir === "ltr" && arToEn.data.language === "en");
const enToPt = await translateDocument(FIXTURES.discountAndTax, "pt", async (texts) => texts);
check("reading an English document in Portuguese: curated labels and Portuguese figures", enToPt.labels.balanceDue === "VALOR EM DÍVIDA" && text(renderToStaticMarkup(<InvoiceDocument data={enToPt.data} labels={enToPt.labels} />)).includes(`3${NBSP}965,74${NBSP}€`));
const enToAr = await translateDocument(FIXTURES.discountAndTax, "ar", async (texts) => texts);
check("reading an English document in Arabic: right to left, curated labels, isolated figures", enToAr.dir === "rtl" && enToAr.labels.total === "الإجمالي" && text(renderToStaticMarkup(<InvoiceDocument data={enToAr.data} labels={enToAr.labels} dir={enToAr.dir} />)).includes(`${FSI}€3,965.74${PDI}`));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
