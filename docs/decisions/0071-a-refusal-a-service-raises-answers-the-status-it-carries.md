# 0071 — A refusal a service raises answers the status it carries, never 500

**Status:** decided under the owner's "pending work start kro apni tarteeb sy" (2026-09-12). Built as backend
`15c0820` (`fix/validation-error-answers-4xx`, on stage `d916a6d`), not deployed.
**Date:** 2026-09-13.
**Related:** 0050, 0070, `.claude/agents/sync.md` rule 22.

## Context (read-only, 2026-09-13)

- **`CustomValidationError` carries a status.** It is 400 by default. 82 of its 142 throw sites, in 19
  services, chose 404 (31), 403 (29), 401 (15) or 400 (7). No throw site uses a 5xx.
- **The status was never read.** `GlobalExceptionHandler` had no handler for the class, so every REST refusal
  answered `500 An unexpected server error occurred`.
  - It was logged as two ERROR lines.
  - It counted toward the High 5xx Error Rate alert.
  - The web showed "server error" where the server had given a reason.
- **Production, 15 days:**
  - 3 requests reached these routes, all successful;
  - 0 answered 500 because of this error;
  - the app never calls these routes.

  So this is fixed before it hurts.

## Decided

- **One handler answers `ex.status` with the refusal's own message** (`ApiResponse(false, message, null)`),
  logged at WARN through the existing `logApiFailureResponse`.
- **Nothing else moves.**
  - No throw site changes.
  - No `@Transactional` rule changes.
  - The class hierarchy does not change.
  - The handler runs after the exception has left the controller, so no transaction's outcome moves.
- **No client changes behaviour.**
  - The web forms and the proxy show the words.
  - A "User not found" 401 now signs the browser out, which the JWT filter's own 401 already does.
  - The admin panel never reaches these routes.
  - App sync on vc97, vc101 and 1.4.6 treats a whole-request 4xx exactly like a 5xx; only a 401 has its own path.
  - No client retries a 500 while quarantining a 4xx.

## Rejected

- **Making the class a `ResponseStatusException`.** The JWT filter reads that class as "token invalid".
- **Throwing `ResponseStatusException` at the throw sites.** The v1 sync's `noRollbackFor` would stop matching,
  and a refused record would roll back its v1 phase.
- **One flat 400 or 422.** It discards the 404s and 403s the services chose, and gains nothing, because the web
  proxy already flattens every answer except 401.
- **Keeping 500 on `/sync/` paths.** Nothing in the sync paths throws it, so that check could never fire.

## Consequences

- If a future change lets one escape a sync path, it will answer 4xx there. Keep the per-record catches.
- **Unchanged, from the code:** a v1 refusal crossing a `@Transactional` method without the rule rolls its phase
  back and answers 500. That covers `ClientService`, `BusinessService` and `PaymentService.updatePayment`. No v1
  push got past the token in 15 days.
- **Check after deploy:** an authenticated `GET /v1/invoices/{random uuid}` answers 404 "Invoice not found."
  (500 before). 5xx on these routes stays at 0.

## Found alongside (not part of this decision)

- **`/v1/ip/**` is in `security.public-paths`.** The IP controller answers without a token: the list of every
  record, delete, and a paid refresh. 0 requests reached it in 15 days.
- **`/v2/sync/push` answered about 146 × 500 in 15 days, and nothing records their cause.**
- **`/v2/analytics/track` answered about 731 × 500 in 15 days.**
