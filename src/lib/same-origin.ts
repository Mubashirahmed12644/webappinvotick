/**
 * True when a request to one of our own route handlers came from our own pages.
 *
 * The sign-up code routes set a session cookie, so a page on another site must not be able to make
 * a visitor's browser call them. A browser always says where a POST came from (`Origin`, and
 * `Sec-Fetch-Site`); a caller that says neither is not a browser and has no cookie jar of ours to
 * abuse, so it is let through.
 */
export function isSameOrigin(request: Request): boolean {
  const headers = request.headers;
  const origin = headers.get("origin");
  if (origin) {
    const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim();
    try {
      return host !== "" && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  return true;
}
