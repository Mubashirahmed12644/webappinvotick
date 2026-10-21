# 0218 — A guest proves it is the guest; the server observes first

- **Date:** 2026-10-15
- **Status:** decided by the owner (the design, 2026-10-15); Phase 1 built, **not deployed, not released**. Phases 2
  and 3 are described here and switched on only on the owner's word.
- **Tier 1** (identity; a guest's only copy of their work). Security audit 2026-10-15, finding **F3**.
- **Related:** 0053 (guest work joins an account only with proof), 0065 (a failed guest sign-in carries its evidence),
  0099 / rule 28 (a removed phone gets no pass), 0144 (a reinstalled phone's returning guest), 0145 (a phone linked to
  a guest by QR is a guest), 0146 (accounts on one phone, the vault), 0217 (security batch 1: F1, F2, F5).

## The owner's design (2026-10-15)

The app goes first. The server only **observes** at first (shadow), and tightens later, after bug-testing. A Health
Centre observer must show whether tightening would affect **any real user**, and tightening is switched on only on
his explicit word. High security **and** no inconvenience for the user.

## The problem

- About **96.6 %** of users are guests. A guest has no password: until now its id was its whole credential.
- `POST /v1|v2/auth/login-as-guest {"id": "<uuid>"}` with nothing else returns a **90-day GUEST pass** (proven
  dynamically on a local copy in the audit). The only extra check, the removed-phone refusal, runs only when the call
  names its phone.
- Any authenticated call that sends `X-Device-Id: <anything>` writes a `linked_device` row for the caller
  (`JwtAuthenticationFilter`), and `POST /v2/guest-work` accepted that row as proof (`GuestWorkClaim`).
- So the chain is: learn a guest's id → `login-as-guest` → one call with `X-Device-Id: P` → sign in to one's own
  account → `POST /v2/guest-work {guestId, MOVE}` with `X-Device-Id: P` → **the guest's whole work moves into the
  attacker's account**, in one transaction, permanently. An old build's push (`OldBuildGuestClaim`) is a second road
  to the same move.
- Guest ids are not secret: they leaked through F1 (being fixed in 0217), the pull answers (`BusinessResponse.userId`),
  logs and the panel. Share links do not leak them.
- No abuse is known: every guest-work migration from August (10/10) and September (43/43) came from the guest's own
  phone (sync agent rule 11). The hole is real all the same.

## Decision — Phase 1 (built)

**1. The secret.** The server mints 256 random bits (43 URL-safe characters) and hands them out **once**, in the
`guestSecret` field of the answer. It stores only the SHA-256 (`guest_secrets`, one row per guest) and compares in
constant time (`MessageDigest.isEqual`). The phone keeps it per guest id in the vault the passes already use (0146:
Android Keystore file excluded from backup, iOS Keychain "this device only") and sends it as `X-Guest-Secret` on
`login-as-guest` and on `POST /v2/guest-work`. The header says one of four things:

| `X-Guest-Secret` | Meaning |
|---|---|
| the secret | the phone holds it |
| `none` | a build that sends secrets, holding none for this guest |
| `unreadable` | a build that sends secrets, whose vault could not be read |
| absent | a build from before 0218 |

**2. Who is handed one** — never a stranger first:

- a **brand-new** guest (this call creates it): yes, if the build sends the header; an old build would throw it away;
- an **existing** guest: only on a **proven phone**. A `linked_device` row counts as proof only when it was first seen
  **before 2026-10-15** (the day the hole was found) or **within 24 h of the guest's creation** (the phone that makes a
  guest syncs within minutes; nobody else can know a random id that early). A row anybody made today is not proof.
  Otherwise nothing is handed out and the call is counted `NOT_MINTED_UNPROVEN`.
- A guest that signed in before 0218 would not call `login-as-guest` again for up to 90 days, so the app asks
  `POST /v2/auth/guest-secret` once per start (guests only). It is a question, never a gate.

**3. The switch** — `auth.guest-secret.mode`, read on every request, default **`shadow`**:

| Mode | Sign-in | Guest-work MOVE and an old build's push move |
|---|---|---|
| `off` | as before 0218; nothing observed or handed out | as before |
| `shadow` (Phase 1) | counted, **never refused** | counted, **never refused** |
| `enforce-move` (Phase 2) | as shadow | needs the guest's secret **or** the guest's own proven phone; else 409 `NO_PROOF` |
| `enforce-all` (Phase 3) | needs the secret, with the soft-fail ladder below | as enforce-move |

