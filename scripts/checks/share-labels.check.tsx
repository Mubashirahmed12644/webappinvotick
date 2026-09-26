/**
 * Decision 0174 — the share page's labels are the table's, the same words the app shows.
 *
 * Run: node scripts/checks/run-share-labels-check.mjs
 *      APP_REPO=~/Documents/Invotick/invoice-kmp-app node scripts/checks/run-share-labels-check.mjs
 *        (also compares against the app's generated Kotlin copy of the table)
 *
 * The share page (`/i/{token}`) translates through `translateInvoice`. It used to send every label to
 * the live translator, so a client read "发件人" and "扫描下载Invotic" where the business owner's own
 * preview said "销售方" and "扫描下载 Invotick". Here the live translator is replaced by a stub that
 * marks everything it touches, so a label that went through it cannot pass for one from the table.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import type { InvoiceRenderData } from "@/lib/data";
import { LABELS, LABEL_KEYS, LABEL_TRANSLATION_SOURCE, labelsFor, type InvoiceLabels } from "@/lib/invoice-labels";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "@/lib/invoice-labels-i18n";
import { LANGUAGES } from "@/lib/translate";
import { translateInvoice } from "@/lib/translate-invoice";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else failed++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}

// ── The live translator, stubbed: it marks what it translates, and remembers what it was sent ──────
const sent: string[][] = [];
const LIVE = "⟦live⟧";
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.endsWith("/api/translate")) throw new Error(`unexpected fetch: ${url}`);
  const body = JSON.parse(String(init?.body ?? "{}")) as { texts: string[] };
  sent.push(body.texts);
  const texts = body.texts.map((t) => (t.trim() ? `${LIVE}${t}` : t));
  return new Response(JSON.stringify({ texts }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const doc: InvoiceRenderData = {
  id: "inv-1",
  invoiceNumber: "INV-0042",
  invoiceDate: "2026-09-05",
  dueDate: "2026-09-20",
  poNumber: "PO-77",
  status: "UNPAID" as InvoiceRenderData["status"],
  currency: "PKR",
  subtotal: 1500,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: 1500,
  color: "#0D4DC0",
  toggles: { title: true, sender: true, receiver: true, items: true, total: true, notes: true, payment: true, terms: true },
  business: { name: "Ahmed Traders", addressLine1: "12 Mall Road", city: "Lahore", country: "Pakistan" },
  client: {
    name: "Bilal Khan",
    companyName: "Khan Textiles",
    addressLine1: "5 Canal View",
    city: "Faisalabad",
    country: "Pakistan",
  } as InvoiceRenderData["client"],
  backgroundOpacity: 0,
  items: [
    { sn: 1, name: "Cotton fabric", quantity: 10, unitPrice: 100, discountValue: 0, discountType: "PERCENT", taxRate: 0, amount: 1000 },
    { sn: 2, name: "Delivery to shop", quantity: 1, unitPrice: 500, discountValue: 0, discountType: "PERCENT", taxRate: 0, amount: 500 },
  ],
  notes: "Thank you for your business",
  paymentInstructions: "Pay by bank transfer",
  terms: "Payment within 15 days",
};
const estimate: InvoiceRenderData = { ...doc, documentType: "ESTIMATE" };

/** What the app shows: the English set for the type with the table over it — computed straight from
 *  the table, NOT through the code under test. */
function tableLabels(d: InvoiceRenderData, lang: string): InvoiceLabels {
  return {
    ...labelsFor(d.documentType),
    ...(LABEL_TRANSLATIONS[lang] ?? {}),
    ...(d.documentType === "ESTIMATE" ? ESTIMATE_LABEL_TRANSLATIONS[lang] ?? {} : {}),
  };
}

function diffLabels(got: InvoiceLabels | undefined, want: InvoiceLabels): string {
  if (!got) return "no labels returned";
  const bad = LABEL_KEYS.filter((k) => got[k] !== want[k]).slice(0, 4);
  return bad.map((k) => `${k}: got ${JSON.stringify(got[k])}, table says ${JSON.stringify(want[k])}`).join("; ");
}

const tableLangs = Object.keys(LABEL_TRANSLATIONS);
const pickerLangs = LANGUAGES.map((l) => l.code).filter((c) => c !== "en");

// 0. The picker offers exactly the table's languages — nothing on the share page can fall off it.
check(
  "every language in the share page's picker has a row in the label table",
  pickerLangs.every((c) => tableLangs.includes(c)),
  `missing: ${pickerLangs.filter((c) => !tableLangs.includes(c)).join(", ")}`,
);

// 1. Labels: the named three first, so a failure names them; then every table language.
const labelWords = new Set<string>([
  ...Object.values(LABELS),
  ...Object.values(labelsFor("ESTIMATE")),
  ...Object.values(LABEL_TRANSLATION_SOURCE).filter(Boolean) as string[],
]);
for (const lang of ["zh-CN", "ar", "fr", ...tableLangs.filter((l) => !["zh-CN", "ar", "fr"].includes(l))]) {
  for (const d of [doc, estimate]) {
    const kind = d.documentType === "ESTIMATE" ? "estimate" : "invoice";
    sent.length = 0;
    const t = await translateInvoice(d, lang);
    const want = tableLabels(d, lang);
    check(`${lang} ${kind}: every label is the table's`, LABEL_KEYS.every((k) => t.labels?.[k] === want[k]), diffLabels(t.labels, want));
    const leaked = sent.flat().filter((s) => labelWords.has(s));
    check(`${lang} ${kind}: no label is sent to the live translator`, leaked.length === 0, `sent: ${leaked.slice(0, 5).join(" | ")}`);
  }
}

