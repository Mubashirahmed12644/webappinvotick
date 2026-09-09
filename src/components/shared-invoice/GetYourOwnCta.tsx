"use client";

import Link from "next/link";
import { trackWebEvent } from "@/lib/analytics/client";

/**
 * The receiver → sender CTA: one slot on the page, one intent ("get your own Invotick"), two routes.
 *
 * Android goes to the Play Store carrying the share token in the install referrer, so the app can
 * open THIS document after install. Everyone else goes to the web tool, because there is no iOS app
 * on the App Store to send them to (checked 2026-09-09: `itunes.apple.com/lookup` returns nothing
 * for `invotick.invoicemaker`) and a desktop has nowhere to be sent.
 *
 * **One event, `destination` as the parameter.** Splitting it into `install_click` and
 * `create_own_click` would put one funnel step under two names, and the first query that forgot one
 * of them would report a lower number with nothing saying so (`AGENTS-EVENTS.md` §1.1). The name is
 * the app's existing `shared_invoice_create_own_click` — the same action on another surface, fired
 * on the click, exactly as `ReceivedInvoiceViewModel` fires it.
 *
 * It was a plain `<a>`/`<Link>` in the server component before this. It is a client component now
 * for one reason only: the web has no auto-capture, so every tap here is a written call.
 */
export function GetYourOwnCta({
  platform,
  installUrl,
  className = "flex-1 rounded-full bg-[#0D4DC0] px-4 py-2.5 text-center text-sm font-medium text-white",
  route = "auto",
}: {
  platform: "android" | "ios" | "desktop";
  installUrl: string;
  className?: string;
  /**
   * `web_app` forces the browser route whatever the device is, and the dead-link branch uses it.
   *
   * The install URL carries `iv_doc=<token>` in the Play referrer so the app opens THIS document
   * after install. When the token is already dead that is an install whose first act is to fail —
   * the app fetches the token, gets nothing, and fires `shared_invoice_open_failed`, which is
   * already the most common event this loop produces (138 firings against 70 successful opens in
   * the 30 days to 2026-09-09). Sending someone to the Play Store to meet that is not growth.
   */
  route?: "auto" | "web_app";
}) {
  if (platform === "android" && route === "auto") {
    return (
      <a
        href={installUrl}
        className={className}
        // Leaving for the Play Store cancels an in-flight request; `keepalive` in trackWebEvent is
        // what keeps this one alive across the navigation.
        onClick={() => trackWebEvent("shared_invoice_create_own_click", { destination: "play_store" })}
      >
        Install Invotick — free
      </a>
    );
  }

  return (
    <Link
      href="/"
      className={className}
      onClick={() => trackWebEvent("shared_invoice_create_own_click", { destination: "web_app" })}
    >
      Create yours — free
    </Link>
  );
}
