/**
 * Where the share page's "get your own Invotick" button sends each device, and Safari's own banner
 * (decision 0110, iOS addendum, 2026-09-15).
 *
 * A pure module on purpose: no aliases, no React, so `npm test` can import it and pin the routes.
 *
 * ## The iPhone route
 *
 * The iOS app goes on the App Store on 2026-09-15. `6757918977` is the Apple ID of "Invoice Maker
 * by Invotick", read from Xcode's distribution logs (memory `ios-146-testflight-2026-09-13.md`).
 * Until it is live, `itunes.apple.com/lookup?id=6757918977` answers `resultCount: 0`, so this
 * deploy must wait for the listing. A button to a store page that does not exist yet is the one thing worse
 * than no button.
 *
 * iOS has no install referrer. After an App Store install the invoice does NOT open by itself, as it
 * does on Android through `iv_doc`. The receiver taps the link in their chat again. It is a
 * universal link (`/i/*` in the AASA), so it now opens the app on that invoice. The page says so
 * under the button. Fingerprinting to fake a referrer was ruled out.
 *
 * ## Why there is no "Open in the app" button
 *
 * - iOS does not open the app for a universal link to the same domain as the page it was tapped on.
 *   A button to `/i/{token}` would reload this page in Safari.
 * - A custom-scheme link shows Safari's "address is invalid" alert when the app is not installed.
 *   That is a broken-looking page in front of someone else's client (G3).
 * - A phone that has the app usually never sees this page: tapping the link in the chat opens the
 *   app directly.
 *
 * For the rest, Safari's Smart App Banner ([smartAppBanner]) says "Open" when the app is installed
 * and passes this document's address to it, and "Get" when it is not. Safari owns that tap, so it is
 * not in our events. That is written down, not guessed at.
 */
export const APP_STORE_ID = "6757918977";
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

const SITE = "https://www.invotick.com";

export type OwnCtaDestination = "play_store" | "app_store" | "web_app";
export type OwnCta = { destination: OwnCtaDestination; href: string; label: string };

/**
 * `route = "web_app"` is the dead-link branch. It forces the web tool on every device, the iPhone
 * included. An install whose first act is to open a dead token is not growth.
 */
export function ownCta(
  platform: "android" | "ios" | "desktop",
  installUrl: string,
  route: "auto" | "web_app" = "auto",
): OwnCta {
  if (route === "auto" && platform === "android") {
    return { destination: "play_store", href: installUrl, label: "Install Invotick — free" };
  }
  if (route === "auto" && platform === "ios") {
    return { destination: "app_store", href: APP_STORE_URL, label: "Get it on the App Store" };
  }
  return { destination: "web_app", href: "/", label: "Create yours — free" };
}

/** Next's `itunes` metadata: Safari's native Open/Get banner, pointing the app at this document. */
export function smartAppBanner(token: string): { appId: string; appArgument: string } {
  return { appId: APP_STORE_ID, appArgument: `${SITE}/i/${token}` };
}
