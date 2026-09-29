import { labelsFor, type InvoiceLabels } from "./invoice-labels";
import { FR_ESTIMATE_LABELS, FR_LABELS } from "./invoice-labels-fr";
import { PT_ESTIMATE_LABELS, PT_LABELS } from "./invoice-labels-pt";
import { ES_ESTIMATE_LABELS, ES_LABELS } from "./invoice-labels-es";
import { AR_ESTIMATE_LABELS, AR_LABELS } from "./invoice-labels-ar";
import { DE_ESTIMATE_LABELS, DE_LABELS } from "./invoice-labels-de";
import { FA_ESTIMATE_LABELS, FA_LABELS } from "./invoice-labels-fa";
import { HI_ESTIMATE_LABELS, HI_LABELS } from "./invoice-labels-hi";
import { ID_ESTIMATE_LABELS, ID_LABELS } from "./invoice-labels-id";
import { MY_ESTIMATE_LABELS, MY_LABELS } from "./invoice-labels-my";
import { NL_ESTIMATE_LABELS, NL_LABELS } from "./invoice-labels-nl";
import { PL_ESTIMATE_LABELS, PL_LABELS } from "./invoice-labels-pl";
import { SV_ESTIMATE_LABELS, SV_LABELS } from "./invoice-labels-sv";
import { TH_ESTIMATE_LABELS, TH_LABELS } from "./invoice-labels-th";
import { TR_ESTIMATE_LABELS, TR_LABELS } from "./invoice-labels-tr";
import { ZH_ESTIMATE_LABELS, ZH_LABELS } from "./invoice-labels-zh";

/**
 * The language a document is WRITTEN in (decisions 0185, 0187) — its labels, how its numbers and dates are
 * written, and which way it reads. Not the reader's language: that is the share page's picker, which only swaps
 * the labels.
 *
 * A document whose snapshot says `language: "fr"` (or "pt-AO", "es_419", "ar-EG", "hi-IN", "my-MM", "th-TH", …) is
 * written in that language.
 * Anything else — absent, null, "en", or a language we have no hand-written set for — is "en", which is exactly how
 * every document rendered before 0185, so every frozen snapshot keeps rendering byte for byte as it did.
 *
 * Adding a language is one entry in [WRITTEN] and its hand-written label file; the checks read this table.
 */
export type DocumentLanguage =
  | "en" | "fr" | "pt" | "es" | "ar"
  | "de" | "fa" | "hi" | "id" | "my" | "nl" | "pl" | "sv" | "th" | "tr" | "zh";

type Written = {
  invoice: InvoiceLabels;
  estimate: Partial<InvoiceLabels>;
  /** Between a label and its value. French puts a no-break space before the colon. */
  sep: string;
  page: (page: number, pages: number) => string;
  dir: "ltr" | "rtl";
};

export const WRITTEN: Record<Exclude<DocumentLanguage, "en">, Written> = {
  fr: { invoice: FR_LABELS, estimate: FR_ESTIMATE_LABELS, sep: "\u00A0: ", page: (p, n) => `Page ${p} sur ${n}`, dir: "ltr" },
  pt: { invoice: PT_LABELS, estimate: PT_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Página ${p} de ${n}`, dir: "ltr" },
  es: { invoice: ES_LABELS, estimate: ES_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Página ${p} de ${n}`, dir: "ltr" },
  ar: { invoice: AR_LABELS, estimate: AR_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `الصفحة ${p} من ${n}`, dir: "rtl" },
  // Wave 2 (2026-09-29), alphabetical by code.
  de: { invoice: DE_LABELS, estimate: DE_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Seite ${p} von ${n}`, dir: "ltr" },
  fa: { invoice: FA_LABELS, estimate: FA_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `صفحه ${p} از ${n}`, dir: "rtl" },
  hi: { invoice: HI_LABELS, estimate: HI_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `पेज ${p} / ${n}`, dir: "ltr" },
  id: { invoice: ID_LABELS, estimate: ID_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Halaman ${p} dari ${n}`, dir: "ltr" },
  my: { invoice: MY_LABELS, estimate: MY_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `စာမျက်နှာ ${p} / ${n}`, dir: "ltr" },
  nl: { invoice: NL_LABELS, estimate: NL_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Pagina ${p} van ${n}`, dir: "ltr" },
  pl: { invoice: PL_LABELS, estimate: PL_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Strona ${p} z ${n}`, dir: "ltr" },
  sv: { invoice: SV_LABELS, estimate: SV_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Sida ${p} av ${n}`, dir: "ltr" },
  th: { invoice: TH_LABELS, estimate: TH_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `หน้า ${p} จาก ${n}`, dir: "ltr" },
  tr: { invoice: TR_LABELS, estimate: TR_ESTIMATE_LABELS, sep: ": ", page: (p, n) => `Sayfa ${p} / ${n}`, dir: "ltr" },
  zh: { invoice: ZH_LABELS, estimate: ZH_ESTIMATE_LABELS, sep: "：", page: (p, n) => `第 ${p} 页，共 ${n} 页`, dir: "ltr" },
};

/** Every language a document can be written in, English first. */
export const DOCUMENT_LANGUAGES: DocumentLanguage[] = ["en", ...(Object.keys(WRITTEN) as DocumentLanguage[])];

export function documentLanguage(language?: string | null): DocumentLanguage {
  const tag = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  // Android's old code for Indonesian ("in") is the same language as "id" (InterfaceLanguages.LEGACY_CODES in the app).
  const primary = tag === "in" ? "id" : tag;
  return primary in WRITTEN ? (primary as DocumentLanguage) : "en";
}

/** The hand-written label set of [lang] for a document of this type; English for "en". */
export function writtenLabelsFor(lang: DocumentLanguage, documentType?: string | null): InvoiceLabels {
  if (lang === "en") return labelsFor(documentType);
  const w = WRITTEN[lang];
  return documentType === "ESTIMATE" ? { ...w.invoice, ...w.estimate } : w.invoice;
}

/** The labels a document shows when nobody passed a translated set: its own language's, for its type. */
export function documentLabelsFor(data: { documentType?: string | null; language?: string | null }): InvoiceLabels {
  return writtenLabelsFor(documentLanguage(data.language), data.documentType);
}

/** "Label: value" — French puts a no-break space before the colon. */
export function labelSeparator(lang: DocumentLanguage): string {
  return lang === "en" ? ": " : WRITTEN[lang].sep;
}

/** The printed "Page X of Y" line under a multi-page document's footer. */
export function pageLine(lang: DocumentLanguage, page: number, pages: number): string {
  return lang === "en" ? `Page ${page} of ${pages}` : WRITTEN[lang].page(page, pages);
}

/** Which way a document written in [language] reads: Arabic and Persian right to left, everything else left to right. */
export function documentDir(language?: string | null): "ltr" | "rtl" {
  const lang = documentLanguage(language);
  return lang === "en" ? "ltr" : WRITTEN[lang].dir;
}
