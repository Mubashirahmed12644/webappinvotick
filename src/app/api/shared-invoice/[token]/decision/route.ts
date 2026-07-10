import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { config } from "@/lib/config";

/**
 * Receiver's approve / reject, proxied to the public backend decision endpoint.
 *
 * Same-origin (browser → this route → backend) so the client never needs CORS on
 * the backend, and we can revalidate the cached shared-invoice read on success so
 * a router.refresh() re-renders the page in its new (decided) state.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    decision?: string;
    note?: string | null;
  };
  const decision = body?.decision;
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const res = await fetch(
    `${config.backendUrl}/v2/shared-invoice/${encodeURIComponent(token)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: body?.note ?? null }),
      cache: "no-store",
    },
  );
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: unknown }
    | null;

  if (!res.ok) {
    // Surface a locked/gone/not-found reason to the client without leaking internals.
    return NextResponse.json(
      { error: json?.message ?? "Could not record your decision." },
      { status: res.status },
    );
  }

  // Invalidate the cached public read so future loads reflect the decision. (This is
  // stale-while-revalidate; the client also renders the outcome optimistically so the
  // receiver sees their own decision immediately.)
  revalidateTag(`shared-invoice:${token}`, "max");
  return NextResponse.json({ success: true, data: json?.data ?? null });
}
