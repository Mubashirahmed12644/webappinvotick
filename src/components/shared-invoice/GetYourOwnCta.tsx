"use client";

import Link from "next/link";
import { trackWebEvent } from "@/lib/analytics/client";
import { ownCta } from "@/lib/shared-invoice-cta";

/**
 * The receiver → sender CTA: one slot on the page, one intent ("get your own Invotick"), three routes.
 *
 * - **Android** goes to the Play Store carrying the share token in the install referrer, so the app
 *   can open THIS document after install.
 * - **iPhone** goes to the App Store listing, from the iOS release on 2026-09-15 (decision 0110
 *   addendum). iOS has no install referrer, so the document does not open by itself after install.
 *   [IosAfterInstallNote] tells the receiver to tap the link again.
 * - **Desktop**, and every device on a dead link, goes to the web tool.
 *
 * Which route is which lives in `shared-invoice-cta.ts`, where `npm test` pins it.
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
  const cta = ownCta(platform, installUrl, route);

  if (cta.destination === "web_app") {
    return (
      <Link
        href={cta.href}
        className={className}
        onClick={() => trackWebEvent("shared_invoice_create_own_click", { destination: "web_app" })}
      >
        {cta.label}
      </Link>
    );
  }

  return (
    <a
      href={cta.href}
      className={className}
      // Leaving for a store cancels an in-flight request; `keepalive` in trackWebEvent is what keeps
      // this one alive across the navigation.
      onClick={() => trackWebEvent("shared_invoice_create_own_click", { destination: cta.destination })}
    >
      {cta.label}
    </a>
  );
}

/**
 * One line under the iPhone buttons, only on a live document.
 *
 * - **"Tap the link again".** After an App Store install nothing brings the receiver back to this
 *   invoice: iOS has no install referrer. The link in their chat does, because it is a universal
 *   link. Without this line, the step that closes the loop is one nobody would guess.
 * - **The web app stays**, as a text link rather than a second button. The web route an iPhone had
 *   until today is kept, and one filled button remains the primary action.
 */
export function IosAfterInstallNote({ kind }: { kind: string }) {
  return (
    <p className="text-center text-xs text-neutral-500">
      After installing, tap the link in your chat again to open this {kind.toLowerCase()} in the app.{" "}
      <Link
        href="/"
        className="font-medium text-[#0D4DC0] underline"
        onClick={() => trackWebEvent("shared_invoice_create_own_click", { destination: "web_app" })}
      >
        Or create one on the web
      </Link>
    </p>
  );
}
