"use client";

import { trackWebEvent } from "@/lib/analytics/client";

/**
 * "Download PDF" on the shared document page.
 *
 * Two behaviours behind one promise (decision 0017): on Android it sends the receiver to the app,
 * because a person holding the product and wanting something from it is the best moment in the
 * growth loop; everywhere else it produces the PDF in the browser, because there is no iOS app to
 * install and a desktop has nowhere to be sent.
 *
 * The card and the page description say "download the PDF" without listing the steps, and that stays
 * true either way: the receiver does get a PDF. Only the route differs.
 *
 * **The browser route is the print dialog, deliberately.** Every desktop and mobile browser offers
 * "Save as PDF" there, so the file is produced on the receiver's own machine from the page they are
 * already looking at. The alternative — rendering PDFs on a server — would mean running a headless
 * browser per request and storing or streaming the result, for a file the client can already make
 * from the same HTML. It would also be one more thing that can be stale, empty, or wrong.
 *
 * **One event, `destination` as the parameter.** Wanting the document is one action; the two routes
 * are the variation (`AGENTS-EVENTS.md` §1.1). It is a separate name from
 * `shared_invoice_create_own_click` because getting a copy of someone else's invoice and wanting
 * your own invoicing app are two different intents, and one button label would have hidden that.
 *
 * The event says the click happened and where it was sent. It does NOT say a PDF was produced:
 * nothing here can see whether the receiver finished the print dialog or came back from the Play
 * Store, and a name like `pdf_downloaded` would claim an outcome we never observed (§1.14).
 */
export function PdfButton({
  platform,
  installUrl,
  kind,
}: {
  platform: "android" | "ios" | "desktop";
  installUrl: string;
  kind: string;
}) {
  if (platform === "android") {
    return (
      <a
        href={installUrl}
        className="flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-800"
        onClick={() => trackWebEvent("shared_invoice_pdf_click", { destination: "play_store" })}
      >
        Download PDF
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        trackWebEvent("shared_invoice_pdf_click", { destination: "print_dialog" });
        window.print();
      }}
      className="flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-800"
      aria-label={`Download this ${kind.toLowerCase()} as a PDF`}
    >
      Download PDF
    </button>
  );
}
