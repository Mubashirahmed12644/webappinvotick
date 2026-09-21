import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { withOwnersFooterRule, type FooterFlag } from "@/lib/invotick-footer";

// Returns the SERVER-STORED snapshot for a share token — the exact JSON the backend holds, which the
// OG-link / webapp / iOS all render. The app's "Online" verify tab fetches this (after uploading the
// current snapshot) so it renders from server data, not a local copy — proving the round-trip.
//
// no-store: the verify tab uploads a fresh snapshot then immediately reads it back, so a cached
// response would serve the previous state. Always hit the backend.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const res = await fetch(
      `${config.backendUrl}/v2/shared-invoice/${encodeURIComponent(token)}`,
      { headers: { "Content-Type": "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: "not found" }, { status: res.status });
    const json = (await res.json()) as {
      success?: boolean;
      data?: { snapshot?: FooterFlag | null; showInvotickFooter?: boolean };
    } | null;
    const stored = json?.success && json.data ? json.data.snapshot : null;
    if (!stored) return NextResponse.json({ error: "no snapshot" }, { status: 404 });
    // Rendered the way the public page renders it: no Invotick footer when the owner is premium now
    // (decision 0147).
    const snapshot = withOwnersFooterRule(stored, json?.data?.showInvotickFooter);
    return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
