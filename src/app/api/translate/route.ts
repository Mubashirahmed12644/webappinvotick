import { NextRequest, NextResponse } from "next/server";
import { translateBatch } from "@/lib/translate";

// Server-side batch translation for the shared invoice (labels + the seller's data) → receiver's
// language. Runs on the server so the browser never hits the (CORS-less) translate endpoint directly.
export async function POST(req: NextRequest) {
  try {
    const { texts, target } = (await req.json()) as { texts?: unknown; target?: unknown };
    if (!Array.isArray(texts) || typeof target !== "string") {
      return NextResponse.json({ error: "texts[] and target required" }, { status: 400 });
    }
    if (texts.length > 400) {
      return NextResponse.json({ error: "too many texts" }, { status: 400 });
    }
    const out = await translateBatch(texts.map((t) => (t == null ? "" : String(t))), target);
    return NextResponse.json({ texts: out });
  } catch {
    return NextResponse.json({ error: "translate failed" }, { status: 500 });
  }
}
