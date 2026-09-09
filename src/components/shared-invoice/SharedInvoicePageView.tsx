"use client";

import { useEffect, useRef } from "react";
import { trackWebEvent } from "@/lib/analytics/client";
import type { LinkState } from "@/lib/analytics/events";

/**
 * Records that a person opened the `/i/{token}` page, and what they found there.
 *
 * Renders nothing, and is a client component for the same reason `ViewBeacon` is: **crawlers do not
 * run JavaScript.** WhatsApp, Facebook and every other unfurler fetches the HTML for the OG card and
 * stops, so they never reach here. A page view recorded from the server read would fire the instant
 * a link was pasted into a chat.
 *
 * ## Why this is not `ViewBeacon`, and why they both stay
 *
 * They answer different questions and are consumed by different people. `ViewBeacon` calls
 * `/viewed`, which dates the SENDER's "Received" tag on their own invoice list — a product feature.
 * This is the receiver's journey in the analytics pipeline. Folding them into one call would tie a
 * product-visible tag to an analytics decision, and the first time we wanted to stop sending one we
 * would have taken the other with it.
 *
 * It also has to fire on the dead-link branch, where `ViewBeacon` correctly does not: there is no
 * invoice to mark as received, and "somebody opened a link that no longer works" is precisely the
 * outcome nothing on the web could see until now.
 *
 * ## Once per mount, and the guard is not decoration
 *
 * React runs effects twice in development Strict Mode. Without the ref this page would report two
 * views for every local load, and the number would be wrong in the direction nobody checks.
 */
export function SharedInvoicePageView({ linkState, status }: { linkState: LinkState; status: number | null }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackWebEvent("shared_invoice_page_view", {
      link_state: linkState,
      // Absent when the request never got an answer at all — unknown stays unknown (§1.7).
      ...(status != null ? { http_status: status } : {}),
    });
  }, [linkState, status]);

  return null;
}
