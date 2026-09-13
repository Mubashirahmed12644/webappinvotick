# 0075 — "Admin as user" is deleted; support gets a read-only view of the user in the admin panel

**Status:** decided by the owner on 2026-09-13 ("Hata dein + support view").
- The deletion is built (`801841c`, 740/740) and rides the next deploy together with 0074.
- The support view is still to be planned.

**Related:** 0072, 0073, 0074, `memory/admin-panel-security-audit.md`.

## Context

- **What the route did.** `/v2/auth/admin-login-as-user` gave a 24-hour token as any non-admin user for the admin
  email and password alone, with no email code. The impersonation write-block never ran on app routes, so that token
  could write anywhere.
- **Use:** 0 requests in 15 days, and no caller in the panel, the web or the app.
- **Why it existed, in the owner's words:** when a user contacts us about a problem, we can see the app the way they
  see it.

## Decided

- **The route is deleted:** the handler, the service method, the request type and the public-path entry.
  - The impersonation leftovers (the claim, the write-block, the renewal refusal) go a day after the deploy, once
    any token it minted has expired.
- **Support gets a read-only "support view" in the admin panel instead,** behind the admin's own login and its email
  code. It shows:
  - the user's businesses, clients and items;
  - their invoices, rendered exactly as the app renders them (the same HTML renderer);
  - their phones and app versions, sync failures and premium status;
  - a record of who looked, and when.

  It builds on what the panel already has: the user page's timeline, invoices and stats; each invoice's own view;
  and sync and billing health.

## Rejected

- **Keeping it.** The admin password alone opened every account, for 24 hours, with writes allowed, and with no
  record of use.
- **A safer "as user"** (an email code, 30 minutes, read-only, audited). Used in the app, the admin's phone still
  becomes a second device on the user's account, and its local data can sync into theirs.

## Consequences

- **Data that is still only on the user's phone** (not yet synced) does not show in the support view. A "send
  diagnostics to support" button in the app can cover it later.
- **The record of views** starts as a log line and a counter. A table needs a migration, and so the owner's word.
