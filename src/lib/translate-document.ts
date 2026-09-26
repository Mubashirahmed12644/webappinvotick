import { labelsFor, LABEL_KEYS, type InvoiceLabels } from "./invoice-labels";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n";
import { isRtl } from "./translate";
import type { InvoiceRenderData } from "./data";

/**
 * Translating a document into the reader's language — the ONE definition of it, used by the share
 * page (`/i/{token}`, through `translateInvoice`), the app's Online tab (`/embed/render`) and
 * `/api/translate-invoice`.
 *
 * Two rules, and why each one is here rather than at the call sites:
 *
 * 1. **Labels come from the committed table, never from a live translation.** The share page used to
 *    send every label to the translator on every pick. The table exists because that went wrong in
 *    ways only a person catches — "Disc" came back as an optical disc over the discount column, and
 *    in Chinese the footer read "扫描下载Invotic", our own name cut. The app renders from a copy of
 *    the same table (generated from it), so a label read live differs from the one the business
 *    owner saw in their preview: the same invoice saying two things to its two parties.
 *
 * 2. **Only the invoice's own free text goes to the translator**: the item descriptions, the notes,
 *    the payment instructions and the terms — sentences the business wrote for the reader. Names and
 *    addresses are not translated. A business's name, a client's name, their company and their
 *    address are what they are called and where they are, and a translator turns "Ahmed Traders"
 *    into a phrase; amounts, dates and invoice numbers never reach it at all.
 */

export type TranslatedInvoice = {
  data: InvoiceRenderData;
  labels: InvoiceLabels;
  dir: "ltr" | "rtl";
};

/**
 * Sends `texts` to the translator and returns the translations in the same order, or `null` when
 * nothing usable came back. Position is the contract: `out[i]` is `texts[i]`.
 */
export type Translator = (texts: string[], target: string) => Promise<string[] | null>;

const BRAND = "Invotick";

/** True when the committed table carries this language. */
export function hasLabelTable(lang: string): boolean {
  return Object.prototype.hasOwnProperty.call(LABEL_TRANSLATIONS, lang);
}

/**
 * The labels a document shows in [lang]: the English set for its type, with the table's translation
 * over each one the table carries.
 *
 * A language the table does not carry keeps the English labels. The share page cannot reach that case
 * — its picker lists exactly the table's languages — but `/api/translate-invoice` takes any code, and
 * that route has always answered it this way: English headings are a known wording, a live guess
 * is the thing this table was made to replace.
 *
 * The brand name is never translated or cut. A label whose English carries it and whose translation
 * does not falls back to the English, whole — an English footer line is a small wrong; our name
 * spelt wrong under every invoice a customer sends is a large one.
 */
export function documentLabels(documentType: InvoiceRenderData["documentType"], lang: string): InvoiceLabels {
  const base = labelsFor(documentType);
  if (!lang || lang === "en") return base;
  const table = {
    ...(LABEL_TRANSLATIONS[lang] ?? {}),
    ...(documentType === "ESTIMATE" ? (ESTIMATE_LABEL_TRANSLATIONS[lang] ?? {}) : {}),
  };
  const out = { ...base };
  for (const k of LABEL_KEYS) {
    const t = table[k];
    if (!t) continue;
    if (base[k].includes(BRAND) && !t.includes(BRAND)) continue;
    out[k] = t;
  }
  return out;
}

/**
 * The document's own free text, in a FIXED order — the translations come back by position. Blanks keep
 * their slot, so a missing field can never shift the next one into its place.
 */
export function freeText(data: InvoiceRenderData): string[] {
  return [
    ...data.items.map((it) => it.name ?? ""),
    data.notes ?? "",
    data.paymentInstructions ?? "",
    data.terms ?? "",
  ];
}

/** Puts [out] (the translation of [freeText]) back into a copy of the document. */
export function withFreeText(data: InvoiceRenderData, out: string[]): InvoiceRenderData {
  const n = data.items.length;
  return {
    ...data,
    items: data.items.map((it, i) => ({ ...it, name: out[i] || it.name })),
    notes: data.notes ? out[n] || data.notes : data.notes,
    paymentInstructions: data.paymentInstructions ? out[n + 1] || data.paymentInstructions : data.paymentInstructions,
    terms: data.terms ? out[n + 2] || data.terms : data.terms,
  };
}

/**
 * The whole document in [lang]. Best-effort by contract: when the translator fails, or answers with
 * the wrong number of lines, the free text stays as written — the labels still come from the table,
 * because they never depended on that call.
 */
export async function translateDocument(
  data: InvoiceRenderData,
  lang: string,
  translate: Translator,
): Promise<TranslatedInvoice> {
  const labels = documentLabels(data.documentType, lang);
  if (!lang || lang === "en") return { data, labels, dir: "ltr" };
  const dir: "ltr" | "rtl" = isRtl(lang) ? "rtl" : "ltr";

  const texts = freeText(data);
  let out: string[] | null = null;
  try {
    out = await translate(texts, lang);
  } catch {
    out = null;
  }
  // A short or long answer would put one field's words into another — an item's name in the notes.
  if (!out || out.length !== texts.length) return { data, labels, dir };
  return { data: withFreeText(data, out), labels, dir };
}
