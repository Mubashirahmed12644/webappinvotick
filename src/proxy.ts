import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = process.env.AUTH_COOKIE ?? "invotick_session";
// Auth pages: reachable when logged out; redirect logged-in users to the app.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];
// Public marketing pages: reachable by anyone (crawlers included), no redirect.
const PUBLIC_PREFIXES = ["/privacy"];

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
