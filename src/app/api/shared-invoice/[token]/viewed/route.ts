import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * "A person is looking at this document" — proxied to the public backend beacon.
 *
 * The backend deliberately does NOT count views on its plain read, because that read also answers
 * the OG crawler building a link preview, both of this page's own fetches, and the app's
 * parity-harness tab where the SENDER is checking their own invoice. Counting there would date the
 * card's "Received" tag from the moment a link was pasted into WhatsApp.
 *
 * This route is only ever called from a mounted client component, which is what excludes crawlers:
 * they fetch HTML and never run the JavaScript that would reach here.
 *
 * Deliberately does NOT revalidate the shared-invoice cache. Unlike a decision, nothing on THIS
 * page changes when a view is recorded — the fact is for the sender's list. Busting the cache here
 * would make every first open re-fetch for no visible reason.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    await fetch(
      `${config.backendUrl}/v2/shared-invoice/${encodeURIComponent(token)}/viewed`,
      { method: "POST", cache: "no-store" },
    );
  } catch {
    // Swallowed on purpose. This is a side-channel about the receiver's attention; it must never
    // become an error in front of someone who is simply reading their invoice.
  }
  return NextResponse.json({ success: true });
}
