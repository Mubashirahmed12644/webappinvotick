# 0058 — When two devices changed the same field, the later edit wins, by a corrected clock

**Status:** decided. On 2026-09-11 the owner asked whether a Hybrid Logical Clock (HLC) would decide
who wins more accurately than the version. They said to decide after weighing every pro and con: if
the HLC is better, build it; otherwise queue it. This closes item 7 of the 2026-09-11 list.
**Date:** 2026-09-11.
**Amends:** [0042](0042-the-server-owns-the-version-and-the-device-merges.md). Its line "the later
arrival wins" for a same-field conflict is replaced by this decision.
**Related:** `.claude/agents/sync.md`, memory `sync-structure-discussion-2026-09-11`.

## The question

Two or more phones work offline for a long time, edit the same record, and then come online. Which
edit should win? And would an HLC decide that more accurately than the version does?

## What exists today (checked against the code, 2026-09-11)

- **There is no HLC or logical clock anywhere**, in the app or on the server.
- **The phone stamps `updatedAt` with its own clock** (`Clock.System.now()`).
- **The server refuses an update older than the stored one**, with a 1 s tolerance
  (`SyncConflictPolicy`). The phone's own `SyncConflictPolicy` also compares times.
- **The whole record wins or loses.**
- **0042's version rule, the server's "receipt number", is half-built:**
  - the server half is built but switched off (`sync.version-rule.enabled=false`);
  - the phone half is not built: no base snapshot, no merge, and the phone still bumps its own version
    on a successful push.

## Two different questions, two different tools

1. **Had this phone seen the latest copy before it edited?** Only the version answers this, and it
   needs no clock (0042). An HLC cannot answer it: two offline phones both produce valid timestamps for
   edits that each made without seeing the other's.
2. **When both phones changed the same field, which edit was made last?** Only a clock answers this.
   - 0042 chose arrival order at the server, to keep a wrong clock out of every decision.
   - Arrival order is wrong in exactly the owner's case. Phone A edits on Monday, and phone B on
     Tuesday. On Wednesday B reconnects first and A an hour later. A's Monday value arrives last, so
     it wins.

## Decided

- **The version still decides whether an edit may apply.** 0042 is unchanged here:
  - the answers are apply, superseded-by-self, resync or conflict;
  - on a conflict the phone merges field by field, recomputes the derived fields, and pushes again.
- **For a field both sides changed, the later edit wins, not the later arrival.** The edit time comes
  from a clock built like an HLC, with three guards:
  1. **Corrected by the server's clock.** Every successful sync gives the phone the server's time,
     from the HTTP `Date` header that every response already carries. The phone keeps the offset and
     stamps each edit with its own clock plus that offset.
  2. **Never backwards, and always after what the phone had seen.** A stamp is at least 1 ms later
     than the last stamp this phone issued, and at least 1 ms later than the record's current time.
     This is the "logical" half of an HLC, kept per record.
  3. **Never in the future.** When an edit is stamped later than its arrival at the server, the
     server sets it to the arrival time and reports the phone. No edit can happen after it reached
     the server.
- **A merge never stamps "now".** When a phone pushes a merged record, it keeps the later of the two
  times it merged. Otherwise the phone that merged last would win fields it never touched.
  - The failure case, worked out: A edits the price at 12:30, B at 12:00, and C, whose own price edit
    lost, merges at 13:00. If C's merge stamped 13:00, A's later price would then lose to it.
- **The first build compares one time per record.** The residual error:
  - B changes the price at 12:00 and the quantity at 12:45, and A changes the price at 12:30.
  - B's record says 12:45, so B's 12:00 price beats A's 12:30 one.
  - The losing values are counted (below) before per-field times are added. Those need a schema
    change on the server, which is asked about separately.
- **The losing value is recorded,** as 0042 already requires, under its own `sync_failure`
  signature. So it is counted, never silent. There is still no dialog; the owner rejected that on
  2026-09-07.

## Measured (production, read-only, 2026-09-11)

- **No stored time lies in the future:** 0 of 37,128 rows (clients 5,796, invoices 7,510,
  invoice_items 19,746, businesses 3,963, estimates 113). So no stored row could drag clocks forward
  today.
- **Some phone clocks run ahead.** Updates have kept the device's time since 11:00 UTC (6859b42).
  Since then, 7 of 59 edits were stamped more than a minute after the server received them (invoices
  5 of 28, clients 2 of 31). Those phones' clocks ran 1 minute to 1 hour ahead, so a raw phone clock
  is not good enough to pick a winner.
- **0042's own count:** 7 devices locked out by a wrong clock, 41,569 refusals.

## Rejected

- **A full HLC in place of the version.**
  - It cannot tell whether a phone had seen the latest copy, so the stale conflicts, retries and
    resurrection that 0042 ends would all stay.
  - An HLC carries the largest time it has seen, so one phone with its clock a year ahead would
    carry every device's clock a year ahead through the pull.
- **One HLC for the whole phone.** It has the same risk of dragging every clock forward. The
  per-record "after what I saw" rule gives the ordering we need without it.
- **The phone's raw clock.** 7 of 59 recent edits came from clocks more than a minute ahead.
- **Arrival order** (0042's original line). It picks the older edit whenever the older phone
  reconnects last.
- **Last-write-wins for the whole record.** That is today, and it silently loses the other phone's
  unrelated changes (0042).

## Rollout

This is part of the receipt-number work, which comes first in the owner's order (`sync.md`, "Decided
by the owner"). No part ships alone:
1. **Phone:** in the app release after 1.4.5, with 0042 phase 2 (base snapshot, merge, and the phone
   no longer bumping its own version):
   - the corrected clock;
   - the per-record "after what I saw" rule;
   - the tie-break inside the merge;
   - a merge that never stamps "now".
2. **Server:** with 0042 phase 3:
   - the future-time clamp and its report;
   - then the version rule, switched on for builds that support it.
3. **Per-field times,** only if the recorded losing values show the per-record comparison matters.
   This needs a schema change, and the owner's OK.

**Why the server clamp is not built now:** until phase 2, a pull is still decided by time. A phone
whose clock runs ahead would keep its own copy against every pull, while the server held the other
phone's edit. The clamp would only trade today's refused edit for a quiet mismatch.
