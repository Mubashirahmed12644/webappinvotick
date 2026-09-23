"use client";

import { useEffect, useRef } from "react";
import { trackWebEvent } from "@/lib/analytics/client";

/**
 * Records that somebody landed on the free invoice tool. Renders nothing.
 *
 * This is the denominator of the whole free-tool funnel, so it is kept as small as anything in this
 * repo gets: no parameters, no storage read, no await, nothing that can fail its schema and drop the
 * row. Everything worth splitting it by — the surface, the device family, the country — is stamped
 * server-side by the analytics route from the request itself.
 *
 * **A client component, because crawlers do not run JavaScript.** This page is an SEO page; a view
 * recorded from the server render would count Googlebot, every unfurler and every uptime check as a
 * person who came to make an invoice, and the funnel's first number would be the one number nobody
 * could ever trust.
 *
 * The ref is not decoration: React runs effects twice in development Strict Mode, and without it
 * every local load reports two visits.
 */
export function FreeInvoicePageView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackWebEvent("free_invoice_page_view");
  }, []);

  return null;
}
