# 0219 — Linking a social login to an unverified account ends the old password

- **Date:** 2026-10-15
- **Status:** decided by the owner (2026-10-15); built, **not deployed**. The cleanup ships in `dry-run`; `on` only on
  the owner's word.
- **Tier 1** (auth / identity). Security audit 2026-10-15, finding **F-AUTH-SOCIAL-TAKEOVER**.
- **Related:** 0053 (a guest's work joins an account only with proof), 0099 (a password or Google proves the account),
  0111 (an account can be deleted; the erase), 0113 (Sign in with Apple), 0118 (wrong sign-ins counted; `verifyOtp`
  has no transaction on purpose), 0217 / 0218 (the rest of the audit).

## The problem, in three lines

1. Zaid signs up with **Bakar's** address `bakar@gmail.com` and a password of his own, and never types the code.
2. Later Bakar signs in with Google. The server finds the address, links Google onto Zaid's shell and marks it verified.
3. Zaid's password now opens Bakar's account and every invoice, client and payment Bakar puts in it.

Where (on `stage` 24f836a): `AuthService.signup` stores the hash while unverified; `resolveOrCreateSocialUser`'s
email-match branch links and verifies; `login` refuses only an **unverified** account, so the link unlocked the old
password. Nothing reset the password, revoked a pass or removed an earlier link.

## Decision

**1. A provider vouching for an account that was never verified ends what the sign-up left, before it links.** In
`resolveOrCreateSocialUser` (Google and Apple alike), only when `isEmailVerified` is false:

- the password hash becomes BCrypt of 256 random bits (two `UUID`s): nobody knows it, Zaid included;
- `passwordChangedAt = now`;
- every pass the server lists for the account is revoked (`revoked_tokens`, `LOGOUT_ALL`) and its session closed —
  per row, not by the bulk update, so the same code runs inside `socialLogin`'s transaction and in `verifyOtp`;
- every Google or Apple link the account already had is deleted (an unvouched provider can only have **made** the
  account, never linked onto it, so such a link proves nothing about the address);
- the push tokens and any waiting email change are cleared (they were the signer-up's phone and request).

Then the provider is linked and the address marked verified, as before. The account id and its data stay.

**2. A verified account is not touched.** Its password, passes, links and phones stay exactly as they were.

**3. The other road with the same shape is closed the same way.** A **password-reset code** on an account never verified
(`verifyOtp`, `PASSWORD_RESET`) runs the same function before it marks the address proven. Before 0219 the reset that
follows replaced the password, but a user who stopped after typing the code left Zaid's password working on a now
verified account. A **sign-up's own code** (`EMAIL_VERIFICATION`) keeps the password: the person who typed it is the
person who set it.

Roads read and found safe: `EmailChangeService.confirmChange` (the signed-in owner proves the **new** address; one
another account holds is refused); a guest's made-up address; a brand-new social account (no earlier password).
`EveryRoadThatProvesAnAddressIsKnownTest` lists every place that marks an address proven or makes a link, so a new one
fails the build until it is read.

**4. Unfinished sign-ups are removed — dry-run first.** `UnfinishedSignUpCleanup`, daily 04:20 UTC (it refuses the
02:00 hour, the backups'). An account is removed only when **all** hold: `role = USER`, never verified, not closed,
made more than 30 days ago, no code asked for in those 30 days, never signed in, and **no row anywhere** under its id
(every account column the erase knows, less analytics traces anybody can post under any id, plus `upgraded_to_user_id`,
`shared_invoice.decided_by_user_id`, `purchase_charge.user_id`, `user_revenue_day.earned_as_user_id`). It is removed by
the **same erase** as a closed account (`ClosedAccountEraser.eraseAccountWhile`, its one road), never a delete of its
own, and the conditions are asked again before every step.

- `auth.unverified-cleanup.mode` = `off` | **`dry-run`** (default: counts and logs, removes nothing) | `on`.
  An unknown word reads as `dry-run`.
- Bounded: `users` walked by `created_at` from the oldest, a page of 200 with a cursor, at most 2,000 rows a run; the
  data question asked once per column per page; at most 50 accounts and 20,000 rows erased a run.
- Seen on the Health Centre card **Unfinished sign-ups** (never red; amber for a failed or half-finished run) and the
  counter `invotick.auth.unverified_cleanup.accounts{mode,outcome}`.

**5. The user sees nothing new.** No message, no screen, no app change; old builds work as before. A real user who signed
up, never typed the code and later used Google simply gets in, as before; their password is now random, and Forgot
password sets a new one.

## Rejected

- **Never link; make a new account instead** (or refuse the sign-in). The real owner of the address would end up with
  two accounts, or locked out of the address, and the one holding their name would be the stranger's. Worse for G3.
- **Log only** (detect, alert, change nothing). The password keeps working; a log line is not a fix.
- **Verify the address at sign-up** (no account until the code is typed). It closes the shell at the root, but changes
  the sign-up funnel (G1) and the app's flow: a separate decision, not part of this fix.
- **Delete unfinished sign-ups at once, or with no dry-run.** An erase cannot be undone; the owner reads the count first.
- **Reuse the old `UserRepository.deleteUnverifiedUsers`.** A bulk JPQL delete that ignores data, foreign keys and
  images: a second delete road. It has no caller; left in place, not used.
- **Kill tokens by comparing `passwordChangedAt` with the token's issue time.** Nothing reads that column today; it would
  mean changing the JWT filter, which other work is changing. Revoking the listed passes is the road reset and
  change-password already take.

## What remains

- **A drain pass** (push-only, 72 h, never listed as a session) on a shell is not revoked. A password sign-up's shell
  never has one (it cannot sign in); only a shell made by an Apple sign-in whose address Apple did not vouch for could.
- The `dry-run` count decides when to switch the cleanup `on` (the owner's word).
- Verify-at-sign-up, if wanted, is its own decision (G1 impact).
- When 0217 (`uploaded_file`) or 0218 (`guest_secrets`, `guest_secret_observations`) merge, any new account column must
  be listed by the erase and by the cleanup; the two schema tests fail until it is.

## Where

Backend `fix/social-login-unverified-takeover` (off `stage` 24f836a): `5d1f5f8` (the sign-in fix, its tests and the
road guard), `22788a7` (the cleanup, the erase's parameter, the Health Centre card, its tests). No migration. **Gradle not run, not pushed, not
deployed.**
