import "server-only";
import { cache } from "react";
import { config } from "./config";
import type { InvoiceRenderData } from "./data";

// Public (no-login) shared invoice, read from the Spring backend by its opaque
// token. `snapshot` is the exact InvoiceRenderData the mobile app produced, so
// the web page renders it with the same <InvoiceDocument> the free tool uses.
export interface PublicSharedInvoice {
  token: string;
  /**
   * "INVOICE" or "ESTIMATE". Absent on links created before estimates could be shared, which is why
   * it is optional and why the reader defaults to invoice.
   *
   * The RENDER does not use this — `snapshot.documentType` carries it and <InvoiceDocument> reads it
   * there. This is for the page's own words: the title, the description, and the OG card.
   */
  documentType?: "INVOICE" | "ESTIMATE";
  snapshot: InvoiceRenderData;
  invoiceNumber: string | null;
  businessName: string | null;
  currency: string | null;
  totalAmount: number | null;
  status: string;
  createdAt: string;
  // Approval loop.
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt?: string | null;
  decisionNote?: string | null;
}

/**
 * What was behind the token, as the backend actually answered.
 *
 * The four values are the four answers the web can observe, and no more:
 * - `active`      — 200 with a document.
 * - `not_found`   — 404. The token has never existed, or the row is gone.
 * - `gone`        — 410. `SharedInvoice.isViewable()` said no. It answers the SAME status for a
 *                   revoked link and an expired one, so those two are not separable from here.
 *                   Naming one would be a value nobody could later catch as wrong.
 * - `fetch_failed`— the read itself failed (network, 5xx, unparseable body). Not the same fact as
 *                   the link being dead, and it must never be counted as one.
 */
export type SharedInvoiceLinkState = "active" | "not_found" | "gone" | "fetch_failed";

export interface SharedInvoiceResult {
  state: SharedInvoiceLinkState;
  data: PublicSharedInvoice | null;
  /** The HTTP status when there was one. Absent when the request never got an answer. */
  status: number | null;
}

/**
 * Fetch a shared invoice by token, keeping WHY it failed.
 *
 * Speed: the endpoint is PUBLIC (no auth) and the snapshot is immutable, so we
 * hit it with a plain fetch cached in the Next Data Cache (revalidate). The page
 * HTML, the OG image, AND any social re-crawl then reuse the cached response
 * instead of a fresh cross-network backend round-trip — so the WhatsApp preview
 * resolves fast when the link is pasted. React cache() additionally dedupes the
 * page's own generateMetadata + component into one call per request.
 */
export const getSharedInvoiceResult = cache(
  async (token: string): Promise<SharedInvoiceResult> => {
    try {
      const res = await fetch(
        `${config.backendUrl}/v2/shared-invoice/${encodeURIComponent(token)}`,
        {
          headers: { "Content-Type": "application/json" },
          // The snapshot is frozen at share time (it never changes for a given token), and the one
          // mutable field — approvalStatus — is pushed rather than polled: the decision route calls
          // revalidateTag on this exact tag. So there is nothing a short window can catch.
          //
          // It used to be 15s, for a reason that no longer exists: the app uploaded a rendered
          // image a few seconds after the share was minted, and a long cache would have kept
          // serving the page from before it landed. That upload is gone — the page renders the
          // snapshot as HTML and always did.
          next: { revalidate: 300, tags: [`shared-invoice:${token}`] },
        },
      );
      if (!res.ok) {
        const state: SharedInvoiceLinkState =
          res.status === 404 ? "not_found" : res.status === 410 ? "gone" : "fetch_failed";
        return { state, data: null, status: res.status };
      }
      const json = (await res.json()) as { success?: boolean; data?: PublicSharedInvoice } | null;
      // 200 with no usable body is the read failing, not the link being dead. Reporting it as
      // `not_found` would put our own defect into the bucket we use to count dead links.
      if (!json?.success || !json.data) {
        return { state: "fetch_failed", data: null, status: res.status };
      }
      return { state: "active", data: json.data, status: res.status };
    } catch {
      return { state: "fetch_failed", data: null, status: null };
    }
  },
);

/**
 * The document, or null when missing / revoked / expired / unreachable.
 *
 * Kept as the reader for everything that only needs the document (the OG card, the page's own
 * metadata). It shares the cached call above, so asking for the reason costs nothing extra.
 */
export async function getSharedInvoice(token: string): Promise<PublicSharedInvoice | null> {
  return (await getSharedInvoiceResult(token)).data;
}

const PLAY_STORE_ID = "invotick.invoicemaker";

/**
 * Play Store URL that carries the share token in the install referrer so the app
 * can open THIS invoice after install (deferred deep link). The app's
 * GooglePlayReferrer parses `iv_doc` → ReceivedInvoice(token) on first launch.
 */
export function installUrlForToken(token: string): string {
  const referrer = encodeURIComponent(`iv_doc=${token}&utm_source=shared_invoice&utm_medium=web`);
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&referrer=${referrer}`;
}
