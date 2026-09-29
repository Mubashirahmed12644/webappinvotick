/**
 * A document written in Portuguese, Spanish, Arabic, Persian, Polish, Turkish or Chinese (decision 0187 and its second
 * wave) draws its hand-written labels, its own figures and dates, and the figures are the same numbers the English
 * document shows. An Arabic or Persian document reads right to left and isolates every figure, date, phone number and
 * invoice number, so none of them reorders.
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
import { DOCUMENT_LANGUAGES, documentDir, documentLanguage, labelSeparator, pageLine, writtenLabelsFor, type DocumentLanguage } from "@/lib/document-language";
import { LABELS } from "@/lib/invoice-labels";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
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

/**
 * The number a figure of [lang] says. Portuguese and Polish: "1 234,50 €"; Turkish: "1.234,50 €"; Spanish, Arabic,
 * Persian and Chinese: the English "€1,234.50".
 */
function valueOf(lang: DocumentLanguage, s: string): number {
  if (lang === "pt" || lang === "pl") return Number(s.split(NBSP).slice(0, -1).join("").replace(",", "."));
  if (lang === "tr") return Number(s.split(NBSP).slice(0, -1).join("").replaceAll(".", "").replace(",", "."));
  const figures = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? ["NaN"];
  return (s.includes("-") ? -1 : 1) * Number(figures[figures.length - 1].replaceAll(",", ""));
}

const LANGS = ["pt", "es", "ar", "fa", "pl", "tr", "zh"] as const;
const DATE_RE: Record<(typeof LANGS)[number], RegExp> = {
  pt: /\d{1,2}\s(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.\s\d{4}/,
  es: /\d{1,2}\s(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.\s\d{4}/,
  ar: /\d{2}\/\d{2}\/\d{4}/,
  fa: /\d{4}\/\d{2}\/\d{2}/,
  pl: /\d{2}\.\d{2}\.\d{4}/,
  tr: /\d{2}\.\d{2}\.\d{4}/,
  zh: /\d{4}年\d{1,2}月\d{1,2}日/,
};
const RTL_LANGS = new Set<string>(["ar", "fa"]);

for (const lang of LANGS) {
  for (const [name, base] of Object.entries(FIXTURES)) {
    const d = { ...base, language: lang } as InvoiceRenderData;
    const isEstimate = d.documentType === "ESTIMATE";
    const labels = writtenLabelsFor(lang, d.documentType);
    const rtl = RTL_LANGS.has(lang);
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
      const sep = labelSeparator(lang);
      check(`${tag}: "${labels.invoiceNo}${sep}N°"${rtl ? " with the number isolated" : ""}`, t.includes(`${labels.invoiceNo}${sep}${num}`));
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
        check(`${tag}: the issue date is isolated`, t.includes(`${FSI}${formatDate(d.invoiceDate, lang)}${PDI}`));
      } else {
        check(`${tag}: nothing is isolated on a left-to-right page`, !t.includes(FSI));
      }
      if (!isEstimate && d.balanceDue != null) check(`${tag}: ${labels.balanceDue} is on an invoice`, t.includes(labels.balanceDue));
      if (isEstimate) {
        check(`${tag}: an estimate has no ${labels.balanceDue}`, !t.includes(writtenLabelsFor(lang, "INVOICE").balanceDue));
        check(`${tag}: ${labels.dueDate}`, t.includes(`${labels.dueDate}${labelSeparator(lang)}`));
      }
    }
    // The share page's picker opens a document on the language it is written in (Chinese is the list's "zh-CN").
    const pickerCode = lang === "zh" ? "zh-CN" : lang;
    check(`${lang}.${name}: the picker starts on "${pickerCode}"`, new RegExp(`<option value="${pickerCode}" selected="">`).test(renderToStaticMarkup(<SharedInvoiceViewer data={d} />)));
  }
  check(`${lang}: documentLabels(invoice) is the curated set`, JSON.stringify(documentLabels("INVOICE", lang)) === JSON.stringify(writtenLabelsFor(lang, "INVOICE")));
  check(`${lang}: documentLabels(estimate) is the curated set`, JSON.stringify(documentLabels("ESTIMATE", lang)) === JSON.stringify(writtenLabelsFor(lang, "ESTIMATE")));
}

