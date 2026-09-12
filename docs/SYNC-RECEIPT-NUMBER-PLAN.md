# The receipt number — implementation plan

**Status:** plan, 2026-09-12. **Phase 1b is built** on backend branch `feat/sync-phase-1b`
(decision [0067](decisions/0067-an-applied-write-says-its-number-and-a-copy-that-changes-nothing-keeps-it.md)),
not deployed. Building it corrected two things here:
- T1 is judged by Hibernate's own state, not by the pull projection;
- a copy that changes nothing still stores its time (§10).

Everything else is still plan only.
**Owner's word:** the order of the structural fixes (2026-09-11, receipt number first), and "pending
work start kro apni tarteeb sy" (2026-09-12), which approved the three items of 2026-09-12 listed in §4.
**Covers:**
- 0042 phase 2 (app) and phase 3 (server);
- 0058 (the corrected clock);
- the 2026-09-12 follow-ups;
- 0036, folded in by 0042 ("a delete carries its version and goes through the same six rows").

**Anchors:** every file:line below was read on:
- app `VC_102_VN_146` @ `f538e08e` (it holds 0059 A `3cfc2d75` and class P `f538e08e`, pushed);
- backend `stage` @ `587b33d` (it holds the 0059 server half, `59fc04f` + `0f04ca9`).

Line numbers move. Re-read before editing.

**Tier:** sync is Tier 2. Every step that writes a guest's only copy is Tier 1:
- the Room migration;
- the pull writes;
- the merge, and its money arithmetic.

---

## For the owner (Roman Urdu, plain words)

**Meri samajh ye hai:** phone ki har slip par server ki "rasid ka number" likha jaye. Phone apna
number khud na barhaye. Aur agar do phone aik hi cheez badlein, to phone khud dono ki tabdeeliyan
jor de, aap se kuch na poochay. Ye kaam 4 hisson mein hai: server pehle, phir 1.4.6 ke chhote kaam,
phir 1.4.7 mein phone ka bara kaam, phir server par switch on.

Data kya kehta hai (production, 2026-09-12):
- Sirf **2 accounts** (1,107 mein se) aise hain jin ke 2 phone likhte hain. Dono phonon ki
  tabdeeliyan jorne wala hissa kam logon ke kaam aata hai.
- Asal faida sab ke liye hai:
  - ghalat ghari wale phone ki slip ab "purani" keh kar rad nahi hogi;
  - wohi slip baar baar bheji jaye to server ka number nahi barhega.
- **Nayi ghalti mili:** 4 qisam ke records (business, product, merchant, expense) aik dafa edit hon,
  to phone har push par wohi purani slip dobara bhejta rehta hai. Aik business jo 09-08 ke baad edit
  hi nahi hua, aaj bhi dobara likha ja raha hai; server par us ka number **111** hai.

Aap ke faislay: neeche §9 mein 5 sawal hain, har aik ke saath mashwara.

---

## 1. What the data says (production, read-only, 2026-09-12 ~17:00 UTC)

| Fact | Number | Window |
|---|---|---|
| Devices with a server STALE_CONFLICT since the update-time fix (C1b, 6859b42) | **12** (29 signature rows); 0 on 1.4.5 | 2026-09-11 12:00 → 09-12 17:04 UTC |
| User-active devices, same window (cold start or foreground) | vc94 16, vc97 414, vc101 63 | same |
| Of those 12: refused as hours or days behind (a wrong clock or a long absence) | 3 "hours", 5 "days" (device-class rows, vc97) | same |
| STALE_CONFLICT devices over 7 days (includes the clock bug before C1b) | vc97 318, vc94 104; gap: seconds 340, minutes 68, hours 32, days 32 | 7 days |
| Rows written in 7 days with `version` ≥ 10 | products 110 of 1,744 (max 95) · clients 123 of 1,203 (max 124) · businesses 39 of 1,030 (max 111) · invoices 28 of 914 (max 374) · invoice lines 18 of 1,806 (max 91) · estimates 4 of 31 (max 706) · merchants 0 of 10 · expenses 0 of 17 | 7 days |
| Rows last written more than 1 h after their own edit time, `version` ≥ 5 (the shape of a re-sent copy) | clients 107 · products 58 · invoice lines 27 · businesses 27 · invoices 15 · estimates 5 | 7 days |
| Accounts where 2 or more phones wrote | **2 of 1,107** writing accounts | 30 days |
| Rows whose writer is the all-zero id (iOS, `IosDeviceIdProvider`) | invoices 7 of 1,903 · invoice lines 9 of 4,767 | 30 days |
| Phone-stamped writes more than 1 min ahead of their arrival | invoices 6 of 437 · clients 5 of 368 · invoice lines 10 of 802 (1 more than 1 h) | 7 days |
| `Date` header on sync answers | present (nginx), `X-Request-Id` echoed, on a 401 | probe 17:01 UTC |

What this proves, and what it does not:
- **Who the version rule serves.** The two-phone merge serves very few accounts: 2 of 1,107.
  `last_modify_by` names only the latest writer, and only since 2026-09-07, so this is a floor.
  `linked_device` had 7 accounts with 2+ devices (audit, 2026-09-12). The rule's wide benefit is
  elsewhere:
  - no wrong clock can refuse an edit made from the latest copy;
  - a re-sent copy costs nothing.
- **Re-sent copies outnumber genuine conflicts** by an order of magnitude.
  - The clients are the known 1.4.4 re-send (C1 app half, fixed in 1.4.5).
  - Products and businesses are **new**: see F1 and §2a.

## 2. What the code says — eight findings that shape the plan

**F1. An applied UPDATE leaves the row PENDING in 9 of the 21 handlers, and 4 of those are then
re-sent on every push.**
- **Where.** In these handlers the UPDATE branch only calls `markCompleted`:
  - `BusinessSyncHandler.kt:142-147`;
  - `ProductSyncHandler.kt:100-102`;
  - Merchant `:96-97`, Expense `:98-99`, Template `:101-102`, Header `:104-105`;
  - Background `:104-105`, Signature `:101-102`, Stamp `:101-102`.

  Compare the handlers that do flip the row: `InvoiceSyncHandler.kt:72-79`,
  `ClientSyncHandler.kt:94-98`, `InvoiceItemSyncHandler.kt:76-81`.
- **The loop.**
  1. `SyncOrphanDao` scans business, products, merchants and expenses (products `:72-77`, business
     `:80-85`). A row in PENDING_* with only a COMPLETED queue row is an orphan.
  2. `SyncOrphanRequeuer.kt:39-45` queues an UPDATE from the row's state, before every push
     (`SyncManager.kt:259`).
  3. The server applies the identical copy (P2, equal time) and adds 1.

  Every push runs it, and a push follows every local write (`PushTrigger`, `SyncManager.kt:55-68`).
- **The five tables the scan skips** (headers, backgrounds, signatures, stamps, templates) stay
  PENDING_UPDATE for ever. They are never re-sent, but the pull's L6 never updates them again: a
  quiet divergence.
- **Production is consistent with it.**
  - Business `e7980066`: last edit 09-08 11:41, written again at 09-12 16:55, v111.
  - Product `e7426507`: edited 09-09, written again 09-12 16:23, v55.
  - 1.4.5 phones do it too: `8298ede7`, `f9696aad` and `d5903654` are vc101.
  - Merchants and expenses show no climb in 7 days, but few of them are edited (10 and 17 rows
    written).
