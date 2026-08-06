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
 * Fetch a shared invoice by token; null when missing / revoked / expired.
 *
 * Speed: the endpoint is PUBLIC (no auth) and the snapshot is immutable, so we
 * hit it with a plain fetch cached in the Next Data Cache (revalidate). The page
 * HTML, the OG image, AND any social re-crawl then reuse the cached response
 * instead of a fresh cross-network backend round-trip — so the WhatsApp preview
 * resolves fast when the link is pasted. React cache() additionally dedupes the
 * page's own generateMetadata + component into one call per request.
 */
export const getSharedInvoice = cache(
  async (token: string): Promise<PublicSharedInvoice | null> => {
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
      if (!res.ok) return null;
      const json = (await res.json()) as { success?: boolean; data?: PublicSharedInvoice } | null;
      return json?.success && json.data ? json.data : null;
    } catch {
      return null;
    }
  },
);

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
