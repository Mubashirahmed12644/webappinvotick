# 0207 — `/free-invoice` redirects to the free tool at `/` with a 308

- **Date:** 2026-10-05
- **Status:** built, not merged, not deployed. Web `fix/free-invoice-route-public` (off `gitlab/main` `c3fda11`).
- **The finding:** `https://www.invotick.com/free-invoice` answers `307 → /login?next=/free-invoice`.
- **Is it meant to be a public page? No — there is no such page, and there never was.**
  - No `src/app/free-invoice` in any commit (`git log --all` on that path is empty); the tool is `src/app/page.tsx` →
    `FreeInvoiceTool`, i.e. `/` (`AGENTS.md`: "that route has never existed").
  - Not in `sitemap.ts`, `robots.ts`, `next.config.ts`, the app repo (`invoice-kmp-app`, `release/1.5.1`), the backend,
    the admin panel, or any decision except 0163/0106's *file path* mentions (`src/lib/free-invoice/…`). The one URL
    reference in code is a unit test using it as an example of a non-share address.
  - It was only ever a name: the project's own notes quoted `/free-invoice` as the tool's address until 2026-09-23,
    which is how it reached the owner's mouth. The proxy's public list is `/`, auth pages and a few prefixes, so an
    unknown path is treated as a private page and sent to sign-in.
- **Decision:** answer it with a permanent redirect to `/`, from `next.config.ts` `redirects()`, not by adding a path
  to the proxy's public list. A redirect in config runs before the proxy and passes the query string through
  (`/free-invoice?utm_source=meta` → `/?utm_source=meta`). Nothing else becomes public; `/invoices` and the rest still
  answer 307 to sign-in. The list is data in `src/lib/legacy-redirects.ts` so `npm test` can read it.
- **Rejected:** making `/free-invoice` a second page serving the tool (two addresses for one thing, the same reason
  `/privacy` redirects to `/privacy-policy`); adding it to `PUBLIC_PREFIXES` (it would then 404, with no page).
- **Proof:** `npm run build` + `next start`: `/free-invoice` → 308 `/`; with a query string the query survives; `/` 200;
  `/privacy` still 308; `/invoices` still 307 login. `src/lib/free-invoice-route.test.ts` (3): red when the entry is
  removed, green with it. `npm test` 148/148 (145 before), English golden 72/72 unchanged, `tsc --noEmit` clean.
- **Found on the way, NOT changed (owner's call):** `/blog` and `/templates` also answer `307 → /login`, and both are in
  the sitemap (priority 0.7 and 0.8). The pages exist but both article lists are empty (`BLOG_POSTS`,
  `TEMPLATE_PAGES` = `[]`), so the choice is between making them public and taking them out of the sitemap until
  they have content.
