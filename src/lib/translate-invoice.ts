import type { InvoiceRenderData } from "./data";
import type { TranslatedInvoice } from "./translate-document";

export type { TranslatedInvoice };

/**
 * Translate a shared invoice into [target] in the browser — the share page (`/i/{token}`) and the
 * app's Online tab (`/embed/render`).
 *
 * The work is `translateDocument`, the same function `/api/translate-invoice` runs, so there is one
 * answer to "which words, from where": the LABELS come from the committed table (the one the app's
 * own copy is generated from), and only the invoice's free text — item descriptions, notes, payment
 * instructions, terms — goes to `/api/translate`. Names, addresses, numbers and dates never do.
 *
 * The table is loaded on the first pick rather than with the page: most readers never change the
 * language, and they should not download 24 languages of headings to read one invoice.
 */
export async function translateInvoice(data: InvoiceRenderData, target: string): Promise<TranslatedInvoice> {
  const { translateDocument } = await import("./translate-document");
  return translateDocument(data, target, async (texts, lang) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts, target: lang }),
    });
    if (!res.ok) return null;
    const out = ((await res.json()) as { texts?: unknown }).texts;
    return Array.isArray(out) ? (out as string[]) : null;
  });
}