- **Seen happening.** A second read 18.5 minutes after the first caught business `216182a3`
  written again with no edit, v44 → v45, from a 1.4.4 phone's background push. See §2a.

**F2. The push moves the pull bookmark.**
- **Where.** `SyncPushHandler.kt:192-195` writes the push's server time into
  `updateLastSuccessfulPullAt`. `pushOnly()` runs after every local write (`SyncManager.kt:120-122`,
  debounced by `PushTrigger`).
- **The effect.** Take another phone's change made after this phone's last pull, and more than 60 s
  before its next push (`PULL_OVERLAP_MS`, `SyncPullHandler.kt:122-125` and `:504`). A delta pull
  never offers it.
- **What heals it, partly.** A full pull, on app update or after a failed apply
  (`SyncPullHandler.kt:477-479`), re-offers live rows. It never carries deletes:
  `SyncV2PullService.fullPull` (`:71-119`) reads only `IsDeletedFalse`.
- **Not measured.** The server cannot see what a phone skipped.
- **Why it belongs here.** The merge recomputes an invoice's totals from the lines the phone holds. A
  phone that skipped a sibling line's change computes a wrong total (§3.4). So this is a
  precondition of phase 2, not only item 2 of the owner's order.

**F3. The built server rule still lets the clock refuse an APPLY.**
- `answerByVersion` returns on APPLY (`AbstractSyncV2Support.kt:301-302`). `checkNotStale` then runs
  the clock (`:232-251`).
- A phone whose clock is behind, editing from the latest copy, is still refused. That is the lockout
  the rule exists to end.
- The KDoc's "the clock agrees with APPLY by construction" (`:285-288`) holds only for a phone whose
  clock is right.

**F4. An applied write returns no version.**
- Success is `SyncV2Result(operation.recordId, status)` (`SyncV2PushService.kt:204`). Only
  ALREADY_APPLIED carries `data.version` (`:205-212`).
- 0042 phase 1 promised `{"version": N}` in each push result. It is not built.
- Without it, a phone cannot learn the number of its own write.

**F5. Row 2 of 0042 ("superseded by self") can drop the newest edit.** The sequence:
1. Push #1 carries base N and copy C1. The server applies it (N+1) and the answer is lost.
2. The user edits: C2. `enqueue` replaces the pending row (`SyncQueueManager.kt:68-79`). No push
   marks its rows as in flight, because `markProcessing` (`:106-108`) has no caller.
3. Push #2 carries base N and C2. The server holds N+1 by this phone → SUPERSEDED_BY_SELF
   (`SyncVersionRule.kt:98`, `AbstractSyncV2Support.kt:304-308`) → SUCCESS, nothing written.

C2 then lives only on the phone. This is Tier 1. Amendment A1 in §3.7 fixes it.

**F6. The all-zero iOS id counts as a writer, and an unknown writer keeps the previous one.**
- `callerDeviceUuid()` parses any UUID (`AbstractSyncV2Support.kt:110-117`). 16 rows in 30 days
  carry the nil UUID.
- Every service writes `existing.lastModifyBy = callerDeviceUuid() ?: existing.lastModifyBy`, for
  example `CoreSyncV2Services.kt:111,137`. A write with no usable id therefore leaves the previous
  phone named as the last writer.
- Under the rule, that phone would later be told "your own copy" for a record another device
  changed.

**F7. A success can mark a row SYNCED although it was edited during its own push.**
- `InvoiceItemSyncHandler.kt:76-81` sets SYNCED unconditionally.
- The newer queue row survives, so the edit is sent. In between, the pull's L6 no longer protects
  it.

**F8. Money is computed in UI state, in at least five copies.**
- **The copies:**
  - item: `InvoiceItemUiState.kt:61-120`, used at `InvoiceItemViewModel.kt:228-238`;
  - invoice totals: `CreateInvoiceUiState.kt:125-175` and `EditInvoiceUiState.kt:101-154`;
  - estimate totals: `CreateEstimateUiState.kt:93-142` and `EditEstimateUiState.kt:75-128`.
- **Two SQL paths write a derived price the caller hands in.**
  - `InvoiceItemRepositoryImpl.kt:221-230`, and the same pair in `EstimateItemRepositoryImpl`.
  - `updateItemDiscount` writes `netPrice = "0.00"`.
  - Neither bumps, queues or syncs.
  - They have no caller outside their use cases and DI (`InvoiceItemUseCases.kt:104,112`,
    `EstimateItemUseCases.kt:102,110`, `dataStoreModule.kt:720-721`).
- **Why it matters.** The sync code in `data` cannot call feature code. So the merge cannot
  recompute a total until that arithmetic lives in one shared place (phase 2a).

Also read, and used below:
- **Room.** Room is at **v5** (`AppDatabase.kt:128`). 0042's "v4 → v5" is now **v5 → v6**.
- **Version bumps on the phone.** The phone bumps `version` at 23 local-edit sites in 20
  repositories (`version = existing.version + 1`). It also bumps at 30 push-success sites in 19
  handlers (`updateSyncInfo(…, it.version + 1)`); Client and Business never bump there.
- **RESYNC_REQUIRED on the phone.** It is not in the app's `NON_RETRYABLE` set
  (`SyncResultStatus.kt:44-51`). A phone that received it would climb the retry ladder. No build
  receives it yet, because the gate is closed.
- **Repeated deletes.** A delete of an already-deleted row is applied again: it bumps and moves
  `last_synced_at` (for example `CoreSyncV2Services.kt:124-138`). `AlreadyDeletedException` is
  declared and never thrown.
- **Backup and the device id.** Android backs the device id up. `AndroidManifest.xml:90` has
  `allowBackup="true"` and there are no backup rules. `AndroidDeviceIdProvider.kt:16-18` keeps the
  id in SharedPreferences `device_uuid_prefs`. A phone restored from another's backup can carry
  that phone's id, and possibly its old database. See risk R5.

## 2a. The re-send loop, read twice

The 20 products and businesses that A.1 found last written more than 1 h after their own edit time,
with `version` ≥ 5, were read at 17:03:54 UTC and again at 17:22:27 UTC.

