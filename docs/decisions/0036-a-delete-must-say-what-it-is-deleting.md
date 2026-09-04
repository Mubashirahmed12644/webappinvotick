# 0036 — A delete must say what it is deleting

**Date:** 2026-09-05 · **Status:** decided, not yet built · **Contract:** [SYNC-CONFLICT-CONTRACT.md](../SYNC-CONFLICT-CONTRACT.md) gap G2

## What happens today

A delete travels as an id and nothing else — `SyncV2Batch.deleted` is a `List<String>`, and
`operationTimestamp` is set to `null` for every delete. `deleteFromSync` sets `isDeleted = true` and
saves. There is no comparison because there is nothing to compare with.

So this is what an ordinary week can do to somebody:

| when | where | what |
|---|---|---|
| Monday | phone, offline | deletes the client "Ahmed Traders" |
| Tuesday | tablet | opens the same client and types in their new phone number — syncs |
| Wednesday | phone comes online | pushes Monday's delete |
| | server | no comparison → `isDeleted = true` → **SUCCESS** |

Tuesday's work is gone, the tablet loses it on its next pull, and nothing anywhere reports it.

**The asymmetry is the tell.** Had Monday's phone *edited* instead of deleted, the same ordering
would have been caught — updates carry a timestamp and lose to a newer one. The app protects an edit
from an older edit and leaves it defenceless against an older delete.

**And it is invisible.** Every other defect in this area fails, so it lands in `sync_failure` and the
Health Centre counts it. A delete never fails. There is no number anywhere for how often this has
already happened.

## Decided

A delete carries the version it is deleting: `[{id, version}]` instead of `["id"]`.

| the server holds | meaning | outcome |
|---|---|---|
| the same version | nothing happened since the user looked | **delete** |
| a higher version | something happened to this record after the user decided | **refuse**, return the record, device restores it |
| no version on the delete (older build) | nothing to compare | **delete** — exactly as today |

Version, not a timestamp: *"I am deleting v7"* is a fact about the record; *"I deleted it at 15:04"*
is a fact about a clock the device owns. This is the same argument as gap G3 and rests on the same
evidence, which is why both wait on the same measurement.

## The objection, and why it does not hold

*A deleted record reappearing will confuse people.*

It will not, and this is the owner's argument rather than mine. **The user's most recent deliberate
action was not the delete — it was the edit.** Monday's delete was made without knowing about
Tuesday; Tuesday's edit was made looking straight at the record. Somebody who genuinely wanted it
gone would have deleted it from the later device too, or left it alone. The record coming back *is*
their own latest decision, which is why nothing has to be asked and no dialog is needed. Deleting it
again costs one tap, and that delete carries v8 and goes straight through.

Between the two possible mistakes, only one is recoverable by the person it happens to. A record
that comes back can be deleted again. Work that vanished cannot be recovered by anyone who is not
reading the database directly.

## Rejected

- **Leave it: a delete is an instruction, not a value.** Defensible in the abstract, and it is what
  happens today — but it was never decided, it contradicts how updates are treated three feet away in
  the same service, and it can only ever destroy work rather than duplicate it.
- **Compare timestamps instead of versions.** A delete has no timestamp on the wire, so this needs a
  wire change either way; and it would put the decision back on the device's clock, which is the
  thing seven devices are currently locked out by.
- **Ask the user.** The whole point of the version comparison is that the answer is already known
  from the record's own history. A prompt would be asking somebody to re-decide something they
  already decided on Tuesday.
- **Hard-delete on refusal to avoid the reappearance.** That is choosing the unrecoverable mistake to
  avoid the recoverable one.

## What it costs to build

| where | change | risk |
|---|---|---|
| wire | server accepts **both** `["id"]` and `[{id, version}]` | none — older builds keep working unchanged |
| app | send the version already held on the local row (the row survives: deletes are soft) | small |
| server | compare, and on a mismatch answer `STALE_CONFLICT` with `serverRecord` | the machinery already exists |
| app | restore the row locally when a delete is refused | small |

## One honest wrinkle

`version` is not bumped only by direct edits: `updateCurrencyCode` bumps it when the user writes an
*invoice* for that client rather than editing the client. So the justification is not "you edited it"
but the wider and truer **"something happened to this record after you decided to delete it"** — and
a client whose invoice was written yesterday is not one to delete on a decision made the day before.

## Sequencing

Built after the version evidence lands (`SyncVersionEvidenceCheck`, gap G3). One measurement answers
both: whether `version` is trustworthy enough in production to decide anything at all.
