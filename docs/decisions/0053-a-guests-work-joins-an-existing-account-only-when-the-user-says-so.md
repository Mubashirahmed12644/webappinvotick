# 0053 — A guest's work joins an existing account only when the user says so

**Status:** decided. The owner, 2026-09-11: sign-up moves the guest's work as before, and sign-in to
an existing account asks once — *"(a) ek dafa poocha jaye"*, *"agree poochna chahye"*.
**Date:** 2026-09-11.
**Building from 2026-09-13, into 1.4.6.** The owner: every change goes into 1.4.6 until they say release. The sync
agent is building it on `feat/guest-work-moves-in-one-step` (backend) and `feat/146-guest-work-moves-in-one-step`
(app).
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
