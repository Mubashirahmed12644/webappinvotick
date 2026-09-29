import { labelsFor, type InvoiceLabels } from "./invoice-labels";
import { frenchLabelsFor } from "./invoice-labels-fr";

/**
 * The language a document is WRITTEN in (decision 0185) — its labels, and how its numbers and dates are
 * written. Not the reader's language: that is the share page's picker, which only swaps the labels.
 *
 * Two values. "fr" is a document whose snapshot says `language: "fr"` (or "fr-FR", "fr_CA", …). Anything
 * else — absent, null, "en", or a language we have no curated set for — is "en", which is exactly how every
 * document rendered before 0185, so every frozen snapshot keeps rendering byte for byte as it did.
 */
export type DocumentLanguage = "en" | "fr";

export function documentLanguage(language?: string | null): DocumentLanguage {
  const primary = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return primary === "fr" ? "fr" : "en";
}

/** The labels a document shows when nobody passed a translated set: its own language's, for its type. */
export function documentLabelsFor(data: { documentType?: string | null; language?: string | null }): InvoiceLabels {
  return documentLanguage(data.language) === "fr" ? frenchLabelsFor(data.documentType) : labelsFor(data.documentType);
}

/** "Label: value" — French puts a no-break space before the colon. */
export function labelSeparator(lang: DocumentLanguage): string {
  return lang === "fr" ? " : " : ": ";
}

/** The printed "Page X of Y" line under a multi-page document's footer. */
export function pageLine(lang: DocumentLanguage, page: number, pages: number): string {
  return lang === "fr" ? `Page ${page} sur ${pages}` : `Page ${page} of ${pages}`;
}
