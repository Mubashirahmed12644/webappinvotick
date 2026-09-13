# 0053 — A guest's work joins an existing account only when the user says so

**Status:** decided. The owner, 2026-09-11: sign-up moves the guest's work as before, and sign-in to
an existing account asks once — *"(a) ek dafa poocha jaye"*, *"agree poochna chahye"*.
**Date:** 2026-09-11.
**Backend live 2026-09-13 15:23 UTC** (batch7 `5e6a46e7`). The app half is in 1.4.6 on `VC_102_VN_146`, not
released. The owner: every change goes into 1.4.6 until they say release.
**The rows already left behind** (32 guests with proof, 3 documents and 185 rows) move through this same one-step
path once it exists, after the owner sees the exact counts (the owner, 2026-09-13).
**Related:** 0028 (the Invotick ID is part of the account), 0051 (the sync agent owns this), the sync
audit's class O.

## What was true on 2026-09-11

- **The app moves without asking, on every path.** Login, OTP and register all call
  `GuestDataManager.transferGuestData`, then show a merge notice.
- **The server re-owns records one at a time.** Each record moves as it is pushed:
  `SyncOwnershipGuard` allows the move for any guest-owned record and any USER caller.
- **The results were inconsistent.**
  - The Pixel's guest data (the "Test" business and 2 invoices) stayed behind after a sign-in.
  - 4 of the 42 guests who signed up in 90 days left invoices behind.
  - 26 records were moved while their push was refused.
  - 90 days: 3,153 guests, 65 upgraded (42 sign-ups, 23 into older accounts).
- **The move was open to anyone.** Any account holder who knows a guest record's id can move it to
  their own account, and `/v2/shared-invoice/*` returns that id publicly. This is being proven on
  `fix/a-guest-record-moves-only-with-proof`.

## Decision

1. **Sign-up:** the guest's work moves to the new account without a question. It is the same person
   continuing.
2. **Sign-in to an existing account,** when the guest did real work (at least one invoice, estimate or
   client): ask once, "join this work to your account?" Yes moves everything; No leaves it. If there
   is no real work, there is no question.
3. **The move is one server step, all or nothing,** made only with proof that this phone held that
   guest. The sync guard stops moving records one at a time.
4. **Declined work** leaves the phone's view and stays on the server under the guest for 90 days, so
   support can recover it. After that it is purged. 90 days was the recommendation; the owner has not
   named another number.
5. **Businesses are never merged by name.** A guest's business joins as a business of its own, its
   invoices keep their own number series, and the account keeps its own Invotick ID.
6. **The 26 records already moved by the old path stay where they are.** The owner's reason: asking
   users about it now would be strange.

## Rejected

- **Always merging silently on sign-in.** On a shared phone it puts someone else's work into your
  account.
- **Never merging.** It looks like data loss — the fastest way to lose a user's trust (G3).
- **Merging businesses by name.** Two "My Business" entries may be two different firms, with
  different addresses and taxes.
- **The record-by-record move in sync.** It is the cause of the partial merges, of class H, and of the
  takeover risk.

## Consequences

- **App:** one question after sign-in when there is real guest work; sign-up is unchanged. Ships in
  the release after 1.4.5.
- **Server:** a claim step that verifies possession of the guest and moves all of its records in one
  transaction. The guard's migration branch goes.
- The 90-day purge of declined guest work needs a job and a Health Centre line.

## Built, 2026-09-13 (backend deployed 15:23 UTC as `5e6a46e7`; the app is in 1.4.6, not released)

Backend `feat/guest-work-moves-in-one-step` (`25a172a` → `6ee2b09`, on stage `42faec8`; suite 773/773). App
`feat/146-guest-work-moves-in-one-step` (`b76b733f`, `3b281f89`, on `VC_102_VN_146` `b9669f53`;
`:data:testDebugUnitTest` 243/243). No migration; no Room schema change.

The owner, 2026-09-13: all work goes into 1.4.6 until they say "release". Also R1, the same day: the 32
guests' left-behind rows move into their accounts through this claim, after the owner's go on the dry
run's exact counts.

### What the data said first (read-only, 2026-09-13)

- **Phones that were a guest and then signed in** (`linked_device`, from 2026-07-20), by ISO week:

  | Week | Sign-ups | of them left real work behind | Sign-ins to an existing account |
  |---|---|---|---|
  | w35 (Aug 24–30) | 6 (vc ≤ 94) | 1 | 3 |
  | w36 (Aug 31–Sep 6) | 18 (17 vc ≤ 94, 1 vc 95–97) | 0 | 4 |
  | w37 (Sep 7–13) | 39 (35 vc 95–97, 4 vc 98–101) | 6 (3 of them a document), all 1.4.4 | 2 |

  Sign-up = the account was created within a day before that phone first used it, and no other phone
  used it earlier. Real work = a live invoice, estimate or client still under the guest now.
  Release events agree on the trend: `register_success` 9 → 11, `login_success` 17 → 25 (w36 → w37).
- **What a repair would move (R1)**: 77 retired guests have a phone linked to both them and their account;
  49 of them still own 202 rows (191 live) — 38 of those are share links. In the 21 synced tables alone:
  38 guests, 164 rows, 153 live. 3 live documents, the three sign-ups of 2026-09-11/12.

