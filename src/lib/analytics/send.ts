import "server-only";
import { config } from "@/lib/config";
import { WEB_SURFACE, type WebEventName } from "./events";
import type { ViewerPlatform } from "./platform";

/**
 * Sends one event from the share page into the SAME pipeline the Android app uses —
 * `POST /v2/analytics/track` — so a web journey and an app journey are rows in one table and one
 * funnel, not two systems that have to be reconciled by hand.
 *
 * ## What is deliberately NOT sent
 *
 * - **`appVersion` / `appVersionCode`.** Those columns hold Android build numbers. A web value in
 *   them would be a second code space in one column: every "1.4.3 vs 1.4.4" comparison would
 *   silently include or exclude web rows depending on the number we invented (§1.15). Absent means
 *   unknown, which is the truth — this surface has no app build. What separates web rows from app
 *   rows is `params.surface`, which lives ON the event, because a dimension you filter on must
 *   (§3.8).
 * - **`userId`.** The page is public and unauthenticated. Attaching an account id to "somebody
 *   opened this invoice" would put a person and a document they merely read into the analytics
 *   table, on a surface where we did not ask them anything. G3 outranks the extra dimension.
 * - **`timestamp`.** The browser clock is the client's, and a skewed one writes events into the
 *   future. Nothing here queues offline, so the backend's arrival time IS the occurrence time to
 *   within a round trip — see `memory/analytics-timestamp-is-arrival-time.md` for why that is not
 *   true of the app.
 * - **`eventId`.** Generated here, never accepted from the browser. `AnalyticsEventRepository.save`
 *   with an existing id UPDATES that row, so an endpoint that took an id from the client would let
 *   anyone overwrite any analytics event we hold.
 *
 * ## The identity
 *
 * One id per browser tab (see `client.ts`), used as the session id, and the same value prefixed
 * `web_` as the app-instance id. On a public page there is nothing that could honestly separate
 * "this device" from "this visit", so they are one thing and the prefix says so. Distinct sessions
 * and distinct instances will therefore be the same number for web — a property to know, not a
 * defect to correct.
 *
 * Never throws. A receiver reading their invoice must not meet an error because we failed to record
 * that they were reading it.
 */
export async function sendWebAnalyticsEvent(args: {
  eventName: WebEventName;
  params: Record<string, string | number>;
  sessionId: string;
  viewerPlatform: ViewerPlatform;
  /** ISO country from the edge, when the platform gives us one. Absent = unknown. */
  country?: string | null;
}): Promise<{ delivered: boolean; status: number | null }> {
  const body = {
    appInstanceId: `web_${args.sessionId}`,
    platform: "Web",
    sessionId: args.sessionId,
    ...(args.country ? { country: args.country } : {}),
    events: [
      {
        eventId: crypto.randomUUID(),
        eventName: args.eventName,
        params: {
          ...args.params,
          surface: WEB_SURFACE,
          viewer_platform: args.viewerPlatform,
        },
      },
    ],
  };

  try {
    const res = await fetch(`${config.backendUrl}/v2/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { delivered: res.ok, status: res.status };
  } catch {
    return { delivered: false, status: null };
  }
}