| Record | v at 17:03:54 | v at 17:22:27 | `updated_at` (the phone's edit time) | Last write |
|---|---|---|---|---|
| business `216182a3` | 44 | **45** | 09-12 04:20:44.553, unchanged | 16:49:25 → **17:04:43** |
| the other 19 | — | unchanged | unchanged | not written in these 18.5 minutes |

- **The one write.** Its writer (`53db87d5`) is a 1.4.4 phone whose last analytics event had arrived
  at 04:26: this was a push with nobody using the app, 13 hours after the business was last edited.
- **The writers' builds** (A.4): 6 of the 7 looked up are 1.4.4. `8298ede7` is 1.4.5, and wrote
  product `2fcf74c5` (last edited 09-08) at 16:43 today.
- **What this proves.** A version that climbs while the phone's own time stays put is a phone
  re-sending the same copy (`sync.md`, "a climbing version is not a loop until the rows say so").
  It has now been seen happening, once in 18.5 minutes, from a background push. The code in F1 says
  why.
- **Not yet measured:** how often, per phone per day. T1's no-write counter (1b.4e) will say, for
  every group and build.

---

## 3. The design, inside 0042 and 0058

### 3.1 The version column

`version` means **the server's number for this record as last received; 0 = not known**.

- **The reset.** The v5 → v6 migration sets `version = 0` on the 21 synced tables, once, inside the
  same migration as the new table. The numbers there now are debris of the device-owned counter:
  server + 1 after every push success.
- **What 0 does.** Base 0 is NOT_APPLICABLE on the server (`SyncVersionRule.kt:89`), so the clock
  decides that record, as today. The phone learns the real number from:
  - an applied answer (F4, phase 1b);
  - a pull, whose DTO carries `version`;
  - a CONFLICT or RESYNC answer, whose `serverRecord` carries it.
- **Why this way.** The number is learned one record at a time. There is no cliff, no RESYNC flood,
  and no conflict without a base built from debris.
- **Rejected:**
  - *Send the old counter and let RESYNC correct it.* Every old record's first edit costs a round
    trip. Every record last written before 2026-09-07 has no writer (`last_modify_by` NULL), so it
    lands in CONFLICT without a base, and the base-less merge would report every differing field as
    a lost value: noise.
  - *A new `serverVersion` column on 21 tables.* A schema change on every table, for the meaning
    the existing column can carry.

### 3.2 The base snapshot and its exact lifetime

A new table `sync_base`:
- primary key `(entityType, entityId)`;
- columns `baseVersion`, `baseJson` (the record's DTO) and `capturedAt`;
- no `userId`, so `UserMigrationDao.migrateAllUserData` needs nothing new;
- `AccountPurgeDao` deletes it with the account.

Only UPDATEs need it. A CREATE has no base. A DELETE needs only its version (§3.6).

| # | Event | What happens to the base |
|---|---|---|
| 1 | First local edit of a **SYNCED** row with `version > 0` | **Written**, in the same Room transaction as the edit, from the row as it stood (= the server's copy at `version`) |
| 2 | Another edit while the row is PENDING_UPDATE | **Untouched** (0042: "a second offline edit must not eat the base") |
| 3 | Edit of a PENDING_CREATE row, or of a row with `version = 0` | Nothing: no base (the clock decides that record) |
| 4 | Applied answer carrying version V, row unchanged since sent (its `dateUpdated` equals the sent `updatedAt`) | **Deleted**; row SYNCED, `version = V` |
| 5 | Applied answer carrying V, row edited during the push | **Replaced by the copy that was sent**, at V (that is the server's copy now); row stays PENDING_UPDATE, `version = V` |
| 6 | CONFLICT, `serverRecord` S at M | After the merge: base := S at M; row := merged; `version = M`; re-queued |
| 7 | Superseded by self (amended row 2, §3.7), row unchanged since sent | **Deleted**; the phone adopts the server's copy (its own later write); SYNCED |
| 8 | RESYNC carrying M | Base relabelled M (content unchanged: the server's copy at M is this phone's own last write); `version = M`; re-queued |
| 9 | A pull of a PENDING row (L6) | Untouched |
| 10 | Guest migration re-queues rows as CREATE; account purge | Deleted for those records |

**Where it is written.** One helper, `LocalEdit.stamp(entityType, existing)`, replaces all 23
`version = existing.version + 1` sites. At the same time it:
- captures the base per row 1;
- returns the corrected time (§3.5);
- leaves `version` alone.

The dead SQL money paths in F8 are deleted, not wrapped. A source-scan test fails when any
repository writes `version + 1`, or stamps `dateUpdated` with `Clock.System.now()`.

### 3.3 Merge — three copies, field by field

It runs on a CONFLICT, or on a clock STALE_CONFLICT that carries a `serverRecord`, over the DTO as
JSON: base B, server S, ours O.

| Field | Rule |
|---|---|
| Server-owned: `version`, `lastModifyBy`, `lastSyncedAt`, `createdAt`, `userId` | never merged; taken from S |
| Derived money fields | never merged; **recomputed** from the merged entered fields by the one money function (phase 2a) |
| O = B | take S |
| S = B | keep O |
| O = S | that value |
| O ≠ B, S ≠ B, O ≠ S (same-field conflict) | the later edit wins by the record's time (0058, first build: one time per record); the loser is **reported** |
| Existence (`isDeleted`) | follows the version: S deleted at M > base → the delete wins over our edit; the lost edit is reported |

**Derived fields per entity.**
- **Invoice line and estimate line:** exactly 0042's split.
  - Entered: `name`, `description`, `quantity`, `unitPrice`, `discountValue`, `discountType`,
    `taxRate`, `taxType`, `productId`, `taxId`, `unitTypeId`.
  - Derived: `netPrice`, `discountAmount`, `taxAmount`, `subtotal`, `total`.
- **Invoice and estimate:** `subtotal`, `discountAmount`, `taxAmount`, `totalAmount` are derived from
  the live lines plus the document's discount, tax and shipping.
- **Product:** `netPrice`, `discountAmount`, `taxAmount`.
- **To classify in phase 2a, from the code:** expense `subTotal`/`total`/`tax`, an invoice's
  `invoiceStatus` (entered, or following its payments?), and `invoice_payments.amountApplied`.

- **The merged record's time.** It is the later of O's and S's times. **A merge never stamps "now"**
  (0058).
- **Merges are bounded.** At most **2 merge attempts per record per sync cycle** (one `runSync`),
  counted in memory in `SyncPushHandler`. A third conflict waits for the next cycle.
  - Proposed guard: 10 merges without an applied answer → report once (`merge_not_settling`) and
    stop merging that record until the user edits it. This record has shown the shape before: one
    was pushed 7,173 times.
- **No base** (a row edited while `version` was 0): the merge falls back to the same-field rule for
  every differing field. Transitional only. Its report carries `local_version=0`, so it is counted
  apart.

### 3.4 The parent after its children

- **What marks a parent.** A merged line, or a merged invoice or estimate, marks that document for
  recompute.
- **When it is recomputed.** After the cycle's **pull**, the phone recomputes the document's derived
  totals from its live lines, with the same function. If they changed, it writes the row
  (PENDING_UPDATE), and it is pushed in the next push. So its totals always describe lines that
  have landed.
- **Why after the pull.** The pull brings the siblings that another phone changed. L6 keeps this
  phone's own pending lines. This works only once the push stops moving the pull bookmark (F2):
  that is phase 2 step 2.7, and owner question 3.

### 3.5 The corrected clock (0058)

`SyncClock`, in `data/sync`:

- **Offset** = the server's time − the midpoint of send and receive. Two sources:
  - the push and pull answers' `syncTimestamp`, which carry milliseconds
    (`SyncV2PushService.kt:84-85`; `SyncV2PullService.kt:44`, stamped at the start of the pull);
  - the `Date` header of any sync answer, which carries only seconds.

  The phone keeps the sample with the smallest round trip in the last 24 h, persisted in
  `SyncMetadataRepository`. 0058 names the `Date` header; `syncTimestamp` is the same server clock
  at millisecond precision, so both are used.
- **Stamp** = max(now + offset, last stamp issued + 1 ms, the record's `dateUpdated` + 1 ms):
  - never backwards;
  - always after what this phone had seen;
  - kept per record, never one clock for the whole phone (0058 rejected that).
- **No offset yet** (a phone that never synced): offset 0. The per-record rule still holds.
- **Future time.** The server clamps it, in phase 3 only (§3.7). It cannot ship alone (0058, "Why
  the server clamp is not built now").

### 3.6 A delete carries its version

- **The wire.** `deleted` accepts both `["id"]` and `[{"id","version"}]`. Today it is
  `SyncV2Batch.deleted: List<String>` (`SyncV2PushDtos.kt:22`), read at
  `SyncV2BatchDeserializer.kt:49-56`. The server accepts both first, in phase 1b; the phone sends the
  objects in phase 2.
- **The version sent** is the row's `version`: the server's number, which a soft delete does not
  change.
- **Decided by the six rows** once the gate is on (phase 3). A delete refused by a newer copy →
  the phone restores the row from `serverRecord` (0036), and nothing is asked.
- **What this closes.** This builds the owner's structural fix 4 inside fix 1, as 0042 already
  says. There is no separate release.

### 3.7 The server's answers in phase 3 — 0042's six rows, amended

| Device sent | Server holds | Last writer | Answer |
|---|---|---|---|
| `base = N` | `N` | — | **APPLY**, and the clock is **not** consulted (fixes F3) |
| `base = N` | `M > N` | this phone | **A1:** identical copy → SUCCESS, nothing written; incoming time later than stored → APPLY on top of M; otherwise → SUPERSEDED_BY_SELF with `serverRecord` (fixes F5) |
| `base = N` | `M > N` | another or unknown | CONFLICT + `serverRecord` |
| `base = N` | `M < N` | this phone | RESYNC + M |
| `base = N` | `M < N` | another or unknown | CONFLICT + `serverRecord` |
| `base = 0` or none | anything | — | the clock rule, unchanged |

- **A1 is safe.** Same-phone times are ordered by 0058's never-backwards stamp.
  - A copy this phone sent later carries a later time.
  - A copy restored from an old backup carries an earlier time, and is superseded.
- **Nobody is "this phone" when the id is the all-zero UUID or absent** (fixes F6). A write with no
  usable id stores `lastModifyBy = NULL`, never the previous writer.
- **Future time.** For gated builds only: a stamp later than its arrival is set to the arrival time.
  - Every clamp beyond 2 s is filed as `FUTURE_TIME_CLAMPED`. The 2 s is above the offset's known
    error.
  - The applied answer returns the stored time, so the phone adopts it.
- **Log levels.** Every answer here is logged at INFO or WARN, never ERROR. Grafana's
  `invotick-sync-failure` rule pages on one ERROR line containing `SYNC`.

---

## 4. The three items approved on 2026-09-12, and one found today

**T1 — Server: a copy that changes nothing does not add to the version.** (phase 1b)
- **The sites.** 42 `existing.version = existing.version + 1` lines, an update and a delete in each
  of 21 services:
  - `CoreSyncV2Services.kt:110/136, 229/257, 353/380, 514/562, 673/698`;
  - `BusinessSyncV2Service.kt:151/204`;
  - `EstimateSyncV2Services.kt:170/188, 359/379`;
  - `FinancialSyncV2Services.kt:100/127, 297/325, 536/563, 717/746`;
  - `MasterDataSyncV2Services.kt:105/133, 214/241, 322/349, 430/457, 539/566`;
  - `TemplateComponentSyncV2Services.kt:89/109, 182/209, 292/319, 402/429`.
- **How.**
  1. Take the entity's pull projection before the assignments (`ClientSyncV2Pull.from(existing)`
     and its 20 siblings; each already exists for `serverRecord`).
  2. Assign the content.
  3. Compare, excluding `version`, `lastModifyBy`, `updatedAt`, `createdAt` and `lastSyncedAt`.
  4. Equal → assign none of the bookkeeping and return SUCCESS. Hibernate writes nothing, so
     `last_synced_at` does not move either, and no other phone re-pulls an unchanged row.
  5. A delete of a row already `isDeleted` → SUCCESS, nothing written.
- **Placement.** After every existing check. No answer changes, only the number.
- **A projection that forgot a field would hide a real change.** So the guard is reflective: for
  every group, changing any one content field of the DTO must count as a change.
- **Failing first:** `ACopyThatChangesNothingKeepsItsNumberTest`, for all 21 groups:
  - an identical update;
  - an identical create-again;
  - a second delete.

  Each today moves `version` and `last_synced_at`. A real change still adds 1. Every case has
  another query after the write, and reads the row back through a fresh persistence context (rule 3
  of `sync.md`).
- **Effort:** 1.5 days. **Tier 2.**

**T2 — App: collapse duplicate queued copies of one record.** (1.4.6)
- **The query.** New `SyncQueueDao.collapseDuplicatePending(userId)`. Among PENDING rows with the
  same (user, type, id, operation):
  - keep the earliest `createdAt` (its place in line), with the group's lowest `priority`;
  - delete the rest;
  - delete a PENDING UPDATE when a PENDING CREATE exists for the same record. The CREATE is read at
    gather time, so it already carries the latest state; the reasoning is `SyncQueueManager.kt:72-79`.
- **What it never touches.** FAILED, TERMINAL and COMPLETED rows. A DELETE is collapsed only with an
  identical DELETE (0059 B territory).
- **Where it runs.** In `SyncPushHandler.pushWithin`, beside `adoptOwnerlessOperations` and
  `reviveQuarantined` (`SyncPushHandler.kt:129-131`). That is before every push, including the first
  after start. It is a superset of "on app start", because a revival (`reviveFailed`) can open a
  second row later.
- **Not reported.** It is not a failure (0029). It is measured on the server (phase 1b counter).
- **Failing first, on Robolectric with real Room:** the shape the audit recorded on 2026-09-12, a
  vc94 push carrying 27 CREATEs of one invoice, plus UPDATEs. One push must carry one CREATE, and
  FAILED rows must stay.
- **Effort:** 0.5 day. **Tier 2.**

**T3 — Edit screen: only new changes are written.** (1.4.6)
- **Today.**
  - `EditInvoiceViewModel.kt:150-158` collects every change of `items` (debounced 1 s).
  - `autoSaveEdits` (`:1046-1099`) writes every line whose action is not NONE, and never resets
    it. ADD lines are re-inserted with REPLACE (`InvoiceItemDao.kt:20/23`); DELETE lines are
    soft-deleted and queued again.
  - Each re-write queues a CREATE or DELETE that the server applies again. Line `f5cc3d42` reached
    v16 in 6 minutes (audit, 2026-09-12, a vc101 phone).
- **The fix is the create screen's own pattern.**
  - `CreateInvoiceViewModel.writeDocument` persists lines "as a delta against what the row holds"
    (`:927`, `GateDraftKeeper.itemDelta` / `markPersisted`).
  - The edit screen keeps what it last wrote the same way, and writes only the delta. A line
    changed during the write stays in the next delta.
  - `onBackClicked` (`:1023-1039`) then sees nothing unsaved after an autosave. That is right: it is
    stored.
- **Scope.** Estimate edit has no autosave. The create screen already writes a delta.
- **Failing first:** a `commonTest` in the style of `GateDraftKeeperTest`. Two autosaves with no
  change in between must write nothing the second time; today the ADD line is written twice.
- **Effort:** 1 day. **Tier 2.** Money arithmetic is untouched; only which rows are re-written
  changes.

**T4 — Extend 0060 to the other 20 pull handlers, in the order of what REPLACE can destroy.**

What each handler does on a pull today (all 20 updates are already `@Update`, which is safe):

| Handler | Lookup used by the pull | Insert | What a REPLACE fires (the v5 schema phones hold) |
|---|---|---|---|
| **Template** | `TemplateDao.kt:36-37`, `AND isDeleted = 0` | REPLACE `:20` | `invoices.templateId`, `estimates.templateId` SET NULL (nullable → **silent**) |
| **PaymentInstruction** | `PaymentInstructionDao.kt:36-37`, `AND isDeleted = 0` | REPLACE `:18` | `invoices/estimates.paymentMethodId`, `payments.paymentInstructionId` SET NULL (**silent**) |
| Estimate | id only | REPLACE `EstimateDao.kt:18` | `estimate_items` **CASCADE** |
| Merchant | id only (`MerchantDao.kt:29-30`) | REPLACE `:14` | `expenses.merchant` **CASCADE** |
| Business | id only | REPLACE `BusinessDao.kt:17` | payment_instructions, merchants, backgrounds **CASCADE**; the rest SET NULL |
| Category, UnitType | id only | REPLACE | products and lines: category and unit SET NULL (silent) |
| Terms, Signature, Stamp, Background | id only | REPLACE | links SET NULL (silent) |
| Tax | id only | REPLACE | nothing: no foreign key points at `taxes` in the v5 schema |
| Header | id only | **IGNORE** `HeaderDao.kt:21` | a collision is silently skipped |
| Client | id only | REPLACE `ClientDao.kt:10` | invoices, estimates, payments **RESTRICT** (loud, like P) |
| InvoiceItem, EstimateItem, InvoicePayment, Expense | id only | REPLACE | no children |
| Invoice, Payment | id only | ABORT (`InvoiceDao.kt:17`, `PaymentDao.kt:25`) | — |

- **Where each handler's lookup and insert sit** (`processFromServer`): Template `:127/130`,
  PaymentInstruction `:98/101`, and the others likewise.
- **What protects a delete made here.**
  - Only business, client and template set `PENDING_DELETE` when deleted (`BusinessDao.kt:40-47`,
    `ClientDao.kt:42-49`, `TemplateDao.kt:155-161`).
  - The other 17 soft deletes write only `isDeleted` and `dateDeleted`, so L6 does not protect them.
  - L7 (0060) is the only thing that keeps an equal-time server copy from bringing them back.
- **T4a (1.4.6): Template and PaymentInstruction, as 0060 did for Product.**
  - `findForPull` by id alone, deleted or not, whoever's;
  - UPDATE a held row, insert with ABORT;
  - L7.

  These two hide a deleted row, so a pull of one deleted here, whose delete has not reached the
  server, REPLACEs it: the deleted record comes back, and **every invoice using it silently loses
  the link**. It is P's shape without P's loud error (code, not measured).
- **T4b (1.4.6): L7 in the other handlers.** Pass `SyncConflictPolicy.localChangedAt(...)` instead of
  `dateUpdated`, one line each. The 17 unprotected deletes need it.
- **T4c (1.4.7, with phase 2, which rewrites these handlers anyway): ABORT inserts for the remaining
  15 REPLACE handlers, and for Header, whose IGNORE skips a collision in silence.**
  - Every one of them looks up by id alone, so no pull reaches a collision today.
  - The hazard is latent: the next lookup change reopens it, with CASCADE on estimates, merchants
    and businesses.
- **Failing first:** one Robolectric class per group, on the real v5 schema, in the pattern of
  `APulledProductNeverDeletesItsRowTest`. For example: a pull of a template deleted here clears
  `invoices.templateId`; an equal-time copy brings back a line deleted here.
- **Effort:** T4a 1 day, T4b 1 day, T4c 1.5 days. **Tier 1** (the pull writes guests' only copy).

**T5 — found today (F1 and F7): an applied write marks its row SYNCED, only when the row still holds
what was sent.** (1.4.6, owner question 1)
- **What changes.**
  - All 21 handlers' applied branches, CREATE and UPDATE.
  - "Unchanged" means the row's `dateUpdated` equals the sent DTO's `updatedAt`. The sent copies
    come from the request, the way `PushSyncRequest.sentVersions()` already does
    (`SyncPushHandler.kt:422-448`).
  - `version` behaves exactly as today in 1.4.6; phase 2 changes it.
  - The five tables the orphan scan skips (headers, backgrounds, signatures, stamps, templates) join
    `SyncOrphanDao`.
- **Failing first:** `AnAppliedUpdateIsSyncedTest`, over the fake DAOs in `DaoTestFakes.kt`.
  - For each of the 9 handlers, an applied UPDATE leaves the row PENDING today, and the orphan scan
    re-queues it.
  - An edit during the push must keep the row PENDING, with its new queue row.
- **Effort:** 1–1.5 days. **Tier 2.** It ends the only re-send source still live on 1.4.5.

---

## 5. Phases

### Phase 1b — server first; changes no decision (deploy alone, no migration, no config)

| Step | What | Files | Failing-first test | Effort |
|---|---|---|---|---|
| 1b.1 | Every applied write returns `data: {version, updatedAt}`. Old builds parse `data` as an optional `JsonElement` (`PushSyncResponse.kt:89-96`) and read it only on failures. | `SyncV2EntityHandler.kt:3-13` returns `Applied(version, updatedAt)` instead of `String`; 21 services; `SyncV2PushService.kt:191-204` | `AnAppliedWriteSaysItsNumberTest` (21 groups × create/update/delete) | 1 d |
| 1b.2 | T1 | as above | as above | 1.5 d |
| 1b.3 | `deleted` accepts `{id, version}`; its version becomes evidence (`last_local_version`; `readVersion` returns null for a delete today, `SyncV2PushService.kt:376-381`) | `SyncV2PushDtos.kt:22`, `SyncV2BatchDeserializer.kt:49-56`, `toOperations` `:448-459` | `ADeleteMaySayWhichVersionTest`: both shapes in one push; the old shape unchanged | 0.5 d |
| 1b.4 | Counters that act on nothing: (a) the six answers **with A1**, for builds ≥ the phase 2 code (`sync_version_rule_shadow_total{answer}`), read by a Health Centre check in samples, not days (counters reset on deploy); (b) identical copies refused as stale, per group; (c) duplicate operations in one push; (d) one `X-Device-Id` arriving with two `X-Device-Name` values (R5); (e) copies T1 answered without a write, per group and build: the re-send rate | `AbstractSyncV2Support.kt:290-323`, `SyncV2PushService.toOperations`, a new `HealthCheck` | calibrated: each counter moves on its shape, and not on the control | 1 d |
| 1b.5 | The nil UUID or no header = no writer; a write with no usable id stores `lastModifyBy = NULL`, never keeps the previous writer | `AbstractSyncV2Support.kt:110-117`; the 42 `lastModifyBy` lines | `AnUnknownWriterIsNobodyTest` | 0.5 d |

- **Total:** 4.5 days, plus the full suite (`invotick-test-mysql` on 13306; the ucomm guard first).
- **Gate:** none. It changes no answer a phone acts on, so it ships now. It is independent of the app.

### Phase 1.4.6 — app, small and independent of the server

The pieces:
- T5 (owner question 1);
- T2;
- T3;
- T4a and T4b.

What 1.4.6 already carries: 0059 A (`3cfc2d75`) and P (`f538e08e`).

- **No Room change.**
- **Effort:** 5 days.
- **Order:** T5 → T2 → T3 → T4a → T4b. If the release date forces a cut, T4b goes to 1.4.7 first.
- **Verification:** `:data:testDebugUnitTest`, never `jvmTest`; iOS compile (commonMain); a debug
  build on the Pixel only if asked.

### Phase 2a — one money function (prerequisite of the merge; changes nothing a user sees)

- **The move.** Lift the line arithmetic (`InvoiceItemUiState.kt:61-120`) and the document totals
  (`CreateInvoiceUiState.kt:125-175`, `EditInvoiceUiState.kt:101-154`, and the two estimate copies)
  into one `domain` function. The five copies then call it.
- **Delete the dead SQL money paths** (F8).
- **Classify** the derived fields still unclassified in §3.3.
- **Failing first: characterisation.** Golden values are captured from today's five copies, before
  the move, over every discount type × tax type × quantity (including 0.5 and 0) × rounding case.
  They must match after the move to the last digit.
- **Effort:** 2–3 days. **Tier 1** (financial logic). It is safe only because the characterisation
  holds.

### Phase 2 — the phone speaks the receipt number (the release after 1.4.6), with 0058's phone half

Step 0 is `docs/SYNC-CONFLICT-CONTRACT.md`: new cases for the six rows, A1, the clamp, and L8 "pull
by version". Then both `SyncConflictContractTest` files. Then the code. That order is the contract's
own rule.

| Step | What | Files | Failing-first test | Effort |
|---|---|---|---|---|
| 2.1 | Room **v5 → v6**: `sync_base` (additive `@AutoMigration` with an `AutoMigrationSpec`) whose `onPostMigrate` sets `version = 0` on the 21 tables, in the same transaction | `AppDatabase.kt:96-143`; the new `6.json`; `AccountPurgeDao`; `UserMigrationDao` (clears bases of re-queued creates) | `AppDatabaseMigrationTest` (androidInstrumentedTest, `MigrationTestHelper`, needs a device or emulator: none on this Mac) **and** a Robolectric real-Room test of the reset and of §3.2 rows 1–5 | 1.5 d |
| 2.2 | Local edits stop touching `version`; `LocalEdit.stamp` at the 23 repository sites | 20 `*RepositoryImpl.kt` (the grep in §2) | source scan: no `version + 1`, no raw `Clock.System.now()` stamp in repositories; `ABaseSnapshotLivesExactlyTest` | 2 d |
| 2.3 | Push answers: applied → adopt `data.version` and `updatedAt`, SYNCED per §3.2 rows 4–5, and none of the 30 `version + 1`; `RESYNC_REQUIRED` → adopt and re-queue, never the retry ladder; STALE_CONFLICT with `serverRecord` → merge instead of TERMINAL (`NonRetryablePass.kt:88-141`); without `serverRecord` → as today | 21 handlers; `NonRetryablePass.kt`; `SyncResultStatus.kt` | `APhoneSpeaksTheServerNumberTest` | 2 d |
| 2.4 | The merge engine (§3.3), parent recompute (§3.4), the bound of 2 per cycle | new `data/sync/merge/`; `SyncManager.kt:246-271` (recompute after the pull) | `AMergeKeepsBothEditsTest` (0042's example: quantity 1→2 here, price 50,000→65,000 there → 2 × 65,000, total 130,000 recomputed); `ASameFieldGoesToTheLaterEditTest` (0058's A/B/C, "a merge never stamps now"); `ADeleteBeatsAStaleEditTest`; `MergeIsBoundedTest` | 5–6 d |
| 2.5 | A delete sends `{id, version}` (only once 1b.3 is live); a refused delete restores the row | `PushSyncRequest.kt:53`; the 21 `gatherOperations` | `ADeleteSaysWhatItDeletesTest` | 1 d |
| 2.6 | Pull by version for known numbers (contract L8): SYNCED + incoming version > local → apply; ≤ → skip; `version` 0 → L1–L7 as today; pending → L6 | 21 `processFromServer` + `softDelete` | extend `SyncConflictContractTest` (app) | 1.5 d |
| 2.7 | The push stops moving the pull bookmark (F2; owner question 3). Its own writes come back at the same version and are skipped by 2.6 | `SyncPushHandler.kt:192-195` | `AnotherPhonesChangeIsNotSkippedTest` | 0.5 d |
| 2.8 | `SyncClock` (§3.5) | new; `SyncApi.kt:157-160,184-190` (answer headers); `SyncMetadataRepository` | `TheStampNeverGoesBackwardsTest` (a phone 1 h ahead, 1 h behind, never synced) | 1.5 d |
| 2.9 | New `sync_failed` stages: `merge_value_replaced` (entity, record_id, field, local_version, server_version, run, **`edit_gap_ms`**, which is a new parameter) and `merge_not_settling`. The 0050 table and the event owner's review come first (`AGENTS.md` §7.8) | `SyncFailureEvidence.kt:163` (`STAGE_PARAMS`) | the existing enforced test, extended | 0.5 d |
| 2.10 | 0057, send again once: TERMINAL stale slips are re-queued once, after the phone has learned the number. On CONFLICT they stay TERMINAL, as 0057 decided (owner question 5) | `SyncQueueManager` | `AGivenUpEditIsSentOnceTest` | 1 d |

- **Total:** 17–19 days of work, including T4c, plus a device session for the instrumented migration
  test.
- **Safe with the gate off.** With the rule off, a clock STALE_CONFLICT carries `serverRecord`, and
  the phone merges. The merged copy keeps the later time, so its re-push passes the clock. This ends
  contract gap G1 (the divergent-for-ever record) for these phones before phase 3.
- **Server side, before this release: server step 1c** (1 day).
  - The ingest files `merge_value_replaced` under its own signature.
  - The Device sync card shows it as a fact and never counts it, as with `NOT_FOUND_ON_DELETE`
    (`SyncFailureCheck.kt:75-77`, `SyncFailureKeys.kt:29-31`).
  - The same for `FUTURE_TIME_CLAMPED`.

### Phase 3 — the rule goes live (server code with the gate still off, then the flip)

| Step | What | Files | Failing-first test | Effort |
|---|---|---|---|---|
| 3.1 | APPLY skips the clock (F3); A1 (F5); the future clamp for gated builds and its filing; deletes decided by the six rows; the applied answer returns the stored time; every answer at INFO or WARN | `AbstractSyncV2Support.kt:213-349`; `SyncVersionRule.kt:79-103` | `AnApplyIsNeverRefusedByTheClockTest`; `SyncVersionRuleTest` (the A1 rows, the nil caller); `AFutureTimeIsClampedAndFiledTest`; `ADeleteCarriesItsVersionTest`; `SyncConflictContractTest` (server) | 3–4 d |
| 3.2 | A per-device percentage in the gate (hash of `X-Device-Id`, 0–100), beside `enabled` and `min-app-version-code` | `SyncVersionRuleGate.kt:24-38` | `SyncVersionRuleGateTest` | 0.5 d |
| 3.3 | The flip (§6) | `.env.prod` + recreate `app` | — | 0.5 d + a week of watching |

### Phase 4 — the clock only for base 0 and old builds

Not planned here: it waits for old builds to leave (0042).

---

## 6. Rollout gates and the kill switch

- **The switch.**
  - `sync.version-rule.enabled` (default `false`), `sync.version-rule.min-app-version-code` (default
    `Int.MAX_VALUE`) and, new, a device percentage.
  - A half-configured switch changes nothing (`SyncVersionRuleGate.kt:19-21`).
  - The caller's build comes from `X-App-Version-Code`, which the app has sent since 1.4.2
    (`SyncApi.kt:142-145`, `AbstractSyncV2Support.kt:103-108`).
- **Old builds stay on the clock rule for ever.** They fall below `min-app-version-code`, and every
  record a phone sends with `version = 0` is decided by the clock too.
- **The flip**, in order:
  1. Phase 3 code live with the gate off.
  2. The phase 2 build on production phones.
  3. The 1b.4 shadow counts from those phones, over ≥ 7 days and ≥ 500 samples:
     - RESYNC near 0, which is what the reset (§3.1) promises;
     - CONFLICT close to the multi-device accounts;
     - no APPLY the clock would have refused that nobody has explained.
  4. `enabled=true`, min code = the phase 2 build, percentage 10 → 50 → 100, 24 h per step.
- **Kill switch:** `enabled=false` and recreate `app` (about 30 s). Every build goes back to the
  clock. Nothing is lost: a phone that merged has already written its merged copy, and the clock
  accepts a merged copy (its time is the later of the two). Rehearse it once at 0 %.
- **Deploy rules** (`sync.md` rule 10): phase 1b and 3.1 carry no migration.
  - `stage` is production.
  - Never retry an older pipeline once a newer one has deployed.
  - Don't deploy while the owner is testing.

## 7. Measurement — before and after each phase (queries in Appendix A)

| Phase | Measure (per user-active device, 6 h and 24 h after, date-ranged) | Before (2026-09-12) | Passes when |
|---|---|---|---|
| 1b | Re-sent-copy rows per table (Appendix A.1); T1's no-write counter (1b.4e) | products 58, businesses 27, clients 107 over 7 days; business `216182a3` +1 in 18 min with no edit (§2a) | an unchanged copy no longer moves `version` or `last_synced_at`, while the counter shows the phones still sending |
| 1b | STALE_CONFLICT per user-active device (A.2) | 12 devices of 493, 29 h | **unchanged** (proof that no decision changed) |
| 1b | Share of applied answers carrying `data.version` | 0 | 100 % (trace sample) |
| 1.4.6 | Re-sent rows written by vc ≥ 102 phones (A.1 joined to the writer's build, A.4) | vc101 phones re-send products (`8298ede7`, `f9696aad`, `d5903654`) | 0 |
| 1.4.6 | Duplicate operations per push from vc ≥ 102 (1b.4c) | a vc94 push of 27 CREATEs of one invoice (audit, 2026-09-12) | 0 |
| 1.4.6 | `pull_apply` from vc ≥ 102 | P fixed; the rest as today | no new signature |
| 2 | `push_stale_divergence` from the phase 2 build | today's STALE_CONFLICT-on-update path | 0 (replaced by merges) |
| 2 | `merge_value_replaced` per device | not measured: no report exists | a count, of the order of the multi-device accounts (2 in 30 days) |
| 2 | `last_local_version` on refusal rows equals the server's number | server + 1 debris | equal |
| 3 | Lockouts: STALE_CONFLICT "hours/days behind" on gated builds | 8 device-class rows in 29 h (vc97) | 0 |
| 3 | Answers by kind (shadow → live) | — | the rates the shadow predicted |
| 3 | Future clamps per device | 1.3 % of phone-stamped writes more than 1 min ahead | a counted rate; each clamp filed, never counted on the card |
| every phase | Reconcile drift, `sync_failure` 7-day devices, Hikari pending | the card: CRITICAL, 431 devices, other causes (live read 14:51 UTC) | no new cause |

Three things kept apart in every report:
- **what the data proves;**
- **what the code says;**
- **what is still open.**

## 8. Risks, stated plainly

**Tier 1 — data can be lost:**
- **R1 — The v6 migration opens guests' only copy.**
  - A migration that throws leaves the app unable to open its database.
  - Mitigation: an additive table, plus one `UPDATE … SET version = 0` per table, in the migration's
    transaction; `MigrationTestHelper` on a device (none on this Mac: the lead's or the owner's
    hands); the Robolectric real-Room test; Play's staged rollout (`docs/database-migration-rules.md`
    §0.6).
- **R2 — A merge writes a total nobody computed.** Mitigation: derived fields are recomputed by one
  function (phase 2a, characterised), never merged. And merges run only on a conflict: 2 accounts
  in 30 days.
- **R3 — A parent recomputed from an incomplete set of lines.** Only after the pull, and only once
  the push stops moving the bookmark (2.7). Without 2.7 the recompute must not ship.
- **R4 — Row 2 as built drops an edit after a lost answer (F5).** A1 must be in 3.1 before the flip.
- **R5 — Two phones with one id.**
  - The all-zero iOS id is taken as a writer (F6, fixed in 1b.5).
  - Android backs up `device_uuid_prefs` (`allowBackup="true"`, no rules). A phone restored from
    another's backup can carry that phone's id.
  - A1 bounds the damage to today's later-edit-wins. The 1b.4(d) counter measures it first.
  - Excluding the id from backup would also break the guest proof (`linked_device`) for a guest
    restoring onto a new phone. So measure first, then decide.
- **R6 — The pull writes (T4).** Template and payment-method links are lost silently today, and a
  line deleted here comes back on an equal-time copy (code only, not measured).
- **R7 — T1's projection could hide a real change.** The reflective test in T1 is the guard.

**Tier 2:**
- **R8 — The guarantee is partial until old builds are gone** (0042). An old build still writes by
  the clock, and can overwrite a new build's edit in silence.
- **R9 — The shadow counters reset on every deploy.** Count samples, never days.
- **R10 — The backend suite runs on the production box's CI runner.** It stays within four contexts
  (rule 12). Add tests to existing context classes.
- **R11 — Loki was reported dark on 2026-09-12** (no line after 2026-09-10 23:58 UTC; `sync.md`).
  Read the Health Centre's `log-pipeline` card before trusting an empty trace. Every measurement
  here stands on rows and events, never on log lines alone.
- **R12 — The `Date` header resolves to 1 s.** `syncTimestamp` carries milliseconds. Same-field ties
  within about 1 s between two phones may go either way. Those are the same person's two edits,
  seconds apart.

## 8a. The split by release, with effort

| Piece | Where | Release | Depends on | Effort |
|---|---|---|---|---|
| 1b.1–1b.5 | server | now, alone | — | 4.5 d |
| T5, T2, T3, T4a, T4b | app | **1.4.6** | nothing on the server | 5 d |
| 1c (the card and the ingest for the new reports) | server | before the phase 2 release | 1b | 1 d |
| 2a | app | first on the phase 2 branch | — | 2–3 d |
| 2.1–2.10, T4c | app | the release after 1.4.6 | 1b live, 2a | 17–19 d + a device |
| 3.1–3.2 | server | any time after 1b, gate off | — | 3.5–4.5 d |
| 3.3 (the flip) | config | after the phase 2 build spreads | 3.1, shadow counts | 0.5 d + a week |

**Total:** about 34–38 working days across both repositories. About 5 of them fit 1.4.6.

## 9. Owner decisions

1. **T5 in 1.4.6.** Four kinds of record are re-sent on every push after one edit (a business last
   edited on 09-08 is still being written today, at version 111). The fix is small: 1–1.5 days.
   **Recommended: yes.**
   - *Roman Urdu:* "4 qisam ke records aik edit ke baad har push par dobara jaate hain. 1.4.6 mein band
     karein? Mashwara: haan."
2. **An identical copy is answered "already here", even when its time is older.** Today the answer is
   "refused". It is the truthful answer, and it would end the retry noise for every build. Count it
   for a week first (1b.4b), then switch. **Recommended: yes, after the count.**
   - *Roman Urdu:* "Jo slip server par pehle se hai, uska jawab 'rad' ke bajaye 'pehle se mojood'. Pehle
     aik hafta ginti. Mashwara: haan."
3. **The first piece of the pull-bookmark fix rides with the receipt number** (the owner's item 2,
   one line). The invoice-total recompute needs every line from the other phone. **Recommended:
   yes.**
   - *Roman Urdu:* "Aap ki list ka #2 (pull bookmark) ka pehla chhota hissa #1 ke saath aaye, kyun ke
     invoice ka total dobara ginne ke liye doosre phone ki saari lines chahiye. Mashwara: haan."
4. **Amend 0042's row 2 (A1).** When the server's receipt answer is lost and the user edits again,
   today's rule would keep the older copy on the server. **Recommended: yes.**
   - *Roman Urdu:* "Agar server ki rasid raste mein gum ho jaye aur user dobara edit kare, to naya edit
     server tak nahi pohanchta. Fix: phone ki apni do edits mein jo baad ki ho woh jeete. Mashwara:
     haan."
5. **0057 (re-send the given-up edits once) moves to the release after 1.4.6.**
   - Its text says "the release after 1.4.5", which is 1.4.6.
   - Only the receipt number answers "did another phone change it since" exactly.
   - **Recommended: yes.**
   - *Roman Urdu:* "Chhori hui edits dobara bhejne wala kaam 1.4.7 mein, rasid number ke saath, taake
     pakka pata ho kisi aur phone ne badla ya nahi. Mashwara: haan."

## 10. Technical choices made in this plan

Each of these is to be logged as one decision entry, with what was rejected, once the owner answers
§9:
- `version` = the server's number or 0; the one-time reset (§3.1).
- The base snapshot table and its ten-row lifetime (§3.2).
- "Changes nothing" means the content and the deleted flag. The edit time alone is not content, so an
  identical copy with a new time is also no change, and keeps its number (T1).
  - ~~and the stored time stays at the last real change~~ **Corrected by 0067:** its time is still
    stored, as before. The clock judges every later copy against the stored time, so holding it back
    changed later answers: `AnUpdateKeepsTheDeviceTimeTest` caught an older copy being accepted.
- The clock offset from `syncTimestamp`, with the `Date` header as a fallback (§3.5).
- The clamp's report threshold of 2 s (§3.7).
- The bound of 2 merges per cycle, plus a lifetime guard of 10 (§3.3).
- A per-device percentage in the gate (3.2).
- T4's order, and its cut between 1.4.6 and the next release.

## 11. Open, and not in this plan

- **A full pull never carries deletes** (F2). This is structural fix 2.
- **One bad record sends the whole push back** (S1). This is structural fix 3.
- **Per-field edit times** (0058 step 3): only if `merge_value_replaced` shows the per-record time
  misjudges. That needs a server schema change and the owner's OK.
- **Why a product reaches v95 with a fresh edit time** (`fc327c04`, and others near v50–90). It is
  not F1's shape: the edit time moves. Frequent real edits, or an app path that re-saves products on
  every invoice save? Look before phase 2.
- **iOS:** `IosDeviceIdProvider` returns zeros. Until it is fixed, every iPhone is "unknown" to the
  rule, which is the safe direction, at the cost of a CONFLICT round trip.

---

## Appendix A — queries (read-only; run with `ssh -i ~/.ssh/invotick_ro … 'mysql -uroot invotick_prod'`)

A.1 Re-sent copies, per table, for rows written in the window:
```sql
SELECT COUNT(*) written, SUM(version >= 10) v_ge_10, MAX(version) max_v,
       SUM(TIMESTAMPDIFF(MINUTE, updated_at, last_synced_at) > 60 AND version >= 5) resent_like
FROM inventory_items WHERE last_synced_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY;
-- the same for businesses, clients, invoices, invoice_items, estimates, estimate_items, merchants, expenses
```

A.2 STALE_CONFLICT devices since a deploy, by build and by how far behind:
```sql
SELECT app_version_code,
       CASE WHEN reason REGEXP 'behind by [0-9]+ms' THEN 'ms' WHEN reason REGEXP 'behind by [0-9]+s' THEN 's'
            WHEN reason REGEXP 'behind by [0-9]+m' THEN 'min' WHEN reason REGEXP 'behind by [0-9]+h' THEN 'h'
            WHEN reason REGEXP 'behind by [0-9]+d' THEN 'd' ELSE 'create/other' END gap,
       COUNT(DISTINCT device_id) devices
FROM sync_failure
WHERE error_type = 'STALE_CONFLICT' AND source = 'BACKEND' AND last_seen_at >= '<deploy UTC>'
GROUP BY app_version_code, gap;
```

A.3 User-active devices by build (the denominator):
```sql
SELECT app_version_code, COUNT(DISTINCT app_instance_id)
FROM analytics_events
WHERE created_at >= '<window start UTC>' AND event_name IN ('app_cold_start', 'app_foreground')
GROUP BY app_version_code;
```

A.4 The writer's build, for a short list of writers:
```sql
SELECT app_instance_id, MAX(app_version_code)
FROM analytics_events
WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 3 DAY AND app_instance_id IN (<BIN_TO_UUID(last_modify_by) values>)
GROUP BY app_instance_id;
```

A.5 Accounts with two or more writing phones (the merge's reach):
```sql
SELECT COUNT(*)
FROM (
  SELECT user_id
  FROM (
    SELECT user_id, last_modify_by FROM invoices WHERE last_synced_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY
    UNION ALL
    SELECT user_id, last_modify_by FROM invoice_items WHERE last_synced_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY
  ) w
  WHERE last_modify_by IS NOT NULL
    AND last_modify_by <> UUID_TO_BIN('00000000-0000-0000-0000-000000000000')
  GROUP BY user_id
  HAVING COUNT(DISTINCT last_modify_by) >= 2
) t;
```

A.6 Phone times ahead of their arrival (for the clamp):
```sql
SELECT COUNT(*),
       SUM(updated_at > last_synced_at + INTERVAL 60 SECOND),
       SUM(updated_at > last_synced_at + INTERVAL 1 HOUR)
FROM invoices
WHERE last_synced_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
  AND MICROSECOND(updated_at) % 1000 = 0;
```
