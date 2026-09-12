# 0067 — An applied write says its number, and a copy that changes nothing keeps it

**Date:** 2026-09-12 · **Status:** decided. It is phase 1b of the receipt number
([`SYNC-RECEIPT-NUMBER-PLAN.md`](../SYNC-RECEIPT-NUMBER-PLAN.md)). The owner approved that work on
2026-09-12 ("pending work start kro apni tarteeb sy"). Built on backend branch `feat/sync-phase-1b`
(from `stage` @ `587b33d`): `e139741` (the push tests share one context) and `9cb19f8` (phase 1b). Not
pushed, not deployed.
**Goal:** G3 · **Related:** [0036](0036-a-delete-must-say-what-it-is-deleting.md),
[0042](0042-the-server-owns-the-version-and-the-device-merges.md),
[0050](0050-every-sync-failure-carries-its-own-evidence.md),
[0058](0058-when-two-devices-changed-the-same-field-the-later-edit-wins-by-a-corrected-clock.md),
[0059](0059-a-delete-of-a-record-the-server-does-not-hold-is-not-a-sync-failure.md)
**Changes no decision:** every phone gets the status and the error it got before, and the clock still
decides every write.

## What the data says (production, read-only, 2026-09-12; the plan's §1 and §2a)

- Rows written in 7 days at `version` ≥ 10: products 110 of 1,744, clients 123 of 1,203, businesses 39
  of 1,030, invoices 28 of 914.
- Rows last written more than 1 h after their own edit time, at `version` ≥ 5 — the shape of a re-sent
  copy: clients 107, products 58, invoice lines 27, businesses 27.
- Seen happening: business `216182a3` went v44 → v45 in 18.5 minutes with no edit, from a 1.4.4 phone's
  background push.
- 16 rows in 30 days name the all-zero iOS id as their writer.
- An applied write was answered `{"id", "status": "SUCCESS"}` and nothing more
  (`SyncV2PushService.kt:204` at `587b33d`), so no phone could learn the number of its own write.

## Decided

1. **Every applied write says its number:** `data: {"version": N, "updatedAt": "…Z"}` beside
   `status: "SUCCESS"`. That holds for a create, an update, a delete, and a copy that changed nothing.
   - **No live build notices.** Every release branch since `VC_87` parses `data` as an optional
     `JsonElement` (`PushSyncResponse.kt`, since `161a9d10`), and reads it only after a refusal:
     `MissingReferenceRepair` checks FAILED + INVALID_REFERENCE first, and `SyncFailureEvidence` reads
     refusals.
   - **A delete stamps the server's time itself**, to the microsecond the column holds, instead of
     leaving it to the entity's hook. Its answer then says the stored time exactly.
2. **A copy that changes nothing keeps its number (T1).**
   - The number, the writer and `last_synced_at` stay where they are, so no other phone pulls the row
     again.
   - Its time is stored exactly as it always was: the time an update carries, the server's time for a
     delete. A copy carrying the time already stored — the re-send loop of plan F1 — writes nothing.
   - "Changes nothing" means the row would not change. It is Hibernate's own comparison of the entity's
     persistent state before and after the copy's content is assigned, attribute by attribute, with the
     equality its flush uses: money by value, a reference by its id. The state is this operation's own,
     so a record sent twice in one push is judged against what its first copy left.
   - When that state cannot be read, the copy is written with a new number, as before, and counted
     `changed="unchecked"`. It is never guessed unchanged.
   - It covers an identical update, the same create sent again, and a second delete.
3. **A delete may say which version it deletes:** `deleted` accepts `"id"` and `{"id", "version"}` in
   one list. The version is evidence only — `last_local_version` on a refused delete — until phase 3.
