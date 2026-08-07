import { NextResponse } from "next/server";
import { LABELS, LABEL_KEYS } from "@/lib/invoice-labels";
import { isRtl } from "@/lib/translate";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * Translate a whole document in ONE call: `{ snapshot, lang }` → `{ data, labels, dir }`.
 *
 * This exists for the APP. The web page already translates in the browser via `translateInvoice`,
 * which orchestrates the label list, the seller's own strings, their fixed ordering and the RTL
 * decision. The app's preview is the OFFLINE bundled renderer — it holds the document and needs the
 * translated version handed to it — and the alternative was re-implementing that orchestration in
 * Kotlin.
 *
 * Two implementations of "which strings get translated, in what order, and when does the page flip
 * to RTL" would drift, and the one the sender checks in the app would be the one the receiver never
 * sees. So the orchestration stays here, in one place, and both sides call it.
 *
 * Best-effort by contract: any failure returns the ORIGINAL document rather than an error. A
 * half-translated invoice, or an error where a document should be, is worse than one in the language
 * it was written in.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    snapshot?: InvoiceRenderData;
    lang?: string;
  } | null;

  const data = body?.snapshot;
  const target = body?.lang;
  if (!data) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }
  if (!target || target === "en") {
    return NextResponse.json({ data, labels: LABELS, dir: "ltr" });
  }

  const dir: "ltr" | "rtl" = isRtl(target) ? "rtl" : "ltr";
  const labelValues = LABEL_KEYS.map((k) => LABELS[k]);
  const c = data.client;
  // Same FIXED order as translateInvoice, because the translations come back positionally.
  const dataStrings: string[] = [
    data.business?.name ?? "",
    c?.name ?? "",
    c?.companyName ?? "",
    c?.addressLine1 ?? "",
    c?.city ?? "",
    c?.country ?? "",
    ...data.items.map((it) => it.name ?? ""),
    data.notes ?? "",
    data.paymentInstructions ?? "",
    data.terms ?? "",
  ];

  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: [...labelValues, ...dataStrings], target }),
      cache: "no-store",
    });
    const json = (await res.json()) as { translations?: string[] };
    const out = json?.translations;
    if (!out || out.length !== labelValues.length + dataStrings.length) {
      // Length mismatch means the positional mapping below would put the wrong words in the wrong
      // fields — a client's name landing in the notes. Original text is the safe answer.
      return NextResponse.json({ data, labels: LABELS, dir });
    }

    const labels = { ...LABELS } as Record<string, string>;
    LABEL_KEYS.forEach((k, i) => {
      labels[k] = out[i] || LABELS[k];
    });

    let p = labelValues.length;
    const take = () => out[p++] || "";
    const translatedData: InvoiceRenderData = {
      ...data,
      business: data.business ? { ...data.business, name: take() || data.business.name } : data.business,
      client: c
        ? {
            ...c,
            name: take() || c.name,
            companyName: take() || c.companyName,
            addressLine1: take() || c.addressLine1,
            city: take() || c.city,
            country: take() || c.country,
          }
        : c,
      items: data.items.map((it) => ({ ...it, name: take() || it.name })),
      notes: take() || data.notes,
      paymentInstructions: take() || data.paymentInstructions,
      terms: take() || data.terms,
    };

    return NextResponse.json({ data: translatedData, labels, dir });
  } catch {
    return NextResponse.json({ data, labels: LABELS, dir });
  }
}
