"use client";

import { useEffect } from "react";

/**
 * Tells the backend that a person has the document on screen — the fact behind the sender's
 * "Received" delivery tag.
 *
 * Renders nothing. It exists as a component purely so the call happens in a mounted client effect,
 * and that is the whole mechanism: **crawlers do not run JavaScript.** WhatsApp, Facebook and every
 * other link unfurler fetches the HTML for the OG card and stops there, so they never reach this.
 * A view recorded from the server read would fire the instant a link was pasted into a chat, and
 * the sender's card would claim their client had seen the invoice before anyone opened it.
 *
 * Fires once per mount. Not once per token, per session or per person — a receiver who opens the
 * link twice records two views, which is correct for a counter and irrelevant to `firstViewedAt`,
 * which the backend only ever writes the first time.
 *
 * `keepalive` so the request survives the receiver immediately navigating away — reading an invoice
 * and closing the tab is the normal case, not the exception.
 *
 * Known and accepted: a SENDER who opens their own share link in a browser is counted as a receiver.
 * The page is public and unauthenticated, so there is nothing here that could tell the difference.
 * The app's own receiver screen does not have this problem — it detects the owner and routes them to
 * their own invoice before this ever renders.
 */
export function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    void fetch(`/api/shared-invoice/${encodeURIComponent(token)}/viewed`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // Never surfaced. The receiver is here to read an invoice, not to hear about our telemetry.
    });
  }, [token]);

  return null;
}
