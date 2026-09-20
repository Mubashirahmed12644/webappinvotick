# 0133 — A record the server already holds is not created again, and the audit behind it

**Status:** the root cause is **fixed** on the app branch `fix/147-a-record-the-server-already-holds-is-not-created-again`
(off `VC_107_VN_147`), `d2f35deb`, pushed, not merged, not released. `:data:testDebugUnitTest` **327/327**, Android and
iOS-simulator compiles pass. No schema change, no backend change, no migration, no version bump. The audit below is
measured; the recovery of records already stranded is **not** built and waits for the owner.

**Asked by the owner, 2026-09-20:** *"isko permanently fix kia hy kia tm ny? and is jaisy or kahan kahan mistakes ho
sakti hain — sab ka solution banao."*

**Related:** [0130](0130-one-drift-is-one-report-and-a-guests-stranded-work-is-named.md) (where this was found),
0029/0125 (what is reported), 0050, 0053 (a guest's work moves in one step), 0056, 0059, 0109; sync agent rules 7,
8, 11, 24; **G3**.

## 1. Was it fixed? Yes — and no id ever collided

**The mechanism, from the code, not from a theory.**

Every id the phone makes is a random UUID (`Uuid.random()` on each entity). Two accounts producing the same one is
not what happens. What happens is that **one id is offered twice, under two owners**:

1. A phone's guest starts **offline**, with a locally generated user id, and everything it makes is stored under it.
2. When it finally registers, the server hands back **its own** user id.
   `AuthenticateGuestUseCase` then calls `migrateUserId`, which re-owns **every local row** to the new id —
   **keeping each row's primary key** — and `prepareForSyncAfterMigration` sets every live row to `PENDING_CREATE`
   and queues a fresh CREATE for it.
3. The comment above those 21 statements says why: *"After userId migration the real server account has no knowledge
   of any of these records, so CREATE is always correct."*

**That is true the first time and only the first time.** A phone whose database survives a change of identity — a
second offline guest after a session was cleared, a restored backup — still holds rows **the server accepted under
the previous owner, with the ids it accepted**. Re-owned and re-queued, each is pushed as a create of a record the
server already holds for somebody else, and refused `OWNERSHIP_VIOLATION` — which is correct, and permanent.

**What is proven and what is not.** The code path is proven and reproduced on the real schema. Whether the phone in
0130 went through *this* path cannot be proven from what we store: nothing records a `migrateUserId`, and on that
phone the device id is its own guest id, so a new guest is indistinguishable from a new phone. A restored backup
would produce the same rows. The fix does not depend on telling them apart — both end in the same statements.

**The fix.** `lastSyncedAt` is the server's acknowledgement, and all 21 synced tables carry it. The 21 reset
statements now ask for it:

- **A row the server has never seen** (`lastSyncedAt IS NULL`) is reset and queued exactly as before — that is the
  work the migration exists to save.
- **A row the server has already acknowledged** stays `SYNCED`. Neither this step nor the orphan scan sends it,
  nothing is refused, and **the other owner's data is never touched** (G3).
- **It is not silent.** `countRowsTheServerAlreadyHolds` counts what stays, and `migrateUserId` reports it once as
  `sync_failed stage=queue_previous_identity` with the count.

**Which side, and what it costs.** App only — one condition on 21 statements, one count, one report. **No server
change**: the server's refusal was right and stays. **An app release is needed**; phones on 1.4.7 and earlier keep
the old behaviour until they update. **Already-stranded records are not repaired by this** — that is §4.

Guard: `ARecordTheServerAlreadyHoldsIsNotCreatedAgainTest` (5 cases, Robolectric, the real statements on the real
schema; it did not compile first).

**This one change covers the whole family**, because the statements are the same for every table: the same defect
produced the `OWNERSHIP_VIOLATION` rows on invoices, invoice lines, clients, stamps, templates, signatures, headers,
payment methods, products, payments, estimates, estimate lines and terms alike.

## 2. The audit — where else this class of mistake can happen

Read from the code, and measured from `sync_failure` (unresolved, `source=BACKEND`, last seen since 2026-06-23).
"Records" is distinct record ids; "occ" is how many times it was refused.

| Class | Entities and size today | Can two accounts make the same id? | Does it strand work silently? | Reported? | Verdict |
|:--|:--|:--|:--|:--|:--|
| **Same id under two owners** (`OWNERSHIP_VIOLATION`) | **75 records, 30 phones, 293 occ**; invoices 22, lines 15, clients 11, stamps 6, templates 5, signatures 4, headers 3, payment methods 3, products 2, payments 2, estimates 1, estimate lines 1, terms 1. First seen 2026-07-19, **still arriving on 1.4.7** | No — random UUIDs. One id offered twice | Yes, before this fix: TERMINAL for ever | `push_non_retryable`, once | **Fixed at the root here.** Already-stranded rows: §4 |
| **A copy older than the server's** (`STALE_CONFLICT`) | clients 642 records / 557 phones / 12,742 occ; products 165/126; invoices 104/90; lines 73/63; businesses 81/79; templates 20/19; stamps 12/11; headers 8/5 | n/a | No — the phone keeps its row | `push_stale_divergence`, now **once** (0125) | Mostly the pre-2026-09-11 server clock (rule 3), already fixed server-side. The rest waits for the **receipt number** (0042/0067) |
| **A reference the server does not have** (`INVALID_REFERENCE`) | lines 51 records / 37 phones / **27,831 occ**; invoices 42/27; stamps 20/19; clients 20/19; estimate lines 17/14; invoice-payments 10/3; templates 9/8 | n/a | No — `MissingReferenceRepair` re-queues the parent, and a child whose parent is refused is refused too (83e31ba) | `queue_repair_reference` / `push_non_retryable` | **Largest repeat count in the table.** 0108's product fix (in 1.4.7) and 0109 cover much of it; re-measure after 1.4.7 spreads |
| **A body the server cannot read** (`MISSING_REQUIRED_FIELD`) | invoices 2 records / **70,241 occ** (a deserialisation failure); estimates 17 / **44,226 occ** (`Instant` from `"2026-…"`) | n/a | Yes — the record never lands | counted | The estimates half is **class E / 0056**, decided and built, **not deployed**. The invoices half is 2 records and needs its own read |
| **A timestamp the record does not carry** (`MISSING_REQUIRED_FIELD`, `updatedAt`) | invoices 3, taxes 2, terms 2 — 40–144 occ each | n/a | Yes | counted | Small; the same shape as class T (fixed in 1.4.5) on rows written earlier |
| **An invoice with no client** (`INVALID_UUID`, `clientId: null`) | 12 records, 40 occ | n/a | Yes | counted | **0109**, fixed for 1.4.6/1.4.7 |
| **A delete of a record the server never held** (`NOT_FOUND_ON_DELETE`) | lines 52 records / 52 phones / 168 occ | n/a | No | filed apart, never counted | **0059** — correct as it is |
| **Ownerless queue rows** | 6 rows / 5 phones in 30 days, all payment methods | n/a | It did: invisible to the queue *and* to the orphan scan | `queue_enqueue_no_owner` | **0125**, fixed |
| **A delete that never leaves the phone** | payment methods: 240 on the server, **0 ever deleted** | n/a | Yes, entirely silently | nothing at all | **0128**, built |
| **Seeded/shared ids** (`00000000-0000-0000-…`) | 0 today | Yes, by design — every phone has the same ones | No | n/a | The queue refuses to send them (`SEEDED_ID_PREFIX`); a change to a shared default stays local. Correct |

**What the server does with a child whose parent was refused:** since `83e31ba` it refuses the child too, in the same
push, rather than judging it by a half-applied parent. The phone then re-queues the parent
(`MissingReferenceRepair`) unless the server has already judged it TERMINAL, and revives a quarantined parent when a
child is refused for it. That part is sound.

**Recommended order for what is left** (nothing built here):
1. **Deploy 0056** — it alone accounts for 44,226 of the refusals (estimates, small change, already built).
2. **Re-measure `INVALID_REFERENCE` once 1.4.7 is wide** — 0108 and 0109 should take most of the 27,831.
3. **The 2 invoices whose body cannot be read** — 70,241 occurrences from 2 records deserves one look.
4. **The receipt number** (0042/0067) for the `STALE_CONFLICT` remainder — the biggest by devices, and already the
   owner's chosen order.
5. **The recovery in §4** — on the owner's word.

## 3. The counts the owner asked for first (2026-09-20, read-only)

**How many are in this state:** **75 records on 30 phones**, 293 refusals, across 14 entity types, first seen
2026-07-19 and last seen **2026-09-20 07:09 on build 106 (1.4.7)** — so it was still happening on the current build.
Of the 22 refused invoice ids, **19 exist on the server under 17 different owners**; of the 15 refused line ids,
**12 exist under 12 different owners**. That is the proof that the ids are somebody else's, not invented.

**How much work is stranded.** Of the 32 accounts that reported an ownership refusal in 90 days, 12 have invoices at
all — 216 live invoices between them, of which **9 sit empty**:

| Account | Role | Live invoices | Empty |
|:--|:--|--:|--:|
| 926717497 | GUEST | 7 | **6** |
| 477546626 | USER (our QA account) | 127 | 2 |
| 151524899 | GUEST | 17 | 1 |

**So the 6-of-7 ratio is not typical — it is the worst case.** Two other accounts lost one or two documents each.

**For context, and deliberately not claimed as this defect's doing:** **1,341 of the 8,774 live invoices on the
server (15.3%) have no lines at all, across 467 of 2,745 accounts.** Only 9 of those are accounts that reported an
ownership refusal. The other 1,332 have other causes — `INVALID_REFERENCE`, deletes that never travelled, drafts —
and are not measured here. Estimates: 3 of 140.

**Still active?** The class was last refused **2026-09-20**, on build 106, and the guest of 0130 was last seen the
same day — so this population is live, not historical. Recovery would reach phones that still open the app.

## 4. What happens to the records already stranded — not built

The fix above stops new ones. It does **not** move the 75 records that are already refused: their ids belong to
other owners on the server, and they never will land under those ids.

**The only way to save that work is to give those local rows new ids** and re-point their children (a product id is
referenced by `invoice_items.productId`, an invoice id by its lines and payment links), in one transaction, then send
them as ordinary creates. The other owner's rows are never read or written.

**Cost, from the numbers above:** at most **75 records on 30 phones** would be re-numbered — the ones we can see.
The true figure is a floor: the server only records what was pushed and refused, and a phone that has gone TERMINAL
has stopped pushing.

**Duplicate risk:** if a phone ever legitimately pulls the old record back (it cannot today — the pull sends only
this account's rows), the user would see the same item twice, under two ids. Within one account that is a visible,
fixable duplicate; it is never another account's data.

## 5. Rejected

- **Letting the server accept a record whose id belongs to another account.** That is handing one user's data to
  another (G3), and it is exactly what `0749457` and `0053` were built to stop.
- **Re-issuing ids automatically, now, as part of the prevention.** It is a recovery, it touches user-visible rows,
  and the owner asked to see the counts first.
- **Making the id itself collision-proof** (prefixing with the account, a hash). Nothing collided; the id was never
  the problem, and changing id shape would break every row already stored.
- **Keeping the blanket reset and filtering later in the push.** The record would still be marked PENDING_CREATE, so
  the orphan scan would keep finding it — the loop would move, not end.
- **Deciding from `syncState` instead of `lastSyncedAt`.** `syncState` is what this very step overwrites;
  `lastSyncedAt` is what the server actually said.
- **Blaming a UUID collision.** Arithmetic and the data both say otherwise: the ids exist on the server, created
  months earlier, under named owners.

## 6. Open

- **Nothing records that a phone changed identity.** Adding that one line would make "was this the same handset"
  answerable next time; today it is not.
- **76 of the week's 4,326 phones use their own guest user id as their device id** (1.8%) — carried over from 0130.
- The audit's rows 1–4 in §2.

## Question for the owner

**Wo 75 record — 30 phone par — naye number de kar server tak pohanchayein?**

Ginti ho chuki: **30 phone, 75 record.** In mein se jo sab se bura hai wo wohi guest hai (7 mein se 6 invoice khali);
baqi do accounts ka aik-aik ya do document. **Naya masla ab nahi banega** — wo jar se band kar diya hai. Sawal sirf
purane record ka hai.

**Meri raye: haan, magar agli release ke baad** — pehle rok wali tabdeeli phone tak pohanche, phir gin kar dekhein ke
kitne bache hain, phir aap ki ijazat se un ko naye number diye jayein.
