"use client";

import { useState } from "react";
import { trackWebEvent } from "@/lib/analytics/client";
import { platformFromUserAgent, type ViewerPlatform } from "@/lib/analytics/platform";
import { freeToolInstallUrl } from "@/lib/free-invoice/install";

/**
 * The soft install offer — option A of decision 0163.
 *
 * ## Four rules it exists to keep
 *
 * 1. **It appears only after the value moment.** The caller mounts it when a PDF has actually been
 *    saved. A person who has not yet got anything out of this page is never asked for anything.
 * 2. **It never blocks.** It is a card, not a dialog: no scrim, no focus trap, no Escape handling
 *    needed, nothing behind it is disabled, and creating, previewing and downloading all keep
 *    working with it on screen. Option B — gating the download, the preview or a second invoice
 *    behind an install — was rejected outright: this page's whole promise is "no install, no
 *    sign-up", and a promise withdrawn at the last step is a trust cost (G3), which outranks G2.
 * 3. **The copy is true.** Two things are easy to imply here and both would be false:
 *    - the invoice does **not** follow them into the app. There is no carry-over for a draft that
 *      never left the browser (see `install.ts`), so the card says the invoice stays here.
 *    - the browser is not storage. Clearing site data removes these drafts, so the card says that
 *      too, and the account route is offered as the actual fix.
 * 4. **Nobody is sent to a store that has no app.** Android goes to Play. An iPhone does not go to
 *    the App Store, because Invotick is not on it — checked 2026-09-23, `itunes.apple.com/lookup`
 *    returns `resultCount: 0` for both `id=6757918977` and `bundleId=invotick.invoicemaker`. iPhone
 *    and desktop get the account offer, which is the honest version of "keep your invoices" on a
 *    device with no app. When the listing exists, the `ios` branch here and the `app_store` value
 *    already in the event schema are one change.
 *
 * ## Why the platform is read in the browser
 *
 * `page.tsx` is a static, SEO-critical page; calling `headers()` there to read the User-Agent would
 * make the whole landing page dynamic for one card that appears after a download. So this reads
 * `navigator.userAgent` — through the SAME `platformFromUserAgent` the analytics route uses on the
 * server, so the branch that rendered and the `viewer_platform` stamped on the event cannot drift
 * (the one implementation, two readers rule in `platform.ts`). The value still never comes from the
 * browser's request body: the route reads the request's own User-Agent header (§1.17 rule 4).
 *
 * This component is mounted by a click, never by the server render, so reading `navigator` on its
 * first render cannot produce a hydration mismatch — there is no server HTML for it to differ from.
 */
export function InstallOffer({ onCreateAccount, onClose }: { onCreateAccount: () => void; onClose: () => void }) {
  // Read once, on the first render, and never again: the device does not change mid-visit. The
  // guard is for a render with no `navigator` at all — this component is only ever mounted by a
  // click, so that cannot happen today, and it must not become a crash if it ever does.
  const [platform] = useState<ViewerPlatform | null>(() =>
    typeof navigator === "undefined" ? null : platformFromUserAgent(navigator.userAgent),
  );

  // Nothing renders until the device is known: showing the account card to an Android phone for one
  // frame and then swapping it for the Play card would be a different offer than the one measured.
  if (!platform) return null;

  const android = platform === "android";

  function dismiss(method: "close_button" | "not_now") {
    trackWebEvent("free_invoice_install_offer_dismissed", { method });
    onClose();
  }

  return (
    <div
      role="complementary"
      aria-label="Keep your invoices"
      className="fixed inset-x-3 bottom-3 z-40 sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <div className="relative rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 pr-10 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={() => dismiss("close_button")}
          className="absolute right-2 top-2 rounded-full p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="text-base font-extrabold text-[var(--color-on-surface)]">
          {android ? "Make the next one faster" : "Keep your invoices"}
        </p>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          {android
            ? "The free Invotick app keeps your business, clients and items on your phone, so the next invoice takes seconds."
            : "A free account keeps your invoices in your Invotick account, so you can open them on any device."}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-[var(--color-on-surface-variant)]">
          {android
            ? "This invoice stays in this browser — it won't appear in the app, and clearing your browser data removes it."
            : "Right now these invoices are only in this browser, and clearing your browser data removes them."}
        </p>

        <div className="mt-3 flex items-center gap-2">
          {android ? (
            <a
              href={freeToolInstallUrl()}
              // Leaving for Play cancels an in-flight request; `keepalive` in `trackWebEvent` is what
              // keeps this one alive across the navigation.
              onClick={() => trackWebEvent("free_invoice_install_offer_click", { destination: "play_store" })}
              className="flex-1 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-on-primary)]"
            >
              Get the free app
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackWebEvent("free_invoice_install_offer_click", { destination: "web_account" });
                onCreateAccount();
              }}
              className="flex-1 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-on-primary)]"
            >
              Create a free account
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss("not_now")}
            className="rounded-full px-3 py-2.5 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
