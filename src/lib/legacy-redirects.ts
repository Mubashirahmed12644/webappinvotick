// Old or guessed addresses that must land somewhere real instead of the sign-in page (decision 0207).
// Kept as data in its own module so `npm test` can read it: next.config.ts cannot be imported by Node's test runner
// (it uses __dirname). next.config.ts hands this list to Next's `redirects()`, which runs BEFORE the proxy, so none of
// these ever reaches the sign-in redirect, and it passes the query string (UTM tags) through to the destination.
export const LEGACY_REDIRECTS = [
  {
    // One address for the policy. /privacy-policy is what goes into the app stores and the apps;
    // /privacy is where the old site linked, so it keeps working with a permanent (308) redirect
    // instead of serving the same text twice under two addresses.
    source: "/privacy",
    destination: "/privacy-policy",
    permanent: true,
  },
  {
    // The free invoice tool IS the landing page, `/`. There has never been a /free-invoice route, but the project's
    // own notes quoted that address until 2026-09-23, and it is what anybody types for "the free invoice tool". With
    // no page there, the sign-in proxy answered it with 307 -> /login?next=/free-invoice.
    source: "/free-invoice",
    destination: "/",
    permanent: true,
  },
];
