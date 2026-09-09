/**
 * Which device family the request came from, read from the User-Agent.
 *
 * One implementation, two readers: the `/i/{token}` page branches its CTAs on it (Android →
 * Play Store, everyone else → the web tool / print dialog), and the analytics route stamps it on
 * every event the page sends. They must never drift — a funnel that says "desktop" for a page that
 * showed the Android install button is describing a branch nobody was on.
 *
 * It is computed SERVER-SIDE in both places, never accepted from the browser body. A public page is
 * spoofable by definition; a value the client cannot supply is one fewer thing to check.
 *
 * ⚠️ Known limitation, deliberately left alone: iPadOS 13+ reports a Macintosh User-Agent, so an
 * iPad reads as `desktop`. Changing the test here would change which CTA the page renders — a
 * behaviour change wearing a measurement change's clothes. It is written down instead, so nobody
 * reads the `desktop` bucket as "no iPads in it".
 */
export type ViewerPlatform = "android" | "ios" | "desktop";

export function platformFromUserAgent(userAgent: string | null | undefined): ViewerPlatform {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}
