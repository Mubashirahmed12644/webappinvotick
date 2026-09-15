/**
 * The share link an event came from, stamped by the server as `iv_doc` (decision 0110).
 *
 * ## Why `iv_doc`, and why the token itself
 *
 * `iv_doc` is already the name of this exact value on `install_referrer`: the page's Play button puts
 * the token there, the app reads it back after install, and `findShareLoopInstalls` joins it to
 * `shared_invoice.token`. The same name for the same code space means one join expression covers
 * the page view, the button press and the install (§1.15). A hash was rejected: it would be a second
 * code space for one thing, and the join would have to hash every `shared_invoice` row in SQL rather
 * than use its unique index. The raw token is no new exposure. `install_referrer` already stores it
 * for the same links (rows from 2026-08-25 on), and only admins read `analytics_events`.
 *
 * ## Why from the Referer, and never from the body
 *
 * The browser body may carry only the event name and schema parameters (see `events.ts`), and that
 * stays true. The page that sent the event is `/i/{token}`, and a same-origin `fetch` carries that
 * address in `Referer` under the browser's default policy (`next.config.ts` sets none). So the
 * server reads the page's own address and the client code is untouched. A tab opened before this
 * shipped gets the token too.
 *
 * What this does NOT prove: a non-browser caller can write any Referer, just as it can call any path.
 * So only a value shaped exactly like a token we mint is kept. It still counts only where it matches
 * a real `shared_invoice` row, and that is where the join puts it.
 *
 * Absent when there is no Referer (a privacy setting, an embedded browser that strips it) or it is
 * not a share page: unknown, never a guess (§1.7). Rows without it are how that gap stays visible.
 */

/** `SharedInvoiceService.newToken`: 16 characters from `abcdefghijkmnpqrstuvwxyz23456789`. */
const SHARE_TOKEN_RE = /^[a-km-np-z2-9]{16}$/;

/** `/i/{token}`, with the trailing slash Next would redirect away. Nothing below it. */
const SHARE_PATH_RE = /^\/i\/([^/]+)\/?$/;

export function shareTokenFromReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  let path: string;
  try {
    // Absolute URLs only. A browser always sends one, and a bare path is something a caller made up.
    path = new URL(referer).pathname;
  } catch {
    return null;
  }
  const token = SHARE_PATH_RE.exec(path)?.[1];
  return token && SHARE_TOKEN_RE.test(token) ? token : null;
}
