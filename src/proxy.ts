import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = process.env.AUTH_COOKIE ?? "invotick_session";
// Auth pages: reachable when logged out; redirect logged-in users to the app.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];
// Public pages: reachable by anyone (crawlers included), no redirect.
// "/i/" = shared invoice view (invotick.com/i/{token}) + its OG image — recipients
// are never logged in, so this MUST stay public. Trailing slash is deliberate so
// it can't ever match the authenticated "/invoices" route.
// "/.well-known/" = Android App Links assetlinks.json (must be publicly fetchable).
// "/embed/" = headless invoice renderer loaded inside the app's WebView (and later the
// single renderer for OG / shared-invoice) — the app WebView has no web session, so public.
const PUBLIC_PREFIXES = ["/privacy", "/i/", "/.well-known/", "/embed/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(COOKIE)?.value);
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));
  // The landing ("/") and marketing pages stay public — the SEO funnel and the
  // free invoice tool must work without an account.
  const isPublic =
    pathname === "/" || isAuthPage || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Not logged in and trying to reach a protected page -> go to login.
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A way out of a session the server has already ended.
  //
  // Signing a browser out happens on the phone, so this browser learns nothing about it: the cookie
  // stays, every API call comes back 401, and asking for /login only bounces the user to an app that
  // no longer works. `?signout=1` drops the cookie and leaves them on the sign-in page — which is
  // where the redirect below would otherwise never let them reach.
  if (hasSession && isAuthPage && request.nextUrl.searchParams.get("signout") === "1") {
    const url = request.nextUrl.clone();
    url.search = "";
    const response = NextResponse.redirect(url);
    response.cookies.delete(COOKIE);
    return response;
  }

  // Already logged in and visiting an auth page -> go to Home (but let logged-in
  // users still view the public landing / marketing pages).
  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/invoices";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, API routes, static assets, and the
  // SEO/metadata routes (sitemap.xml, robots.txt, opengraph-image) — those must
  // serve their own content, never get auth-redirected to /login.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|js|txt|xml)$).*)"],
};
