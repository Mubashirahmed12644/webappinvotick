# 0042 — The server owns the version, and the device merges without asking

**Date:** 2026-09-07 · **Status:** decided, being built · **Contract:** [SYNC-CONFLICT-CONTRACT.md](../SYNC-CONFLICT-CONTRACT.md) gaps G1, G2, G3
**Extends:** [0036](0036-a-delete-must-say-what-it-is-deleting.md) — whose table is missing a case, see *What 0036 got wrong*

## What happens today

Every sync conflict is decided by a **clock the device owns**, with a one-second tolerance. A
`version` column exists on all 21 synced entities, the app maintains it, the mapper sends it, the
server stores it — and until 2026-09-07 not one of the 23 call sites passed it to the rule, so the
shadow counter that was supposed to inform this decision answered `version_absent` on all 2,920
conflicts it saw. That is fixed (`e7c90ff`); this decision is what the fix was for.

Four things follow from a device clock deciding, and all four are measured, not feared:

| | what happens | size |
|---|---|---|
| Wrong clock locks a device out | every edit reads as "older", every entity refused | 7 devices, 41,569 occurrences |
| A retry arriving after its own later edit | answered `STALE_CONFLICT` — "failed" — when the truth is "your newer copy is already here" | one record pushed 7,173 times |
| Two devices edit the same record | later clock wins, the other edit vanishes with no error | invisible by construction |
| A delete travels as a bare id | no comparison exists | invisible — a delete never fails, so it never reaches `sync_failure` |

And one more, found while writing this: **`version` is not an edit counter.** 19 of the 21 sync
handlers bump it on a *successful push* (`updateSyncInfo(id, SYNCED, now, it.version + 1)`), not on
an edit; `Client` and `Business` are the only two that do not. So a device at rest holds
`server + 1`, "incoming is newer" is merely the normal state, and a higher number proves nothing
about what its writer had seen.

## Decided

**The server owns the version. A device only ever repeats back the number the server gave it.**

That one change turns `version` from a device's private tally into a fact about the record's lineage
on the server — the only thing that can answer *"had this device seen the latest state?"*, which is
the question a clock is structurally unable to answer.

### The push rule — six answers, no seventh

`base` is the version the device last received from the server for that record.

| device sent | server holds | last writer | answer |
|---|---|---|---|
| `base = N` | `N` | — | **APPLY** → `version = N+1`, return the new number |
| `base = N` | `M > N` | **this device** | **SUCCESS — superseded by self.** Nothing to do; the device's own later copy is already here |
| `base = N` | `M > N` | another device | **CONFLICT** → return the server's record and version |
| `base = N` | `M < N` | **this device** | **RESYNC** → return the correct number; the device adopts it and re-pushes. This is the old device-owned counter's debris, and it is why the rollout has no migration cliff |
| `base = N` | `M < N` | another device | **CONFLICT** → return the server's record and version |
| `base = null` | anything | — | **today's clock rule**, unchanged — an older build must never break |

"Last writer" is `lastModifyBy`, which the server stamps itself from the `X-Device-Id` header the app
already sends on every sync call. The app has never populated that field in the body; it is null on
every row today.

A **delete** carries its version and goes through the same six rows — it is not a separate rule.
**A delete bumps the version.** That single line is what ends resurrection: an edit from a device
that has not seen the delete arrives with `base < stored` and is refused, instead of setting
`isDeleted = false` on its way past.

### Resolution — the device merges, and never asks

**The user is never shown a conflict dialog.** Both devices belong to the same person; they are not
disagreeing with anyone, one of them was simply behind. On CONFLICT the device does three things:

