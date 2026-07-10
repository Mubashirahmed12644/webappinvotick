import "server-only";
import { cache } from "react";
import { backendFetch } from "./backend";
import type { InvoiceRenderData } from "./data";

// Public (no-login) shared invoice, read from the Spring backend by its opaque
// token. `snapshot` is the exact InvoiceRenderData the mobile app produced, so
// the web page renders it with the same <InvoiceDocument> the free tool uses.
export interface PublicSharedInvoice {
  token: string;
  snapshot: InvoiceRenderData;
  invoiceNumber: string | null;
  businessName: string | null;
  currency: string | null;
  totalAmount: number | null;
  status: string;
  createdAt: string;
}

/**
 * Fetch a shared invoice by token; null when missing / revoked / expired.
 * Wrapped in React cache() so generateMetadata + the page component share a single
 * backend round-trip per request (halves the crawler-path latency).
 */
export const getSharedInvoice = cache(
  async (token: string): Promise<PublicSharedInvoice | null> => {
    const res = await backendFetch<PublicSharedInvoice>(
      `/v2/shared-invoice/${encodeURIComponent(token)}`,
    );
    return res.success && res.data ? res.data : null;
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
