import { LABELS, LABEL_KEYS, type InvoiceLabels } from "./invoice-labels";
import { isRtl } from "./translate";
import type { InvoiceRenderData } from "./data";

export type TranslatedInvoice = {
  data: InvoiceRenderData;
  labels: InvoiceLabels;
  dir: "ltr" | "rtl";
};

/**
 * Translate a shared invoice into [target] (a Google language code): the structural labels AND the
 * seller's own text (business/client names + addresses, item descriptions, notes). Numbers, dates,
 * currency and the invoice number are left untouched. Calls the server route `/api/translate` in ONE
 * batch. Best-effort — on any failure the original text is kept (only the direction flips for RTL).
 */
export async function translateInvoice(data: InvoiceRenderData, target: string): Promise<TranslatedInvoice> {
  if (target === "en") return { data, labels: LABELS, dir: "ltr" };
  const dir: "ltr" | "rtl" = isRtl(target) ? "rtl" : "ltr";

  const labelValues = LABEL_KEYS.map((k) => LABELS[k]);
  const c = data.client;
  // Seller data strings — FIXED order so we can put the translations back positionally.
  const dataStrings: string[] = [
    data.business?.name ?? "",
    c?.name ?? "",
    c?.companyName ?? "",
    c?.addressLine1 ?? "",
    c?.city ?? "",
    c?.country ?? "",
    ...data.items.map((it) => it.name ?? ""),
    data.notes ?? "",
  ];

  let translated: string[];
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [...labelValues, ...dataStrings], target }),
    });
    if (!res.ok) return { data, labels: LABELS, dir };
    translated = ((await res.json()) as { texts: string[] }).texts;
    if (!Array.isArray(translated) || translated.length !== labelValues.length + dataStrings.length) {
      return { data, labels: LABELS, dir };
    }
  } catch {
    return { data, labels: LABELS, dir };
  }

  // Rebuild labels.
  const labels = {} as InvoiceLabels;
  LABEL_KEYS.forEach((k, i) => {
    labels[k] = translated[i] || LABELS[k];
  });

  // Rebuild data (same order the strings were pushed).
  let p = labelValues.length;
  const next = translated;
  const out: InvoiceRenderData = { ...data };
  if (out.business) out.business = { ...out.business, name: next[p] || out.business.name };
  p += 1;
  if (out.client) {
    out.client = {
      ...out.client,
      name: next[p] || out.client.name,
      companyName: out.client.companyName ? next[p + 1] || out.client.companyName : out.client.companyName,
      addressLine1: out.client.addressLine1 ? next[p + 2] || out.client.addressLine1 : out.client.addressLine1,
      city: out.client.city ? next[p + 3] || out.client.city : out.client.city,
      country: out.client.country ? next[p + 4] || out.client.country : out.client.country,
    };
  }
  p += 5;
  out.items = data.items.map((it, i) => ({ ...it, name: next[p + i] || it.name }));
  p += data.items.length;
  out.notes = data.notes ? next[p] || data.notes : data.notes;

  return { data: out, labels, dir };
}
