# 0005 — Editing a shared invoice mints a new token

- **Date:** 2026-07
- **Status:** decided
- **Decision:** When a shared invoice is edited, the backend revokes the old token and mints a fresh
  one; the app shares the **returned** URL, not a pre-warmed stale one.
- **Why:** WhatsApp and other chat apps cache the OG card per URL. Reusing the URL left receivers
  looking at a stale card for an invoice that had changed.
- **Rejected:**
  - Reusing the same token and busting the cache with a query string — chat apps still served the
    cached preview.
- **Consequences:**
  - A previously shared link stops working after an edit — intended, but it must be communicated in
    the UI.
  - Any feature keyed on the token (approval loop, analytics) must handle token rotation.

See `memory/shared-invoice-edit-new-token.md`.
