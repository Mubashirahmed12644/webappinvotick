# 0117 — The admin panel signs in with a passkey

- **Date:** 2026-09-19
- **Status:** decided by the owner on 2026-09-19: *"Haan, passkey banao"*, and for the table: *"Db ki table bhi bana
  do"*. Built on branches. Not merged, not deployed.
  - Backend migration `feat/admin-passkey-table` `9060070`: `V20260919_01__admin_passkeys.sql`, alone.
  - Backend code `feat/admin-passkey` `6739e08`, on top of the migration. `AdminPasskeySignInTest` 17/17. Full suite
    1181/1181, including `SpringContextBootTest`, `MigrationsApplyToLiveSchemaTest` and `RoutesDeclareWhoMayCallThemTest`.
  - Panel `feat/admin-passkey` `081a85a`. tsc is clean and `next build` is green.
- **Decision:** the panel can be signed in to with a passkey: email and Face ID, with no inbox. The server answers the
  same admin pass as the emailed code. The password and emailed code stay as they are, as the fallback.
- **Related:** the admin-sign-in pass (`AdminSignIn`, 2026-09-14) · deny-by-default (`PublicRoutes`) · storage, not RAM
  (standing rule, 2026-09-13) · schema and code ship apart (`deploy-safety-schema-changes`).

## Context

- On his iPhone the owner kept being asked for the emailed code.
- Production, read-only: 5 ADMIN sessions were created in 14 days (09-07, 09-14, 09-15, 09-18 twice).
  - All are still active, with 89 days left.
  - So the server is not signing him out. The phone's browser loses the pass it stored (`localStorage`).
- Each sign-in again means the password plus a trip to the inbox.

## Decided

**Signing in (public).**
- `POST /v2/auth/admin-passkey/sign-in/options` and `/verify`. Both are on the reviewed public list, with reasons.
- Options gives the same answer for every email. It lists no passkeys (no `allowCredentials`), so it cannot show
  which emails have a passkey.
- A typed email only limits which account `/verify` will accept. With no email, the passkey names the account.
- `/verify` checks with Yubico's `webauthn-server-core` 2.9.0:
  - the challenge, the origin and the RP id;
  - user verification is REQUIRED (Face ID, a fingerprint or the device PIN; never a tap alone);
  - the signature counter (a counter that goes backwards is a copied key, and is refused).
- Then the account must be an active ADMIN, and its emailed-code lock must be off.
- The pass comes from `AuthService.adminPasskeySignIn`, through `finalizeLogin` and
  `buildAuthResponse(adminSignIn = true)`. It is the same pass as the emailed code's, so nothing downstream changes.
- RP id `admin.invotick.com`, origin `https://admin.invotick.com`. Both are set in properties, and the local profile
  uses `localhost` / `http://localhost:3000`.
  - A wildcard origin stops the service from starting.
  - Vercel preview URLs cannot use passkeys.

**Adding a passkey needs a fresh emailed code.**
- The route is `@RequireRole(ADMIN)`, so only an admin-sign-in pass may call it. On top of that it asks for a new
  emailed code: the admin sign-in's own code, limits and expiry.
- Why: a pass stolen from the browser must not be able to plant a passkey of its own. A passkey outlives every
  sign-out.
- The cost: one trip to the inbox per device, once.
- The code limit wants 1 minute between codes. Right after an email-code sign-in, the panel may say "please wait N
  seconds".
- Up to 10 passkeys per admin. The list shows name, created and last login. Remove is a soft delete.

**Limits and the lock.**
- Sign-in options are limited to 10 per IP and 300 in total per 5 minutes.
  - The total is the hard cap on what strangers can write. At worst it stops passkey sign-in for a few minutes, and
    the emailed code still works.
- A challenge is used by the step that takes it, before anything is checked. So each attempt needs new options, and
  the options limit bounds the attempts.
- A failed signature from a known passkey counts against its account, as a wrong code does
  (`recordFailedOtpAttempt`). The same lock stops both ways in.
- Log lines follow the existing `[AUTH] [SERVICE] …` style: the challenge id, the passkey id and the first 6
  characters of a credential id. A challenge or a credential is never logged whole.

**Storage (not RAM).**
- `admin_passkeys` has one row per passkey: the public key, the counter, the name and the times. Rows are soft
  deleted.
  - `ClosedAccountEraser` erases them together with their account.
  - They are not guest work.
- `admin_passkey_challenges` has one row per challenge.
  - Each challenge is single-use (one conditional UPDATE) and lives 5 minutes.
  - A purge deletes it an hour after it expires, every 15 minutes. The table holds a few rows, and about 4,000 at
    most.
  - `ClosedAccountEraser` lists this table as kept, with a reason.
- The migration is on its own branch. It creates two tables and touches nothing that already exists.

## Rejected

- **A "remember this device" cookie, or a longer pass.** Neither fixes the cause: the phone's browser drops what it
  stored. A longer pass is also a bigger prize if it is stolen. The pass already lasts 90 days.
- **Turning the emailed code off** (`admin.login.otp-enabled=false`). That leaves only the password, for the account
  that can see every user.
- **Challenges in memory**, even a small bounded cache. They would be lost on every deploy between the two steps, and
  the standing rule says storage.
- **No new code to add a passkey, relying on a "recent sign-in".** A renewed pass keeps its old session, and an API
  token minted from the panel opens a brand-new one. So "recent" can be faked with a stolen pass.
- **webauthn4j.** It is maintained and capable. But its lower-level API would leave more of the checks to our code.
  Yubico's `RelyingParty` does the counter, UV, origin and challenge checks itself, and its request JSON can be stored
  and read back as it is.
- **A browser library such as `@simplewebauthn/browser`.** The byte conversion is about 40 lines, and the sign-in page
  gains no dependency.
- **Listing the account's passkeys in the options.** That would tell anyone which emails have a passkey.

## Found on the way — not changed here

- At `/v2/auth/admin-login` and `/v2/auth/admin-verify-otp`, the wrong-password and wrong-code counters are written
  inside `@Transactional`. The refusal then throws, and that rolls the counters back.
  - Measured on the test MySQL: 3 wrong codes left `otp_attempts` at 0, and 3 wrong passwords left
    `failed_login_attempts` at 0.
  - So the admin sign-in's lockout never sets. The passkey path writes its counters outside a transaction for this
    reason.
  - This was not fixed here, because the task said the password and code path must not change. It is the owner's
    call.

## Deploy order

1. `feat/admin-passkey-table` (the migration). The running jar maps neither table, so nothing changes.
2. `feat/admin-passkey` (backend code).
3. Panel `feat/admin-passkey`. Before step 2 its button only shows an error.

A share link, the app and every other route are untouched.
