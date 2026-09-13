# 0073 — Four more public routes stop answering strangers; admin-login-as-user goes on the owner's yes

**Status:** decided by the lead on 2026-09-13 for items 1–4, under the owner's standing rule: backend changes that
are not schema, secrets or Play uploads go without asking. Item 5 waits for the owner's yes. Nothing is deployed.
**Built** in worktree `invotick-apis-public`:
- `fix/public-routes-tightened`: `d5ff958`, `2f31ca3`, `b6e0faf`, `ef07c3f`, then `7dd87b4` (docs); 739/739;
- `fix/delete-admin-login-as-user`: `801841c`, on top of branch 1; 740/740.

**Related:** 0072, `memory/admin-panel-security-audit.md` (the 2026-09-13 review of every public route).

## Context (read-only, 2026-09-13)

- **`security.public-paths` had 40 entries, all open for every HTTP method.** Each reaches its controller with no
  token at all.
- **No caller in the admin panel, the web or the app uses any of the five routes below.** 0 requests reached
  `push-health`, springdoc or `admin-login-as-user` in 15 days.

## Decided

1. **`push-health` is deleted.** It sat under the `/v2/shared-invoice/*` wildcard and showed Firebase project ids,
   and it has no caller anywhere. The share wildcard now opens only the share link, and the three share calls
   still answer with no token.
2. **springdoc (`/v3/api-docs`, `/swagger-ui`) is off in every profile except `local`,** and its three public paths
   are gone (39 → 36).
3. **`/r/{id}/{refCode}` URL-encodes `refCode`,** so a code can no longer add query parameters to the Play Store
   URL. Printed referral links redirect to the identical address.
4. **`POST /v1/contacts/backfill/registered-phones` is ADMIN-only,** and it refuses a `limit` above 5,000 with a 400.
   Before, any guest token could run it with no bound.
5. **On the owner's yes: `/v2/auth/admin-login-as-user` is deleted.**
   - It gave a 24-hour token as any user for the admin password alone, with no email code.
   - The impersonation write-block never ran on app routes, so that token could write anywhere.
   - 0 requests, no caller.

## Rejected

- **Moving `push-health` under an admin route.** It has no caller.
- **Clamping `limit` instead of refusing it.** A partial pass would read as a whole one.
- **Keeping springdoc public in production.** It maps the whole API for strangers.

## Not in this decision (the owner's calls, or on the VPS)

- **`/v1/lookup/phone`** is a public reverse phone lookup: 77,625 names, none of them a user's. Close it, or narrow
  it to the caller's own contacts.
- **`go.invotick.com`** serves `/actuator/prometheus` (nginx on the VPS).
- Rate limits, the lock and email-code policy, guest re-login proof, and the deny-unless-annotated interceptor.

## Check after deploy

- `push-health` answers 404.
- `/v3/api-docs` answers 401 with no token.
- A printed referral link still redirects to the same address.
- The backfill answers 403 to a guest.
- A day after item 5 deploys, the impersonation leftovers can go: the `isAdminImpersonation` claim, the write-block,
  and the renewal refusal.
