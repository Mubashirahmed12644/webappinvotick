# 0026 — A session is renewed before it dies, never revived after

**Date:** 2026-08-28
**Status:** Decided, implemented in `invotick-apis` (unpushed) and `invoice-kmp-app` (`VC_93_VN_142`)
**Goal served:** G3 (trust) — sync that has stopped working must not look like sync that is working

## The question

Tokens live 90 days. There was no way to renew one, so day 91 ended a session permanently, and the
app never said so. Measured on production for 1.4.1: `AUTH_TOKEN_REJECTED` is **1,515 failures across
~63 users** — the failure class touching more users than any other — with devices retrying a dead
token for days while the app looked healthy.

Two things were missing, and they are not the same thing: nothing renewed a token, and nothing
reacted when one died.

## What was actually there

- `ApiEndpoints.REFRESH_TOKEN = "v1/auth/refresh"` is declared in the app and names **a route that
  has never existed** on the backend. No auth DTO carries a refresh token; no service mints one.
  Nothing calls the constant either, which is the only reason this was invisible rather than broken.
- `refreshToken = null` appears three times in `AuthRepositoryImpl` — the app was not discarding a
  refresh token, it was never being given one.
- `jwt.expiration.ms=604800000` (7 days) sits in `application.properties` and **nothing reads it**.
  The real lifetime is `JwtService.generateToken(expiryDays = 90L)`. This entry exists partly so the
  next person does not read that property and believe it.

## Decision

**1. The server hands back a fresh token before the current one dies.** Any authenticated request
made while the token still has fewer than 30 of its 90 days left comes back with `X-Renewed-Token`,
and the app stores it. A user who opens the app even once inside 90 days never expires again.

**2. An expired session is never revived.** The app tells the person and asks them to sign in.

**3. A 401 from sync still never signs anybody out.** Their invoices are on the device; putting local
work behind a login screen to fix a credential problem would be a worse answer than the stale token.

## Rejected: a refresh-token scheme

The textbook answer, and wrong here. It needs a new endpoint, a new store, and rotation/revocation
semantics — but decisively: **every user alive today holds a 90-day token and no refresh token**, so
it would rescue nobody currently in trouble and would only start working once everyone had updated
*and* signed in again. Renewal on a response header costs one header, no schema, and no new endpoint,
and older builds ignore a header they do not know.

## Rejected: accepting an expired token within a grace window

This would have rescued the ~63 users who are already dead, by letting a recently-expired token be
exchanged for a live one. Rejected: it makes expiry mean nothing inside the window and hands a stolen
token a second life. Expiry that can be waived is not expiry. The honest answer for a session that
has already ended is to ask the person to sign in — which is what decision 2 does.

## Rejected: clearing the expiry flag whenever the session reads back as Authenticated

Tempting, because every login path ends there. It is wrong: at launch a stored session reads back as
Authenticated *whether or not its token still works*, so the flag would be wiped before anything
could show it — on exactly the devices whose stored token is the expired one. The flag is cleared in
`SessionManager.onLoginSuccess`/`onGuestLogin`, which fire only when a **new** token arrives.

## The second defect this uncovered

`onSyncUnauthorized` raised the pending-**guest**-auth flag for everybody. `SyncManager` reads that
flag behind `&& sessionManager.isGuest`, so for a registered user it was raised and then ignored —
which is the whole reason their sync could die in silence. `GuestAuthRestorer` reads the same flag
and had **no such check**, so a guest sign-in could run underneath a registered user. Both are now
correct: the interceptor routes guests and registered users to different callbacks, and the restorer
checks the session through `restoreNow()` (not `isGuest`, which answers `false` while the session is
still `Loading` and would strip a real guest's flag at startup).

Devices already carry a wrongly-set flag from earlier builds, so the restorer **clears** it for a
non-guest rather than merely skipping — otherwise the wrong state would be re-evaluated for ever.

## Verification

- `TokenRenewalServiceTest` — 5 cases: fresh token untouched, near-expiry replaced with a full-length
  session, kill switch, drain-scoped token never upgraded, unknown user. Backend suite **309/309**.
- The tests were checked by inverting the threshold comparison in the implementation and confirming
  they fail. The first run caught only one of the two, because `a fresh token is left alone` had no
  stubbed user lookup and was returning null for the wrong reason — it passed against broken code.
  Stubbed, both now fail on the break. A test that cannot fail is not verification.

## Kill switch

`auth.token-renewal.enabled=false` stops renewal without an app release.
