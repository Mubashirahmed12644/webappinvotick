# 0118 — A wrong admin sign-in is counted, and the count is kept

- **Date:** 2026-09-20
- **Status:** decided. The counting fix is technical (Tier 1). How the lock treats the passkey was decided by the
  owner on 2026-09-20: he asked for a "machine whitelist" that is never locked, and chose *the passkey is the
  whitelist* (option C below). Built on branch `fix/auth-failure-counters-commit` in `invotick-apis`, on top of
  `feat/admin-passkey2` `d59691f` (0117, after its own rebase). Not merged, not deployed: the owner gives the go.
  - Commit 1 `6ce2a4c`, the counts are kept: `AWrongSignInIsCountedTest` 6 of 8 red before, 8/8 after.
  - Commit 2 `d968489`, the passkey is not held by those locks: 4 new tests in `AdminPasskeySignInTest`, 2 red before, all green
    after.
  - Full suite 1193/1193 (the passkey branch's 1181 + 12), including `SpringContextBootTest`,
    `MigrationsApplyToLiveSchemaTest` and `RoutesDeclareWhoMayCallThemTest`.
  - No migration.
- **Decision:** the two steps of the admin sign-in (`AuthService.adminLogin`, `AuthService.adminVerifyLoginOtp`) no
  longer run inside one database transaction. Each save commits on its own, as it already did in the app's sign-in.
- **Related:** 0117 (found there, left unchanged there) · the passkey steps, which were written without a transaction
  for this same reason.

## Context

- Both methods carried `@jakarta.transaction.Transactional`. A wrong guess saved the counter (and, at the limit, the
  lock), then threw the refusal (`ResponseStatusException`). The throw rolled the whole transaction back, save
  included.
- Measured on the test MySQL, 2026-09-19, and again as red tests on 2026-09-20:

  | What was done | Stored before the fix | Stored after |
  |---|---|---|
  | 3 wrong codes at `/v2/auth/admin-verify-otp` | `otp_attempts` = 0 | 3 |
  | 5 wrong codes, then the right code | 0, no lock; the right code **signs in** | 5, tier 2, locked 15 min; the right code gets **429** |
  | 3 wrong passwords at `/v2/auth/admin-login` | `failed_login_attempts` = 0 | 3 |
  | 5 wrong passwords, then the right password | 0, no lock; the right password **gets a code** | 5, locked 30 min; the right password gets **423** |
  | 11th code asked for in an hour | 429, but `otp_request_locked_until` not stored | 429, and the lock is stored |

- The red tests stop at the stored count; the two "before" answers to the right password and code follow from it,
  since no lock was ever stored.
- So the admin sign-in had no lockout and no security tiers at all: the password and the 6-digit code could be
  guessed without limit, only as fast as requests go.
- The refusals themselves were right the whole time (same status, same message), which is why nothing noticed.
- The 5th wrong password also sent the "account locked" email while the lock itself was rolled back.

## Every sign-in path checked

| Path | Counts a failure, then throws | In a transaction? | Bug? |
|---|---|---|---|
| `adminLogin` wrong password (`recordFailedLogin`) | yes | yes | **yes**, fixed |
| `adminLogin` code cap (`sendOtp`'s 429 that sets `otpRequestLockedUntil`) | yes | yes | **yes**, fixed |
| `adminVerifyLoginOtp` wrong code (`recordFailedOtpAttempt`) | yes | yes | **yes**, fixed |
| `login` (v1 + v2) wrong password, incl. a closed account's (`passwordOfClosedAccount`) | yes | no | no; test added as a guard |
| `login` → `sendOtp` for an unverified email | yes (cap) | no | no |
| `verifyOtp` (verify-email, verify-password-reset, v1 + v2) | yes | no | no; test added as a guard |
| `signup`, `resendOtp`, `forgotPassword` → `sendOtp` | yes (cap) | no | no |
| passkey steps (`requireAdminForPasskey`, `recordFailedAdminPasskey`, the registration code) | yes | no (0117) | no; covered by `AdminPasskeySignInTest` |
| `adminPasskeySignIn` | its refusals write nothing | yes | no |
| `socialLogin` | counts nothing | yes | no |
| `changePassword` wrong current password | counts nothing (no counter exists) | yes | no rollback bug; no counter either — noted, not changed |

No controller in the auth path is transactional, and `spring.jpa.open-in-view=false`, so nothing wraps these calls
from outside.

## Why this fix

- It is the pattern the code already trusts: `login` and `verifyOtp` have always run this way and their counters work,
  and 0117 wrote the passkey steps the same way on purpose.
- The success path does the same saves in the same order (`finalizeLogin`, then the session, then the context
  snapshot), exactly as `login` does. What a correct sign-in returns is unchanged, and the existing admin sign-in tests
  (`AnAdminPassComesOnlyFromTheAdminSignInTest`, `AdminPasskeySignInTest`) stay green.
- What is given up: the success path is no longer all-or-nothing. If the session insert failed after the code was used
  up, the admin would sign in again. That is already true of every app sign-in.

## Rejected

- **`@Transactional(dontRollbackOn = [ResponseStatusException::class])`.** One line, but it commits whatever the method
  had written before *any* refusal, not only the counter. A future refusal placed after a write on the success path
  would commit half a sign-in. The rule would live in an annotation parameter nobody reads.
- **Counting in a `REQUIRES_NEW` transaction.** `recordFailedLogin` and `recordFailedOtpAttempt` are private methods of
  the same class; called from inside it, they never pass through Spring's proxy, so the annotation would silently do
  nothing. Making it work means moving them to a new bean, and the outer transaction would still hold a stale copy of
  the same `users` row it then might save over. More moving parts for the same result.
- **Catching the refusal in the controller and saving there.** Splits one rule across two layers, and every new caller
  of the service would have to remember it.

## The passkey and the locks (the owner's choice, 2026-09-20)

Once the counts were kept, a new trade appeared: anyone who knows an admin's email can lock that admin out for 30
minutes with 5 wrong passwords. The owner asked (*"30m ka lock ip ki base per nhi rakh sakty tm?"*) for a lock per IP,
then for a machine that is never locked. He chose the passkey as that machine.

**Decided.**
- Wrong passwords (5 → the account locked 30 min) and wrong codes (5 → the code locked 15 min, then the tiers) are
  counted per account, as commit 1 made them.
- **A passkey that is already added signs in through both locks.** `requireAdminForPasskeySignIn` asks only that the
  account exists, is not suspended and is an ADMIN. The passkey keeps its own defences: a single-use challenge, user
  verification (Face ID or the device PIN) required, the signature counter, and the options' rate limit.
- A passkey sign-in leaves the password's count and lock as they were (`finalizeLogin(clearPasswordLock = false)`).
  It proves nothing about who typed the wrong passwords, so the password path stays locked until its 30 minutes end.
- **Adding a new passkey is still under both locks.** It needs a fresh emailed code (`requireAdminForPasskey`), so a
  locked code or a locked account refuses it. Only a passkey added before the lock escapes it.
- A passkey whose signature fails is still counted as a wrong code (0117). It feeds the code's lock, never the
  passkey's own sign-in.

**Rejected.**
- **One account-wide lock that holds the passkey too** (commit 1 as first built). A stranger with the email locks the
  owner out of every door for 30 minutes.
- **A lock per client IP.** The IP cannot be trusted today. nginx on the VPS has `set_real_ip_from 0.0.0.0/0` with the
  default `real_ip_header X-Real-IP`, so it takes whatever `X-Real-IP` a caller sends as the client, and passes it on in
  `X-Real-IP` and `X-Forwarded-For`. Proven on 2026-09-19: a request to `stage.invotick.com` carrying
  `X-Real-IP: 203.0.113.77` was logged by nginx as coming from `203.0.113.77`. A caller that skips Vercel could take 5
  guesses per invented IP without end, or lock the owner's own IP by naming it.
- **An IP whitelist.** Mobile networks share one public IP between many people (CGNAT) and change it often, so a
  whitelisted IP both lets strangers in and drops the owner when his phone moves. It would also rest on the same
  spoofable header.

**Open finding, for a separate task.** Every client IP the backend reads is spoofable today: the passkey options'
per-IP rate limit, `admin_passkey_challenges.client_ip`, `users.last_login_ip`, and the IP records. Nothing new may be
decided on that header. Another agent is building one trusted resolver (`ClientIp`), which trusts a forwarded IP only
from the panel with a shared secret.

## What a real user could notice

- **Admins only.** App users are unaffected: their sign-ins were already counted.
- An admin who types the password wrong 5 times is now locked out of the password for 30 minutes. The lock is on the
  account, so it holds at the app's login too, and the "account locked" email now means what it says. A passkey added
  before still signs in.
- 5 wrong codes lock the emailed code (not the passkey's sign-in, but adding a new passkey) for 15 minutes, and raise the account's
  security tier: the count is kept until a correct code, so the next lock comes at 10 wrong codes in total and lasts 60 minutes. The tier is not lowered by a correct
  sign-in (unchanged rule).
- Anyone who knows an admin's email can still lock the password and the code for 30 / 15 minutes. With a passkey
  added, that no longer keeps the owner out. Without one, it does.
- Parallel wrong guesses can still undercount a little (two requests read the same count and both write +1). That is
  also unchanged from the app's login; a database-side increment would close it and is not part of this fix.
