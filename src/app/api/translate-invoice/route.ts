import { NextResponse } from "next/server";
import { LABELS } from "@/lib/invoice-labels";
import { LABEL_TRANSLATIONS } from "@/lib/invoice-labels-i18n";
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

  // Labels come from the committed table, not from the network. They are fixed strings — 31 of the
  // ~40 a typical invoice sends — so translating them per request meant re-sending the same words
  // through a rate-limited endpoint for every user and every document. See
  // scripts/generate-label-translations.mjs.
  //
  // A language with no entry falls back to English labels and still translates the seller's text:
  // half a document in the reader's language beats none of it.
  const labels = { ...LABELS, ...(LABEL_TRANSLATIONS[target] ?? {}) };
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
      body: JSON.stringify({ texts: dataStrings, target }),
      cache: "no-store",
    });
    // `texts` in AND `texts` out — /api/translate's actual contract. This read `translations`,
    // which is always undefined, so every call fell through the length check below and returned the
    // original document. Silently, by design, which is why it looked like nothing happened.
    const json = (await res.json()) as { texts?: string[] };
    const out = json?.texts;
    if (!out || out.length !== dataStrings.length) {
      // Length mismatch means the positional mapping below would put the wrong words in the wrong
      // fields — a client's name landing in the notes. Original text is the safe answer.
      // The seller's text could not be translated, but the LABELS still can be — they came from the
      // table, not this call. A document with translated headings reads better than one with none.
      return NextResponse.json({ data, labels, dir });
    }

    // Positions advance UNCONDITIONALLY, exactly as translate-invoice.ts does on the web.
    //
    // A stateful take() that only fired when a field existed looked tidier and was wrong: dataStrings
    // always pushes all ten slots (missing values go in as ""), so skipping a take for an absent
    // client shifted everything after it by five — the item names became the notes. That is the
    // failure the length guard above exists to prevent, arriving by another door.
    let p = 0;
    const out2: InvoiceRenderData = { ...data };
    if (out2.business) out2.business = { ...out2.business, name: out[p] || out2.business.name };
    p += 1;
    if (out2.client) {
      out2.client = {
        ...out2.client,
        name: out[p] || out2.client.name,
        companyName: out2.client.companyName ? out[p + 1] || out2.client.companyName : out2.client.companyName,
        addressLine1: out2.client.addressLine1 ? out[p + 2] || out2.client.addressLine1 : out2.client.addressLine1,
        city: out2.client.city ? out[p + 3] || out2.client.city : out2.client.city,
        country: out2.client.country ? out[p + 4] || out2.client.country : out2.client.country,
      };
    }
    p += 5;
    out2.items = data.items.map((it, i) => ({ ...it, name: out[p + i] || it.name }));
    p += data.items.length;
    out2.notes = data.notes ? out[p] || data.notes : data.notes;
    out2.paymentInstructions = data.paymentInstructions ? out[p + 1] || data.paymentInstructions : data.paymentInstructions;
    out2.terms = data.terms ? out[p + 2] || data.terms : data.terms;

    return NextResponse.json({ data: out2, labels, dir });
  } catch {
    return NextResponse.json({ data, labels, dir });
  }
}