// 2. What goes to the translator, and what never does — asked of the share page's own path.
sent.length = 0;
const zh = await translateInvoice(doc, "zh-CN");
const all = sent.flat();
const never = [
  "Ahmed Traders", "Bilal Khan", "Khan Textiles", "5 Canal View", "Faisalabad", "Pakistan", "12 Mall Road", "Lahore",
  "INV-0042", "PO-77", "2026-09-05", "2026-09-20", "1500", "PKR",
];
for (const s of never) check(`never sent to the translator: ${s}`, !all.some((x) => x.includes(s)), `sent: ${all.join(" | ")}`);
for (const s of ["Cotton fabric", "Delivery to shop", "Thank you for your business", "Pay by bank transfer", "Payment within 15 days"]) {
  check(`free text is sent to the translator: ${s}`, all.includes(s), `sent: ${all.join(" | ")}`);
}
check("item descriptions come back translated", zh.data.items.every((it) => it.name.startsWith(LIVE)));
check("notes, payment instructions and terms come back translated",
  [zh.data.notes, zh.data.paymentInstructions, zh.data.terms].every((s) => s?.startsWith(LIVE)));
check("the business's and the client's names stay as written",
  zh.data.business?.name === "Ahmed Traders" && zh.data.client?.name === "Bilal Khan" && zh.data.client?.companyName === "Khan Textiles");
check("amounts, dates and the number are untouched",
  zh.data.total === 1500 && zh.data.invoiceNumber === "INV-0042" && zh.data.invoiceDate === "2026-09-05");

// 3. A translator that fails still leaves the table's labels on the page.
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;
const down = await translateInvoice(doc, "ar");
globalThis.fetch = realFetch;
check("translator down: Arabic labels still come from the table", LABEL_KEYS.every((k) => down.labels[k] === tableLabels(doc, "ar")[k]), diffLabels(down.labels, tableLabels(doc, "ar")));
check("translator down: the free text stays as written", down.data.notes === doc.notes && down.data.items[0].name === "Cotton fabric");
check("Arabic reads right to left", down.dir === "rtl");

// 4. The brand name, in every language of both tables.
for (const [name, table] of [["invoice", LABEL_TRANSLATIONS], ["estimate", ESTIMATE_LABEL_TRANSLATIONS]] as const) {
  for (const [lang, row] of Object.entries(table)) {
    for (const [k, v] of Object.entries(row)) {
      const english = (name === "estimate" ? labelsFor("ESTIMATE") : LABELS)[k as keyof InvoiceLabels];
      if (english.includes("Invotick")) {
        check(`${name} table ${lang}.${k} spells Invotick whole`, (v as string).includes("Invotick"), JSON.stringify(v));
      }
    }
  }
}

// 5. The rendered share page, the way a client reads it.
for (const [lang, words] of [
  ["zh-CN", ["销售方", "购买方", "折扣", "采购订单号", "扫描下载 Invotick", "使用 Invotick 生成的发票", `${LIVE}Cotton fabric`, `${LIVE}Thank you for your business`]],
  ["ar", [LABEL_TRANSLATIONS.ar.from!, LABEL_TRANSLATIONS.ar.billTo!, LABEL_TRANSLATIONS.ar.colDisc!, LABEL_TRANSLATIONS.ar.footerScan!, `${LIVE}Cotton fabric`]],
] as const) {
  const t = await translateInvoice(doc, lang);
  const html = renderToStaticMarkup(<A4PagedFrame data={t.data} labels={t.labels} dir={t.dir} />);
  for (const w of words) check(`${lang} rendered page shows ${w}`, html.includes(w));
  check(`${lang} rendered page never shows a cut brand`, !/Invotic(?!k)/.test(html));
}

// 6. Optional: the app's own generated copy of the table (what 1.4.x actually ships).
const appRepo = process.env.APP_REPO;
if (appRepo) {
  const kt = readFileSync(
    `${appRepo}/core/common/src/commonMain/kotlin/invotick/invoicemaker/core/common/model/InvoiceLabelTranslations.kt`,
    "utf8",
  );
  const parse = (name: string) => {
    const block = kt.split(`val ${name}`)[1].split("\nval ")[0];
    const out: Record<string, Record<string, string>> = {};
    for (const m of block.matchAll(/"([\w-]+)" to mapOf\(\n([\s\S]*?)\n {4}\),/g)) {
      out[m[1]] = Object.fromEntries([...m[2].matchAll(/"(\w+)" to ("(?:[^"\\]|\\.)*"),/g)].map((e) => [e[1], JSON.parse(e[2])]));
    }
    return out;
  };
  const app = { invoice: parse("INVOICE_LABEL_TRANSLATIONS"), estimate: parse("ESTIMATE_LABEL_TRANSLATIONS") };
  for (const lang of tableLangs) {
    for (const d of [doc, estimate]) {
      const kind = d.documentType === "ESTIMATE" ? "estimate" : "invoice";
      const appLabels = { ...labelsFor(d.documentType), ...(app.invoice[lang] ?? {}), ...(kind === "estimate" ? app.estimate[lang] ?? {} : {}) } as InvoiceLabels;
      const t = await translateInvoice(d, lang);
      check(`${lang} ${kind}: share page == the app's Kotlin table`, LABEL_KEYS.every((k) => t.labels[k] === appLabels[k]), diffLabels(t.labels, appLabels));
    }
  }
} else {
  console.log("SKIP  the app's Kotlin copy (set APP_REPO to compare against it)");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