### What was built

- **The claim (server, `GuestWorkClaim`).** Every row the guest owns — the 21 synced tables and
  `shared_invoice` — changes owner in one transaction; the guest's row is locked first; the guest is
  retired in the same transaction (the Invotick ID moves only to an account that has none, so an existing
  account keeps its own). A move changes `user_id` and `last_synced_at` only: the content, the phone's time
  (`updated_at`) and the number (`version`) stay, and the account's other phones pull the rows.
- **The proof** is rule 11's, unchanged: a non-zero `X-Device-Id` that `linked_device` records for the
  guest. The all-zero iOS id proves nothing. A guest the server holds nothing of needs no proof (nothing
  to protect), and is then not retired.
- **Idempotent.** A second claim finds nothing left and answers `NOTHING_TO_MOVE`; a guest already retired
  to this account is swept again (stragglers, and R1's leftovers); a guest retired to another account is
  refused.
- **`POST /v2/guest-work`** (a registered account only): `MOVE` or `KEEP_APART`. A refusal answers 409 —
  `NO_PROOF`, `JOINED_ANOTHER_ACCOUNT`, `NOT_A_GUEST`, `NOT_AN_ACCOUNT` — never 401, which every build reads
  as "sign out". A "no" is proof-checked like a move and moves nothing; it answers `recorded: false`.
- **Builds that never ask (up to 1.4.5)** keep signing up as they do: they re-own the work on the phone and
  push it again. The server now answers that push with the whole claim, at the start of the push, inside
  its transaction, before any record is judged — only for an unretired guest the phone held and the push
  names. Chosen over keeping the record-by-record move for them: their phone has already merged, so a
  refusal would split phone and server, and the record-by-record move is exactly what left 3 of 15 sign-ups
  with a document behind. A 1.4.6 push of a guest's records is refused whole.
- **The guard's record-by-record move is gone.** A record still owned by a guest is refused whatever the
  phone (logged `reason=GuestWorkNotClaimed`).
- **Sign-up or sign-in:** the auth answer now says `newAccount`. Google's button signs in and signs up alike,
  so only the server can tell.
- **The app (1.4.6).** A sign-up moves the work without a question: it joins the account on the phone at
  once (nothing queued again, no time touched), the claim follows, and the account's pushes wait until the
  server confirms. A sign-in to an existing account with real work (an invoice, an estimate or a client)
  asks once, over every screen, until answered: yes is the same move; no leaves the rows under the guest,
  out of the account's lists, sends the guest's unsent work under the guest's own token while this process
  still holds it, and tells the server — again at each start until the server stores it. No real work: no
  question, nothing moves. A server without the route (404) gets the work the way 1.4.5 sent it.
- **iOS** sends one id per install (kept in `NSUserDefaults`, first taken from `identifierForVendor`), never
  the zeros. A guest's first sync from that build records the proof its later sign-up needs.
- **Evidence:** a refused claim is `sync_failed stage=guest_claim`, with `request_id`, `http_status`,
  `error_type` (the server's refusal, or `HTTP_<n>`) and `exception_class`. Counter
  `guest_work_claims_total{path, outcome, dry_run}` on the server.
- **The repair (R1):** `POST /v1/webpanel/guest-work/repair`, admins only, a dry run unless the body says
  `"dryRun": false`, per guest and per table, one transaction per guest, proof = a phone linked to both.
  Never run against production without the owner's go on the dry run's exact counts.
  - **Ran 2026-09-13 21:05 UTC,** on the owner's go after the dry run of ~20:08 UTC gave the same counts:
    - 50 guests moved, 216 rows;
    - 1 refused `NOT_AN_ACCOUNT` (`cd153624`, which had been retired into a guest).
  - A second dry run straight after found nothing left to move.
  - A read-only SQL recount agrees: 1 guest with proof still owns rows, and it is the refused one.

### Rejected while building

- **Keeping the record-by-record move for old builds** — see above.
- **A decline marker made of existing columns** (`is_active`, `deleted_at` without `is_deleted`, or a revoked
  `linked_device` row). Each is ambiguous: 35 retired guests already hold rows from partial moves, and an
  owner can revoke a device. A purge deletes data, so it must key on an explicit, recorded "no".
- **Hiding the work on the phone until the server confirms a move.** Offline, the user's work would vanish
  after a sign-up. It shows at once instead, and the pushes wait.
- **Proof by the guest's own sign-in token.** Stronger than a device id, and it would cover iOS guests from
  before the id fix; but it is not rule 11's proof. Left as a question.

### Not built: the 90-day keep

It needs a table, and a migration is the owner's call (the SQL is in the report of 2026-09-13). The design:
one row per "no" (guest, account, phone, the phone's decision time, `purge_after` = +90 days, `purged_at`);
a daily job hard-deletes a declined guest's rows once `purge_after` passes, children first, one transaction
per guest, and only while the guest is still unclaimed; a Health Centre check shows the guests kept apart,
the purges due in 7 days, the purges done in 30 days and any that failed. A hard delete of synced rows makes
`NOT_FOUND` ambiguous, so 0059 is amended first (rule 13).