A misspelt value reads as `shadow`. **The kill switch** is this property: set `auth.guest-secret.mode=shadow` (or
`off`) in the server's `.env.prod` and restart the backend container (about 40 s). No release, no build.

**4. The soft-fail ladder (enforce-all only).** A real user is never locked out:

1. the right secret → in, from any phone;
2. a brand-new guest → in;
3. no secret or a wrong one, **on the guest's own proven phone** → in, once per call, and handed a fresh secret
   (`SECRET_RECOVERED`); an old build on its own phone is let in and given nothing it cannot keep;
4. no secret and not the guest's phone → **403** "This phone could not prove it is this guest's." (never 401, which
   sends every build round its re-sign-in loop);
5. limits: past 10 refusals per guest or 30 per address in an hour a refusal becomes **429**; at most 10 recoveries
   per guest per day. The right secret is never counted or slowed, so nobody can lock a guest out by hammering its id.

A database fault while judging **fails open** in every mode: our fault must never become a guest locked out.

**5. The observer.** Every judged call is one bucket — `SECRET_OK`, `SECRET_WRONG_KNOWN_DEVICE`,
`SECRET_WRONG_UNKNOWN_DEVICE`, `NO_SECRET_OLD_BUILD`, `NO_SECRET_NEW_BUILD`, `NO_SECRET_NEVER_MINTED` (move only),
`MINTED`, `NOT_MINTED_UNPROVEN`, `SECRET_RECOVERED` — with whether the phone was proven and whether the strict rule
would refuse it. Stored in `guest_secret_observations`, one row per day, route (`login`, `check`, `move`, `push`),
outcome and guest, so a restart forgets nothing and the card can count **people**, not requests; purged after 35 days.
Also Micrometer `guest_secret_outcomes_total` for Grafana. A table, not only a counter, because a counter restarts at
every deploy and the gate needs 14 unbroken days per guest.

**6. The Health Centre card `guest-secret-readiness`** ("Guest secret — safe to tighten?"), a `HealthCheck`, no page:

- per bucket: guests in the last 1, 7 and 14 days, calls in 14, how many on a proven phone;
- active guests in 14 days, how many hold a secret, how many were seen with it;
- how many guests enforce-move, and enforce-all, **would have refused** in 14 days;
- **green** while collecting; **amber only** for a bug signal in 7 days (`NO_SECRET_NEW_BUILD`, or an unexplained
  `SECRET_WRONG_KNOWN_DEVICE`); **never red**;
- **SAFE TO TIGHTEN** only when all hold, otherwise it names the first that does not:
  1. at least 14 days of observations;
  2. no `NO_SECRET_NEW_BUILD` in 14 days;
  3. no `SECRET_WRONG_KNOWN_DEVICE` in 14 days, unless the owner looked at that guest and listed it in
     `auth.guest-secret.readiness.explained-guests`;
  4. at least 90 % of guests active in 14 days seen with their secret (`SECRET_OK`);
  5. nobody would have been refused a move in 14 days.
- Our own accounts are set aside (`health.our-own.account-ids`).

**7. No new analytics event.** The server sees every call and the header itself says present / none / unreadable,
so an app-side event would only repeat it on a channel that loses rows (the version floor, the offline queue).

## Phases 2 and 3 (not built as switches; the code is there, OFF)

- **Phase 2 — `enforce-move`.** When the card says SAFE TO TIGHTEN and the owner says so. Smallest blast radius,
  highest value: it closes the whole takeover chain above, because a forged `linked_device` row is never a proven
  phone. A real user on their own phone moves their work whatever their build.
- **Phase 3 — `enforce-all`.** After Phase 2 has run quietly and the enforce-all count on the card is understood.
  **Prerequisites before switching it on** (each would otherwise refuse a real person; the card will show them):
  - a phone joined to a guest by QR (0145) and a reinstalled phone returning as a guest (0144) must be handed a secret
    at that moment: their phone rows are newer than the guest by days, so they are not "proven";
  - a guest on two phones holds one secret between them; the second phone's `NO_SECRET_NEW_BUILD` /
    `SECRET_WRONG_KNOWN_DEVICE` blocks the verdict. The fix, if the numbers show it matters, is one secret per phone
    (the hash on the `linked_device` row) — a schema change for the owner.

