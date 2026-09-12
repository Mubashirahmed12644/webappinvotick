# 0059 — A delete of a record the server does not hold is not a sync failure

**Status:** decided by the owner, 2026-09-11 list, sync decision 1 (recommended "yes"; "haan", and on
2026-09-12 "pending work start kro apni tarteeb sy").
- Server half built on backend branch `fix/benign-delete-not-found`:
  - `cc4ee5e` — the filing and the card;
  - `3d8d5b1` — the INFO logging.

  6 tests failed first; the full suite is 647/647 (baseline 641/641). Not pushed, not deployed.
- App half for 1.4.6: specified below, not built.

**Date:** 2026-09-12 · **Goal:** G3. A card that is red for a harmless reason cannot say when something
real breaks.
**Related:** [0029](0029-a-sync-failure-is-an-attempt-the-server-refused.md),
[0036](0036-a-delete-must-say-what-it-is-deleting.md),
[0042](0042-the-server-owns-the-version-and-the-device-merges.md),
[0050](0050-every-sync-failure-carries-its-own-evidence.md).

## What the data says (production, read-only, 2026-09-12)

- **1.4.5 sends deletes that 1.4.4 held back** (`6c3f4f62`: a delete goes by id when its local row is
  gone).
  - On their first push after the update, 3 of the 51 vc101 phones sent 17 deletes of invoice lines
    queued 0.9 to 119 days earlier.
  - None of the 17 ids is in `invoice_items`. The server answered NOT_FOUND to each.
  - The phone treats that answer as final (`NON_RETRYABLE` → `TERMINAL`) and reports
    `push_non_retryable` once.
- **The Device sync card counted them:** builds from 94, 7 days, CRITICAL at 10 devices.
  - The card was already CRITICAL for other causes: 431 devices, 65 signatures, worst
    `clients STALE_CONFLICT` (live read, 14:51 UTC).
  - The 5 devices with rows of this kind in the window all had other counted rows too, so this is not
    what made the card red. It would add one device for every phone that updates.
- **What NOT_FOUND on a delete means, from the code (`e14ba73`):**
  - Every sync delete finds its row with `findById` alone, and no entity carries a soft-delete filter.
    So a soft-deleted row is found and deleted again (SUCCESS), and another account's row is refused
    as OWNERSHIP_VIOLATION. NOT_FOUND therefore means that no row with that id exists at all.
  - No path removes a synced row, so the case "the record existed and is gone" cannot occur today.
    Across 478 Kotlin files:
    - the one `orphanRemoval` (`Invoice.items`) never fires, because `updateInvoice` only adds or
      updates lines;
    - `deleteUnverifiedUsers` has no caller;
    - no migration deletes rows;
    - no foreign key cascades.
- **The server can come to hold such a record later, when its create arrives after its own delete.**
  - Older builds, 30 days: 5 delete targets were answered NOT_FOUND, and 3 of them exist now.
  - All three are stored deleted, with the phone's own delete time: invoice `c999a168`, line
    `a6696108` and estimate `a976c26a`.
  - The invoice's trail:
    - its create was refused INVALID_REFERENCE at 13:48:09.117;
    - its delete was answered NOT_FOUND at .194;
    - its create was stored 18 s later, already deleted.
  - The user's delete held every time.
- **An UPDATE answered NOT_FOUND is a different thing:** that edit never arrived.
  - Production holds 3 of them: businesses on vc94, each an update that came before its create.
  - It shares the wire's error type, the service and the entity with the delete.
  - So on one phone the two shared one `sync_failure` row, whose `operation` stays its first
    occurrence's. A rule reading that column would hide the update whenever a delete came first.
- **13 of the 21 delete paths logged this answer at ERROR, with a stack trace.**
  - Grafana's "SyncV2 Hard Failure" rule pages Slack on a single ERROR line that contains `SYNC`
    (`for: 0s`).
  - But Loki has held no readable line since about 2026-09-10 23:58 UTC. promtail reports 423,437
    lines sent and 0 dropped in its 24 hours, and Loki has no series in 48 hours.
  - So today that rule, and the panel's server log lines, see nothing at all. That is a separate
    problem.

## Decided

1. **The device is told exactly what it was told before: NOT_FOUND.** Every build treats it as final.
   No wire change.
2. **The server files a delete answered NOT_FOUND as `NOT_FOUND_ON_DELETE`,** a signature of its own
   (`SyncFailureKeys.filedErrorType`).
   - The device's own report of that answer (0050's evidence, `op=DELETE`) is filed under the same
     name by the ingest, inside its SQL where the groups are formed. One refusal seen from both sides
     still lands under one signature.
   - An UPDATE answered NOT_FOUND keeps `NOT_FOUND` and is counted as before. The two never share a
     row again.
3. **The Device sync card does not count `NOT_FOUND_ON_DELETE`.** It shows it as a fact:
   "Ignored — a delete of a record the server does not hold: N devices, M occurrences".
   - Occurrences add both sides, as the card's own Occurrences line does.
   - The Sync Health drill-down lists these rows under their own signature.
