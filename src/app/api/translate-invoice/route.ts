import { NextResponse } from "next/server";
import { translateBatch } from "@/lib/translate";
import { translateDocument } from "@/lib/translate-document";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * Translate a whole document in ONE call: `{ snapshot, lang }` → `{ data, labels, dir }`.
 *
 * It was built for the app's preview, which held the document and needed the translated version
 * handed to it. The app translates on the device since 1.4.x (`TranslateApi.kt`), from its generated
 * copy of the same label table; this route stays for older builds and for anything server-side.
 *
 * What it does is `translateDocument` — the SAME function the share page runs in the browser — so the
 * route and the page cannot answer differently: labels from the committed table, only the invoice's
 * free text through the translator (decision 0174).
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
  if (!data) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }
  // translateBatch is what /api/translate runs; it returns the originals on failure.
  const out = await translateDocument(data, body?.lang ?? "en", (texts, target) => translateBatch(texts, target));
  return NextResponse.json(out);
}