## The attack window for existing guests

- **Today (before deploy):** a stranger with a guest's id gets a session and can move the guest's work. Nothing here
  changes that until Phase 2.
- **Phase 1 (shadow):** still open, by design — shadow refuses nothing. What changes: a stranger can no longer be the
  first to be **handed** an existing guest's secret, because his phone row is newer than 2026-10-15 and newer than the
  guest by more than a day. Every attempt is counted (`NOT_MINTED_UNPROVEN`, `SECRET_WRONG_UNKNOWN_DEVICE`, `move`
  with would-refuse) and visible on the card.
- **Phase 2:** the move is closed for everyone, old builds included: a move needs the secret or a phone proven before
  the hole was found (or within a day of the guest's creation). A stranger can still sign in as a guest and read its
  data through the pull until Phase 3.
- **Phase 3:** the sign-in is closed. What remains: somebody who knows **both** a guest's id **and** its real phone's
  device id can use the ladder (step 3). Device ids are far less exposed than user ids; the ladder's daily cap bounds
  it, and the observer shows it as `SECRET_RECOVERED` on a guest that also has `SECRET_OK`.

## Rejected

- **Enforce immediately.** Every guest on a build before 0218 (all of them today) would be refused its next sign-in
  and every sign-up's move: 96.6 % of users, the worst possible outcome.
- **Kill old builds** (a version floor on sign-in). Locks out every guest who has not updated; most never do quickly.
  The ladder lets an old build on its own phone in.
- **Bind the guest to a phone number or an email.** A guest is by definition someone who gave neither; asking would
  be a sign-up wall in front of G1.
- **Client-side only** (the app checks something itself). The attacker does not use our app; only the server can refuse.
- **Mint to any phone that has a `linked_device` row.** That row is exactly what the attacker can make; the first to
  ask would own the secret and the real phone would be the one locked out.
- **Re-mint on every wrong secret in shadow.** Two phones of one guest would take the secret from each other on every
  start; a wrong secret on a proven phone is the bug signal the observer exists to show. Only enforce-all's ladder
  replaces a wrong one.
- **A column on `users`.** `User` is a data class whose `toString` prints every field into logs, and `users` is read
  on every request. A 1:1 table keeps the hash out of both, and plain SQL (no JPA entity) means a jar that meets a
  schema without the tables still boots.
- **A new analytics event** for "secret present". The server already classifies every call.
- **A Remote Config switch in the app.** The app changes nothing a user sees and tolerates any answer; the server's
  mode is the switch.

## Deploy order (on the owner's word)

1. **SQL first, alone:** `V20261015_02__guest_secrets.sql` (two empty tables). Flyway out-of-order is off, so
   **`V20261015_01` (0217's `uploaded_file`) must be applied before or together with it, never after.**
2. **Backend code** (`feat/guest-secret-shadow`), mode `shadow`. From here the server hands secrets out only to builds
   that ask, and refuses nothing.
3. **App release** with the phone half. Day 1 of the card is the day the first release phone checks in.
4. Phase 2 and 3: a one-line property change each, on the owner's word, after the card.

## What remains

- Phase 3 prerequisites above (QR join and returning guest hand over a secret; multi-phone guests).
- The Android Ktor log runs at `LogLevel.ALL` in release and writes response bodies to logcat (the 90-day pass
  included, already today). The new header is sanitized; the body is not. Separate fix.
- A closed account's eraser does not delete `guest_secrets` rows of its retired guests; such a hash opens nothing (its
  user row is gone). Add an erase step when the eraser is next touched.
- The web share page and browsers joined to a guest by QR (0145) never call `login-as-guest`; unaffected.

## Built (2026-10-15; Gradle not run by the agent, nothing pushed, deployed or released)

- Backend `invotick-apis` branch `feat/guest-secret-shadow` (worktree `kaam/worktrees/invotick-apis-guestsecret`):
  `e99be0d` migration alone, `bb82cbc` code and tests.
- App `invoice-kmp-app` branch `fix/153-sync-defects`: `55c215fb8`.