// The language table itself.
check("the written languages are en, fr, pt, es, ar, fa, pl, tr, zh", JSON.stringify(DOCUMENT_LANGUAGES) === JSON.stringify(["en", "fr", "pt", "es", "ar", "fa", "pl", "tr", "zh"]));
for (const [tag, lang] of [["pt-AO", "pt"], ["pt_BR", "pt"], ["es-419", "es"], ["ES", "es"], ["ar-EG", "ar"], ["fa-IR", "fa"], ["pl-PL", "pl"], ["tr-TR", "tr"], ["zh-CN", "zh"], ["zh-Hans-CN", "zh"], ["de", "en"], [null, "en"], ["", "en"]] as const) {
  check(`documentLanguage(${JSON.stringify(tag)}) = ${lang}`, documentLanguage(tag) === lang);
}
check("an Arabic document reads right to left", documentDir("ar-DZ") === "rtl");
check("a Persian document reads right to left", documentDir("fa-IR") === "rtl");
check("no other document does", ["en", "fr", "pt", "es", "pl", "tr", "zh", null, "ur"].every((l) => documentDir(l) === "ltr"));
check("page lines", pageLine("pt", 1, 3) === "Página 1 de 3" && pageLine("es", 2, 3) === "Página 2 de 3" && pageLine("ar", 1, 2) === "الصفحة 1 من 2" && pageLine("en", 1, 2) === "Page 1 of 2");
check("page lines, second wave", pageLine("fa", 1, 2) === "صفحه 1 از 2" && pageLine("pl", 1, 2) === "Strona 1 z 2" && pageLine("tr", 1, 2) === "Sayfa 1 / 2" && pageLine("zh", 1, 2) === "第 1 页，共 2 页");
check("Polish figures", formatMoney(1234.5, "PLN", "pl") === `1${NBSP}234,50${NBSP}zł` && formatMoney(-5, "EUR", "pl") === `-5,00${NBSP}€`);
check("Turkish figures", formatMoney(1234.5, "TRY", "tr") === `1.234,50${NBSP}₺` && formatMoney(1234567.89, "EUR", "tr") === `1.234.567,89${NBSP}€`);
check("Persian and Chinese keep the English figure", formatMoney(1234.5, "IRR", "fa") === formatMoney(1234.5, "IRR", "en") && formatMoney(1234.5, "CNY", "zh") === formatMoney(1234.5, "CNY", "en"));
check("second-wave dates", formatDate("2026-09-29", "fa") === "2026/09/29" && formatDate("2026-09-29", "pl") === "29.09.2026" && formatDate("2026-09-29", "tr") === "29.09.2026" && formatDate("2026-09-05", "zh") === "2026年9月5日");

// Reading across languages on the share page.
const never = async () => null;
const arDoc = { ...FIXTURES.discountAndTax, language: "ar" } as InvoiceRenderData;
const arToEn = await translateDocument(arDoc, "en", never);
check("reading an Arabic document in English: English labels, left to right", arToEn.labels.balanceDue === LABELS.balanceDue && arToEn.dir === "ltr" && arToEn.data.language === "en");
const enToPt = await translateDocument(FIXTURES.discountAndTax, "pt", async (texts) => texts);
check("reading an English document in Portuguese: curated labels and Portuguese figures", enToPt.labels.balanceDue === "VALOR EM DÍVIDA" && text(renderToStaticMarkup(<InvoiceDocument data={enToPt.data} labels={enToPt.labels} />)).includes(`3${NBSP}965,74${NBSP}€`));
const enToAr = await translateDocument(FIXTURES.discountAndTax, "ar", async (texts) => texts);
check("reading an English document in Arabic: right to left, curated labels, isolated figures", enToAr.dir === "rtl" && enToAr.labels.total === "الإجمالي" && text(renderToStaticMarkup(<InvoiceDocument data={enToAr.data} labels={enToAr.labels} dir={enToAr.dir} />)).includes(`${FSI}€3,965.74${PDI}`));

const enToZh = await translateDocument(FIXTURES.discountAndTax, "zh-CN", async (texts) => texts);
check("reading an English document in the picker's Chinese: the hand-written set, Chinese dates", enToZh.labels.total === "合计" && enToZh.data.language === "zh" && enToZh.dir === "ltr");
const enToFa = await translateDocument(FIXTURES.discountAndTax, "fa", async (texts) => texts);
check("reading an English document in Persian: right to left, the hand-written set", enToFa.dir === "rtl" && enToFa.labels.balanceDue === "مانده قابل پرداخت" && text(renderToStaticMarkup(<InvoiceDocument data={enToFa.data} labels={enToFa.labels} dir={enToFa.dir} />)).includes(`${FSI}€3,965.74${PDI}`));
check("a Turkish rate puts its sign first", formatPercent(20, "tr") === "%20,00" && formatPercent(20, "pl") === "20,00%");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