**1. Merge the entered fields.** It holds three copies — the server's record, its own *base
snapshot* (the row as it was before the user's edit), and the user's edit. Field by field: changed
only on the server → take the server's; changed only here → keep ours; changed nowhere → leave it.

**2. Never merge a derived field — recompute it.** For `InvoiceItem` the split is exact:

| entered by the user | derived by calculation |
|---|---|
| `name` `description` `quantity` `unitPrice` `discountValue` `discountType` `taxRate` `taxType` `productId` `taxId` `unitTypeId` | `netPrice` `discountAmount` `taxAmount` `subtotal` `total` |

Take `quantity` from one device and `unitPrice` from the other and *every* stored total is now a
number neither device ever computed. Derived fields are rebuilt from the merged inputs, by the same
code that computes them normally — which is why **the merge runs on the device and not the server**.
Money arithmetic must not exist in two implementations (Tier 1); the server stays a store.

**3. Re-push on the returned base.** `base == stored` → APPLY. One extra round trip, nothing shown
to the user, both edits alive.

*Worked example:* phone sets `quantity` 1 → 2; laptop, offline, sets `unitPrice` 50,000 → 65,000.
Today one of them disappears. Under this rule the record ends as quantity 2 **and** price 65,000,
with `total` recomputed to 130,000 — not 65,000, not 100,000.

### Existence follows version; fields follow the merge

When one side deleted and the other edited there is nothing to merge, and no special rule is needed:
whichever side's `base` is older loses **the record's existence**, exactly as the six rows say. A
delete built on a stale base is refused; an edit built on a stale base loses to the delete.

### The one place something still has to be chosen

If both sides changed **the same field**, one value cannot survive in one column. There:

- ~~**the later arrival wins** — arrival order at the server, never a device clock, so a wrong clock
  still cannot decide anything;~~ **Amended by [0058](0058-when-two-devices-changed-the-same-field-the-later-edit-wins-by-a-corrected-clock.md)
  (2026-09-11): the later *edit* wins, by a clock corrected to the server's time, never backwards, never
  before what the phone had seen, and never in the future.** Arrival order picked the older edit whenever
  the older phone reconnected last. The version still decides whether an edit may apply at all;
- **the discarded value is reported**, through the channel device-side sync failures already use
  (analytics event → `DeviceSyncFailureIngest` → `sync_failure` → Health Centre), under its own
  signature.

So it is counted rather than assumed rare. This is the honest edge of the design and it is written
down here so nobody later reads silence as proof it never happens.

## What 0036 got wrong

0036 answers *"the server holds the same version"* → delete, and *"a higher version"* → refuse. It
has no row for **the server holding a lower version**, which is precisely what will arrive: 19 of 21
entity types bump on push success, so after any sync the device holds `server + 1` and every delete
would fall through the table on its first attempt. Under this decision that case is **RESYNC**, and
0036's two rows survive unchanged as rows 1 and 3 of the six.

0036's justification also needs correcting. It argued the record should come back because *"the
user's most recent deliberate action was the edit, not the delete"*. The rule here is not
"later wins" but **"nobody overwrites what they have not seen"**, applied symmetrically. Nothing is
lost by the correction: the refused side is told, and re-doing the action on the fresh base goes
straight through.

## Rollout — four phases, each reversible

| | what | where | needs |
|---|---|---|---|
| **1** | Server owns the number: bump on every applied write **and on delete**; stop deriving it from `dto.version`; stamp `lastModifyBy` from `X-Device-Id`; return `{"version": N}` in each push result | server | nothing — **no app release, no Flyway migration**; `version` and `last_modify_by` columns already exist |
| **2** | Local edits stop touching `version`; base snapshot stored; merge + recompute; delete carries version; the returned `serverRecord` is finally used | app | Room **v4 → v5**, additive `@AutoMigration` |
| **3** | The rule goes live for builds that speak it, keyed on `X-App-Version-Code`; older builds stay on the clock; kill-switch reverts everything | server | phase 2 shipped |
| **4** | The clock survives only as the `base == null` fallback | server | old builds gone |

Phase 1 changes **no decision** — the clock still answers every conflict. Its whole effect is that
the shadow counter starts measuring a real server lineage, so phase 3 is chosen on numbers.

## What this does not fix, stated plainly

- **The guarantee is partial until old builds are gone.** A build that never updates keeps writing
  under the clock rule and can still overwrite a new build's edit in silence. Phase 4 is the day the
  guarantee is whole; before it, it is the share of devices that have updated.
- **It does not merge across records.** One Save produces separate operations for the invoice, each
  item, each payment and the client. The invoice's total is only correct once its children have
  settled, so the parent is recomputed and pushed **after** them. That ordering is part of phase 2;
  without it the server can hold a merged item and a stale invoice total.
- **Merging must be bounded.** merge → re-push → conflict again is a loop, and this codebase has
  already produced one record pushed 7,173 times. At most **two** merge attempts per record per sync
  cycle; after that it waits for the next cycle.
- **The base snapshot has a lifetime that must be exact.** Written only on `SYNCED → PENDING_*`;
  *not* touched when an already-pending row is edited again; deleted when the push succeeds. Get this
  wrong and a second offline edit eats the base, and the merge computes a delta that never happened.
- **Guest→registered orphaning is a different problem.** Migration re-queues everything as
  `PENDING_CREATE`, which this decision handles correctly, but duplicate records under different
  UUIDs are not a versioning question.

## Rejected

- **Keep the counter on the device and add rules around it.** Rejected: two devices produce the same
  number independently, and a push-success bump advances it with no content behind it. Any rule built
  on it is guessing with extra steps.
- **Ask the user to resolve a conflict.** Rejected by the owner, 2026-09-07: it is one person's own
  devices, so a dialog punishes somebody who did nothing wrong. It also fails the product's own
  standard — advancement has to arrive *as* simplicity.
- **Merge on the server.** Rejected: derived money fields must be recomputed by the same code that
  normally computes them. A second implementation on the server is a Tier-1 divergence waiting to
  happen.
- **Server's copy always wins on conflict.** Rejected: it discards the edit the user just made, which
  is the failure this decision exists to end.
- **Last-write-wins by timestamp for the whole record.** Rejected: that is today, and it is what
  locks out seven devices and loses edits without a trace.
- **Refuse to advance the pull cursor until every record applies.** Rejected earlier and still
  rejected: one unstorable record would freeze a device's sync entirely.
