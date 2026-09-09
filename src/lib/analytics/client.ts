"use client";

import type { WebEventName } from "./events";

const SESSION_KEY = "invotick_web_session";

/**
 * One id per browser tab, minted on first use and kept in `sessionStorage`.
 *
 * **`sessionStorage`, not `localStorage`, and that is the decision.** A persistent id would make
 * this page hand a stable identifier to a person who never signed up, never asked us for anything,
 * and is here only because someone sent them an invoice. The unit we can honestly count on a public
 * document is a visit, so a visit is what we count. Closing the tab ends it.
 *
 * Returns null when storage is unavailable — private modes and embedded browsers throw on access
 * rather than returning nothing. The caller then sends no event at all, because an event with a
 * made-up session id is worse than a missing one: it would look like a real visitor for ever.
 */
export function webSessionId(): string | null {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const minted = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, minted);
    return minted;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget one event at our own origin.
 *
 * `keepalive` because the normal case for every CTA on this page is that the browser leaves
 * immediately afterwards — to the Play Store, to the print dialog, to the web app. Without it the
 * request is cancelled by the navigation and the tap that mattered most is the one we never see.
 *
 * Never awaited by a caller that has UI to run, never surfaced. A receiver is here to read an
 * invoice, not to hear about our telemetry.
 */
export function trackWebEvent(
  event: WebEventName,
  params: Record<string, string | number> = {},
): void {
  const sessionId = webSessionId();
  if (!sessionId) return;
  try {
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, sessionId, params }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Storage, network, an extension blocking the call — none of it is the receiver's problem.
  }
}
