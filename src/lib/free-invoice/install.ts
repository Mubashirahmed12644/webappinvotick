/**
 * Where the free tool's install offer sends an Android phone (decision 0163).
 *
 * ## No `iv_doc`, and that is the point
 *
 * The share page's `installUrlForToken` puts the share token in the Play install referrer so the app
 * can open THAT document after install. **There is no equivalent here and the copy must never imply
 * one.** An invoice built in this browser lives in this browser's IndexedDB; the app installs empty.
 * The deferred deep link only carries a token the backend already holds (`shared_invoice.token`),
 * and a free-tool draft was never sent to the backend at all. iOS has no install referrer in any
 * case (AGENTS.md §5b).
 *
 * So the referrer carries the campaign tag and nothing else. The tag is matched by equality on all
 * three values (§1.16), never by a substring — `utm_source=free_invoice_tool` is ours and is not a
 * prefix of anybody else's.
 */
const PLAY_STORE_ID = "invotick.invoicemaker";

export function freeToolInstallUrl(): string {
  const referrer = encodeURIComponent(
    "utm_source=free_invoice_tool&utm_medium=web&utm_campaign=free_tool_install_offer",
  );
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&referrer=${referrer}`;
}

/**
 * Where the landing page's Google Play badge sends an Android phone.
 *
 * A **different `utm_source` from the install offer's**, deliberately. The offer
 * (`free_invoice_tool`) is pressed by somebody who has already made an invoice and got a PDF out of
 * this page; the badge is pressed by somebody who arrived and went straight to the store without
 * trying the tool at all. Two populations, two acquisition stories, and §1.16 matches a tag by
 * equality on all three values — so one tag for both would make them one number for ever, with
 * nothing saying so.
 */
export function landingPlayUrl(): string {
  const referrer = encodeURIComponent(
    "utm_source=invotick_landing&utm_medium=web&utm_campaign=landing_store_badge",
  );
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}&referrer=${referrer}`;
}

/**
 * The App Store listing, when there is one. **There is not, today.**
 *
 * Checked 2026-09-23: `itunes.apple.com/lookup` returns `resultCount: 0` for both
 * `id=6757918977` and `bundleId=invotick.invoicemaker`. So the landing renders the App Store badge
 * as *Coming soon* — flat, unpressable, and not a link. A badge that looks like a link and lands on
 * "App not available" is worse than no badge at all: on an iPhone it is the first thing the person
 * tries, and it tells them the product does not exist (G3).
 *
 * **Flipping it is this one line.** Give it the listing URL and `StoreBadges` renders a live App
 * Store link, an iPhone gets it first, and `free_invoice_store_badge_click` starts returning
 * `destination=app_store` rows — nothing else changes, and the event contract already declares that
 * value (decision 0163's `OFFER_DESTINATIONS` did the same for the install offer).
 */
export const APP_STORE_URL: string | null = null;