4. **Every delete path logs this answer at INFO,** never as an ERROR line. Anything else a delete
   throws is logged exactly as before.
5. **The app half, for 1.4.6** (below). It stops the phone reporting the answer, and it stops a
   create being sent after its own delete.

## The app half, for 1.4.6 (anchors at `f9df66ac`, the shipped 1.4.5)

**A — the change, and the server's answer is the proof.** It is safe in every case and needs no Room
change.

In the non-retryable pass (`SyncPushHandler.kt:346-365`), handle a `DELETE` answered `NOT_FOUND` before
the generic branch:
- `markTerminal` it, as today. The TERMINAL row is what keeps `SyncOrphanRequeuer`
  (`SyncOrphanDao.kt:40-43`) from re-queuing the soft-deleted local row.
- Close that record's other open queue rows. A new DAO query:
  `UPDATE sync_queue SET status = 'COMPLETED', processedAt = :now WHERE entityType = :t AND entityId = :id AND userId = :u AND operation IN ('CREATE','UPDATE') AND status IN ('PENDING','FAILED')`.
  The server holds nothing, and the user deleted it. A create sent after this only stores a deleted
  copy: that happened in 3 of the 5 older-build cases, by the create's own retry.
- Do not call `reportDropped("push_non_retryable", …)` for it. The server files that answer once
  (rule 8 of `.claude/agents/sync.md`).

**B — optional, the drop before sending.** Only with a mark that says a create was handed to a push.

1.4.5 cannot tell a create that never left the phone from one whose answer was lost after the server
stored it:
- `markProcessing` has no caller in `SyncPushHandler`;
- `updateForRetry` never writes `processedAt`.

Dropping the pair then leaves the record alive on the server although the user deleted it. It comes
back on every other device and after a reinstall, and nothing repairs it, because the re-sent create
is refused as stale. So B needs all three of these:

1. `SyncQueueDao.markHandedToPush(ids, now)`:
   `UPDATE sync_queue SET processedAt = :now WHERE id IN (:ids) AND status = 'PENDING'`, called with
   the batch's ids immediately before the HTTP call.
   - For a PENDING row, `processedAt` then means "last handed to a push".
   - `reviveFailed` and `deleteOldCompleted` read it only on FAILED and COMPLETED rows, so their
     meaning does not change.
2. A preference written once, at 1.4.6's first push. Rows created before it may have been sent by
   1.4.5 with nothing marked.
3. In `SyncQueueManager.enqueue`, for a DELETE, after the owner and seeded-id checks:
   - **When:** the record has a CREATE with `status = PENDING`, `processedAt = null`, `retryCount = 0`
     and `createdAt` at or after that preference.
   - **Then:** delete that CREATE and any PENDING UPDATE, and insert the DELETE as TERMINAL, not
     PENDING.
   - Nothing is sent and nothing is reported.
   - The TERMINAL row still shields the local row: `softDeleteInvoiceItem` sets only `isDeleted` and
     `dateDeleted`, so the row keeps `PENDING_CREATE` (`InvoiceItemDao.kt:89-90`).

The code is `commonMain`, so iOS gets the same change.

## Rejected

- **Answering SUCCESS for an id the server does not hold.** It is true of the outcome, but it changes
  the answer every build acts on, and it erases the only trace of a create arriving after its delete.
  `3b5fd41` lost data by answering SUCCESS for something it had not written.
- **Not counting NOT_FOUND at all.** It would hide the update that never arrived.
- **Deciding on the row's `operation` column when the card is read.** That column is frozen at the
  first occurrence and shared by an update and a delete on one phone.
- **A Flyway migration that re-files the rows already stored.** This change has no migration. Those
  rows get no new deletes once the change is live, and they leave the 7-day window by themselves.
- **Raising the card's threshold.** 0029 rejected it: it hides real defects together with the noise.
- **Editing the Grafana rule instead of the log level.** The rule is right: an ERROR line should be
  rare and real. A harmless answer was wrongly an ERROR. Grafana also reads that file only when it
  starts, which is the owner's hands.
- **The 1.4.6 drop at `enqueue` as the whole app change.** As first sketched, it loses the user's
  delete whenever a create's answer was lost (see B).

## Consequences

- The card stays CRITICAL: 431 devices, for other causes.
- Rows already stored as `NOT_FOUND` + DELETE (8 rows on 5 devices at 15:00 UTC) keep counting until
  7 days after their last occurrence.
  - Marking `invoiceItems · NOT_FOUND` and `invoices · NOT_FOUND` fixed after the deploy is exact:
    neither service answers NOT_FOUND to an update, so only deletes ever landed there, and deletes now
    go to the new signature. This is optional.
- **Measure after the deploy (6 h and 24 h, date-ranged):**
  - no BACKEND row with `error_type = 'NOT_FOUND' AND operation = 'DELETE'` and a `first_seen_at` after
    the deploy;
  - `NOT_FOUND_ON_DELETE` rows appear as vc101 spreads, APP rows beside them after the next hourly
    ingest;
  - the card's "Devices affected" leaves them out, and its new fact names them.
