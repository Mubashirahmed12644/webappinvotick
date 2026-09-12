# 0072 — The IP routes answer admins only, never the internet

**Status:** decided by the lead on 2026-09-13, under the owner's standing rule: backend changes that are not
schema, secrets or Play uploads go without asking. Built as backend `fba532c` (branch
`fix/validation-error-answers-4xx`), riding batch3.
**Related:** 0071, `memory/admin-panel-security-audit.md`, AGENTS.md §5 (admin panel).

## Context (read-only, 2026-09-13)

- **`/v1/ip/**` was in `security.public-paths`, and `IpRecordController` had no `@RequireRole`.** So anybody on
  the internet, with no token, could:
  - list every stored IP record with its location (`GET /v1/ip`), and read the suspicious-IP list and the stats;
  - soft-delete a record (`DELETE /v1/ip/{ip}`);
  - make the server spend its paid lookup quota (`POST /v1/ip/refresh/{ip}`).
- **0 requests reached it** in Prometheus's 15 days.
- **Its one caller is the admin panel's IP page** (`lib/api.ts:704/708/713`).
  - The page sends the stored admin token.
  - That token is stored only after `/v2/auth/admin-login` or `/v2/auth/admin-verify-otp`, and both refuse a
    user who is not ADMIN.
  - The same token answered 200 on routes that already require ADMIN.

## Decided

- **The path leaves `security.public-paths`, and the controller is `@RequireRole(UserRole.ADMIN)`,** like every
  other admin controller.
- **Answers by caller:**
  - no token → 401;
  - a guest or an ordinary user → 403;
  - an admin → 200 on the panel's three calls.
- **Guard:** `TheIpRoutesAreForAdminsOnlyTest`, on the real security chain, with real tokens and roles read from
  the database. Before the fix, no token, a guest's token and a user's token all read the records, and the
  delete ran.

## Rejected

- **Leaving it public.** It exposes personal data and spends money, for anybody.
- **Only taking it off the public list.** `AuthorizationInterceptor` lets a handler with no `@RequireRole` through
  for any signed-in caller, and every app user holds a guest token.

## Consequences

- **Every entry on `security.public-paths` reaches its controller with no token at all.** Each one needs the
  same check.
- **`/v1/lookup/phone` is also on the list, and is not checked yet.** If it tells whether a phone number
  belongs to a user, anyone can test numbers against it.
