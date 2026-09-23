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
