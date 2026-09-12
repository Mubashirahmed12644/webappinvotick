# 0065 — A failed guest sign-in carries its call's evidence

- **Date:** 2026-09-12
- **Status:** decided (owner, 2026-09-12: "guest sign-in failures should carry request id, HTTP
  status and cause class in 1.4.6", the sync agent's recommendation); built for 1.4.6 on
  `invoice-kmp-app` `feat/146-journey-instrumentation`, not merged. Amends 0050's stage table with a
  `guest_auth` row.
- **Decision:** The server guest sign-in (`AuthApi.loginAsGuest`) sends an `X-Request-Id` minted by
  its caller. It records the answer's status and echoed id as soon as the answer arrives, before the
  body is read. When the sign-in fails, `sync_failed` with `stage=guest_auth` carries:
  - `request_id`: always, even when no answer came;
  - `http_status`: when an answer arrived;
  - `exception_class`: the class of what the call threw, never our `AuthException` wrapper and never
    the plain `Exception` the use case used to build. It is absent when the server answered in JSON
    and nothing threw.

  `reason` keeps its text, so nothing that reads it today changes.

## Why

- The Play pre-launch device sent 4 × `guest_auth` "An unexpected error occurred" on 1.4.5, each with
  `exception_class=Exception`.
- The same text came from vc94 (55 events, 10 devices) and vc97 (29 events, 2 devices) in 30 days.
- The cause was unknowable. `AuthRepositoryImpl` turned the exception into
  `AuthResult.Error(message)`, and `AuthenticateGuestUseCase` turned that into
  `Exception(message)`, so the class, the status and the call's identity were gone before
  `SyncManager` reported.
- The client does not set `expectSuccess`. A 5xx page in HTML therefore fails in `body()`, which is
  mapped to `UnknownError` ("An unexpected error occurred"), and its status was known and thrown away.

**The item as written named `guest_login_failed`, and the evidence does not belong there.**
- That event fires only from the offline-first guest creation (splash, login screen), which makes no
  network call, so no request id or status can exist on it.
- 30 days: 7 rows, all vc94 `reason=l1`, 0 on vc97 or vc101.
- The text the item describes arrives on `sync_failed stage=guest_auth`, from SyncManager's step 0.

## Rejected

- **The parameters on `guest_login_failed`.** They would always be absent: nothing on that path calls
  the server.
- **A new `guest_sign_in_failed` event.** `sync_failed stage=guest_auth` fires at that exact moment,
  and Sync Health already files it (§1.1).
- **Wrapping the thrown exception to carry the status.** `AuthErrorMapper` classifies by type. A
  wrapper would turn a network failure that happens after the answer into `UnknownError`. A trace the
  API fills in changes no type.
- **Reporting the splash's background attempt and `GuestAuthRestorer` too.** One failing guest would
  report the same outage three times. Step 0 stays the one place that reports, as the sync design
  already had it.

## Consequences

- **Backend: no change.**
  - The evidence path (`CARRIES_SYNC_EVIDENCE`) already files these rows.
  - `error_type` becomes `HTTP_<status>` or the class, where it read `Exception` (or `OTHER` on
    builds before the evidence).
  - `last_trace_id` holds the request id, so the Sync Health drill-down's Server-log button finds the
    server's own lines for the call: `MdcRequestFilter` adopts the id on every path.
- The signature of a guest sign-in failure changes on 1.4.6: `guest_auth / HTTP_502` rather than
  `guest_auth / Exception`. Old rows keep their signature.
- Tests:
  - the real `AuthApiImpl` over Ktor's `MockEngine` (a test-only dependency): an HTML 502, a JSON 409,
    no answer, and the echoed id;
  - `SyncFailureEvidenceTest`: the table's new row.