4. **Counters that act on nothing** (plan 1b.4), on `/actuator/prometheus`, scraped by Prometheus every
   15 s and reset at every deploy:
   - `sync_push_applied_total{group, op, build, changed}`: every applied write; `changed="false"` is a
     copy that changed nothing, so the re-send rate is false / all;
   - `sync_push_stale_refused_total{group, op, build, identical}`: copies the clock refused as older,
     and whether each held what the server holds (the plan's owner question 2);
   - `sync_push_requests_total{build, duplicates}` and
     `sync_push_duplicate_operations_total{group, shape, build}`: one record carried more than once in
     one push (T2);
   - `sync_device_id_second_name_total`: device ids that arrived with a second device name (risk R5);
   - `sync_version_rule_shadow_total{group, op, answer, clock}`: what the version rule would answer, with
     A1. It counts only builds at or above `sync.version-rule.min-app-version-code`, whose default counts
     nobody. Setting that threshold alone starts the count and decides nothing; the rule still needs
     `enabled`.
5. **An unknown writer is nobody** (plan 1b.5): the all-zero id, or no id, is no writer. A write from
   nobody stores `last_modify_by = NULL`, never the writer before it.

## Rejected

- **The plan's own method for T1: the pull projection compared before and after.**
  - A projection sees only the fields it lists. A field it missed would hide a real change, and the
    change would still reach the row at the flush — with the server's clock, because the keep-the-time
    flag is set only for a write that goes ahead — and with no new number, so no other phone pulls it.
  - A data class compares money by scale (`500.0` ≠ `500.00`); Hibernate compares it by value.
  - The projection's defaults (a tax rate of 0 for none, a template's shown fields) differ from the row.
  - The plan's guard is kept, as a test: for every field of every group, the number moves exactly when
    the stored row changes.
- **Holding the stored time at the last real change** (the plan's §10 wording). The clock judges every
  later copy against the stored time, so a time held back changed later answers. The existing guard
  `AnUpdateKeepsTheDeviceTimeTest` found it: an older copy that was refused began to be accepted. For a
  delete sent twice it would have widened the window in which a stale edit brings the record back. To
  revisit once the version rule decides (phase 3), not before.
- **Comparing against the state Hibernate loaded from the database.** A record sent twice in one push
  would get two new numbers for one change.
- **Judging a refused copy by assigning it and undoing.** Rule 5 of `.claude/agents/sync.md`: a record is
  refused before it is touched. A refused copy is compared read-only instead, with the pull's copy.
- **Putting the server's copy on a refused create, to compare against it.** It changes the answer the
  phone gets. The comparison takes the server's copy through a separate argument.
- **A shadow for every build.** Older builds send their own tally as `version`; a shadow of it would be
  confident numbers about nothing.
- **A second property for the shadow's threshold.** One number already says which builds speak the
  server's number.
- **Watching device names in `linked_device`, in the JWT filter.** That is the sign-in path (Tier 1),
  and a query on every request. In the push path, in memory, is enough to size R5.
- **A "written" flag in the answer.** Nothing on a phone reads it; the counter measures it.

## The honest edges

- The counters live in the process. Read them as increases over a window, never as totals; a push that
  fails at commit counts nothing, just as it stores nothing.
- `identical` compares only the fields both copies carry, and a null against a value is a difference, so
  it under-counts rather than over-counts.
- The device name is `MANUFACTURER MODEL`: two phones of one model sharing an id are not seen. The ids
  are held in memory, up to 50,000, until the next deploy.
- The guard's other direction — a check that forgets a change — was not calibrated: the classifier
  refused a deliberate fault in the production check. Its first direction failed for real, on
  `587b33d`: every unstored field moved the number without changing the row.

## Measure after the deploy (6 h and 24 h, date-ranged)

- **Stored rows (plan A.1):** a re-sent product or business keeps its `version` while its phone keeps
  sending it; business `216182a3` stops at the number it holds on the deploy.
- **Unchanged decisions (A.2 over A.3):** STALE_CONFLICT devices per user-active device, as before.
- **The counters:** `changed="unchecked"` stays at 0; the re-send rate per group and build; the share
  of stale refusals that were identical; pushes with duplicates per build; shared device ids.

## Tests

- Failed first, on `587b33d`: 22 of 33 in the six classes, each for its own reason (the number moved;
  `data` absent; the object delete read as an empty id; the all-zero writer stored; no counter).
- Suite: 687/687 (baseline 650/650 on `587b33d`).
