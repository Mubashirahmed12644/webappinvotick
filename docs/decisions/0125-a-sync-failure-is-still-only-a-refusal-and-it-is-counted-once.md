# 0125 — A sync failure is still only a refusal, and it is counted once

**Status:** **decided by the owner, 2026-09-20 — all three questions answered (see "The owner's answers" below).**
Built on the app branch `fix/147-sync-failed-only-real-refusals` (off `VC_107_VN_147`), pushed, not merged, not
released; it ships with the next app release. `:data:testDebugUnitTest` **333/333**; Android and iOS-simulator
compiles pass. No schema change, no version bump, no backend change, nothing to deploy.

**Asked by the owner, 2026-09-20:** *"sync failed ko check kero ky wo keon failed howa hy; ager isko fix ker sakty hain
to fix kero, aur ager nahi to sari confirmation ky baad is case ki reporting band kero."*

**Related:** 0029 (a reported failure is an attempt the server refused), 0050 (the evidence net), 0059, 0060, 0065,
0067, 0108; sync agent rules 1, 3, 7, 8.

## Where the question came from

One real device: Invotick ID 903623205, user `35697a2d`, phone `b8270c82`. Its `sync_failed` rows, 22 Aug – 20 Sep,
read back from `analytics_events` (`app_version_code`, not the dump's guesswork):

| When | Build | Stage | What it was |
|:--|:--|:--|:--|
| 09-06 | **94** (1.4.2) | `queue_enqueue_no_owner`, `queue_ownerless` | a product's delete queued with no owner |
| 09-06 | **94** | `push_stale_divergence` + `push_non_retryable` | one refusal of one client, counted twice |
| 09-06, 09-11, 09-13, 09-14 | **94** and **97** (1.4.4) | `push_failed`, `pull_failed` | the phone had no network |

**It is not on the shipped build.** Nothing it sent came from 1.4.5 or later. That matters for every class below.

## Class A — the ownerless queue (the product delete)

**What happened.** The delete is handed a product id alone. The repository queued it with `""` as the owner, and both
the queue (`getPending`) and the orphan scan read an exact `userId`, so the row was invisible to both.

**Nothing was lost.** The queue adopts an ownerless row before every push (`adoptOwnerlessOperations`), which is the
second row, 31 ms later. Read from production: the product (`82d3a411`) was created on the server 09-06 00:20 UTC,
the user deleted it on the phone at 00:30 UTC, and the server's row is deleted at **09-09 00:55:40 UTC, by that same
phone**. Three days late — the phone was offline for most of them — but it arrived.

**Already fixed, and production agrees.** `7da77038` shipped in 1.4.5: the delete is queued under
`ProductDao.ownerOf(id)`. 30 days to 2026-09-20: `product/DELETE queued without a userId` is **135 rows on 49 phones,
every one of them build 94 or 97, and zero on 101, 105 or 106**.

**What is still live, and is fixed here: the payment method.**

- `PaymentInstructionRepositoryImpl.updatePayment` rebuilt the row from the screen's own object, which carries no
  owner, and the copy it wrote did not carry the stored owner across. So the **first** edit set
  `payment_instructions.userId` to NULL, and the **next** edit queued its UPDATE with no owner.
- A blanked row is invisible to the orphan scan too (`SyncOrphanDao.orphanPaymentInstructions` reads `userId`), so the
  net that exists for a record whose queue row was lost cannot see it.
- `softDeletePayment` queued its DELETE with a hard-coded `""`.
- 30 days: 6 rows on 5 phones, on builds ≥ 101. It is the only ownerless enqueue left on a current build.

**The fix:** the edit keeps the owner the stored row has (falling back to the signed-in user, which repairs a row
already blanked), and the delete is queued under `PaymentInstructionDao.ownerOf(id)`, exactly as a product's is.
Guard: `APaymentMethodKeepsItsOwnerTest` (3 of 3 failed first).

**Still open, not changed here — the owner agreed it is a task of its own (handover at the end).** `deletePayment` and
`deletePayments` for payment *methods* queue
nothing at all, so a payment method deleted on a phone never reaches the server. Proof: **240 payment instructions on
the server, 0 deleted, ever.** Fixing it needs a server half first, or a full pull will hand a phone an invoice naming
a payment method it will never be sent (the lesson of 0068 and rule 20).

## Class B — the STALE_CONFLICT after the share

**It was not the share, and it was not an invoice.** `315e8a2d` is a **client**. The server's row was written at
`00:53:33.668225` — microsecond precision, so the server's own clock — by **that same phone**, version 2.

**It is the clock bug, rule 3, from before 2026-09-11.** The phone's edit at 00:46:01 was pushed and applied; the
server stamped `now()` instead of the device's time; the same copy went again 44 seconds later and was refused as
"older than server state, behind by 7m". The server halves (`4267db5` creates, `6859b42` updates) went live on
2026-09-11. Production reads the same way: `push_stale_divergence` ran 104–308 rows a day on 68–87 phones up to
09-11, and 0–9 a day on builds 94/97 after it, with the remaining spikes on two or three phones.

**The user lost nothing here.** The client is version 2 and the writer is this phone: the server holds this phone's
own edit. And when a copy really is refused, nothing local is overwritten — `NonRetryablePass` stops the retries and
leaves the phone's row exactly as the user left it.

**What is fixed: one refusal is one row.** STALE_CONFLICT is on the non-retryable list as well, so
`NonRetryablePass.settle` stopped and reported the same answer twice — once as `push_stale_divergence`, once as
`push_non_retryable`. 30 days on builds ≥ 101, the pairs match exactly: 206/206 products, 70/70 invoice lines, 21/21
invoices, 12/12 clients, 7/7 estimates, 1/1 template. A stale **CREATE** was counted as dropped work too, although the
code had just queued it again as an UPDATE — 360 rows, 319 of them one account's estimates.

`resolveStaleConflicts` now returns what it settled, and the loop skips it. 0029's last open line is closed. Guard:
`OneRefusalIsOneReportTest` (3 of 4 failed first; the fourth is what must not change).

## Class C — the offline rows

**They are pure network, and 0029 already covers them — this phone is on an old build.** `NotASyncFailure` shipped in
**1.4.5** (`1b66e30c`, `e6f4eab0`), and it is in every release since. Production, 30 days: on builds ≥ 101 **not one**
`push_failed` or `pull_failed` carries "Unable to resolve host", "Software caused connection abort" or any other
network wording. On 94 and 97 there were 6,506 such rows on 807 phones in the last 7 days alone. Only an update fixes
those, and the server's card already sets them aside (0029's addendum).

**One place the rule never reached, and it is on the shipped build: `guest_auth`.**

- `SyncManager.reportGuestAuthFailure` was written before the rule existed and never asked it.
- `GuestSignInFailed` carries the class of what threw as a **name** in its evidence, not as a cause (0065), so walking
  the causes could not see `UnknownHostException` either.
- 7 days to 2026-09-20 on builds ≥ 101: **364 of 379 `guest_auth` rows are "Network connection failed"**, from **118
  phones** — `UnknownHostException`, `ConnectTimeoutException`, `ConnectException`, `SocketException`,
  `SocketTimeoutException`, `HttpRequestTimeoutException`.

**No harm, proved before switching it off.** Of those 118 phones, **113 have a row on the server** by the end of the
window — the sign-in succeeded once the network came back. The other 5 each sent their **last** event of any kind
within four minutes of the failure: they went away, they did not keep working while stuck.

**What is fixed.** The report lives in its own class, `GuestAuthFailures`, and asks the one rule. **The recovery does
not change at all:** the attempt is still counted, the sign-in is still retried on every sync and on reconnect, and a
guest still without a server row after 3 attempts still raises the backup-blocked flag. Only the `sync_failed` row
goes. A refusal the server actually sent (403, 401, a TLS failure) is still reported with its `request_id` and
`http_status`. Guards: `AGuestSignInThatNeverReachedTheServerIsNotAFailureTest` (3 of 4 failed first).

## The numbers

7 days, 2026-09-13 → 2026-09-20, read-only from production.

| | Rows | Phones |
|:--|--:|--:|
| All `sync_failed` | 38,258 | 1,197 |
| …on builds ≥ 101 | 29,786 | 345 |
| …of which `push_gather` "Product: local row missing" — **already fixed in 1.4.7** (0108, `e97bacd0`) | 26,497 | 14 |
| **The comparable remainder on a current build** | **3,289** | |
| Removed here: `guest_auth` network | 364 | 118 |
| Removed here: the duplicate `push_non_retryable` on a stale UPDATE | 318 | 12 |
| Removed here: a stale CREATE counted as dropped | 360 | 10 |
| Removed here: the ownerless payment method | 6 | 5 |
| **Remaining after this change** | **~2,241** | |

So on a phone carrying this build, about **32%** of the rows that arrive today stop arriving, and none of them was a
user losing anything. Old builds (94, 97) keep sending their 6,506 network rows a week until they update.

## Rejected

- **Filtering these rows on the server or in the panel instead.** The phone would still be doing the work and the card
  would still have to explain itself. 0029 already rejected this once.
- **Dropping the stale-conflict class altogether.** A genuinely divergent copy is a record the server and the phone
  disagree about, and it is the only thing that makes that visible. One row, not two.
- **Not reporting `guest_auth` at all.** A guest whose sign-in the server refuses has data living in exactly one place;
  that row is the only sign of it.
- **Keeping the backup-blocked flag off for a network failure.** A guest with nothing on the server is a fact whatever
  the cause.
- **Making the payment method's delete reach the server today.** It needs the full pull to send a deleted payment
  method that a live invoice names, or a phone doing a full pull gets an invoice pointing at nothing (rule 20).
- **`git stash` to prove the tests red.** It is shared across worktrees; the diff was saved as a patch, the code
  reverted, the tests run (9 of 11 failed), and the patch re-applied.

## The owner's answers (2026-09-20) — settled, do not reopen

**1. Offline reporting: CONFIRMED, stop counting it.** A phone with no network, and a guest sign-in that never
reached the server, are no longer counted as sync failures. This is 0029 applied to the one path it had never
reached, not a new exception to it.

**The evidence he was given, and on which he confirmed — written here so a later session does not ask again:**

- Of the **118 phones** that sent a network-worded `guest_auth` row in the 7 days to 2026-09-20 on builds ≥ 101,
  **113 have a row on the server**: the sign-in succeeded by itself once the network came back.
- The other **5** each sent their **last event of any kind** within **four minutes** of the failure. They closed the
  app; none of them kept working while stuck.
- On builds ≥ 101, **not one** `push_failed` or `pull_failed` in 30 days carried network wording — the rule has been
  right there since 1.4.5, and nobody has lost anything under it.

**What deliberately does not change**, and must not be removed later by someone reading only the headline:

- the attempt is still counted (`GUEST_AUTH_RETRY_COUNT`);
- the sign-in is still retried on every sync and on reconnect (`GuestAuthRestorer`);
- a guest still without a server row after `GuestAuthFailures.ALERT_AFTER` (3) attempts **still raises the
  backup-blocked flag** — the owner's warning stays;
- a refusal the server actually sent — 401, 403, a TLS failure — is still reported, with its `request_id` and
  `http_status` (0050, 0065).

**2. Old builds: leave them.** 1.4.2 and 1.4.4 keep sending their offline rows — 6,506 a week from 807 phones —
until those phones update. Nothing is added server-side to suppress them: the Device sync card already sets them
aside (0029's addendum), and they are the only answer we have to "how often are our users offline when they try to
sync?". Rejected again: deleting them at ingest.

**3. The payment-method delete: agreed as a separate task, not started.** Handover below.

## Handover — a payment method deleted on a phone never reaches the server

**Not started. Agreed by the owner on 2026-09-20 as a task of its own.** Everything a cold session needs:

### What is broken

`PaymentInstructionRepositoryImpl.deletePayment(id)` and `deletePayments(ids)` soft-delete the local row
(`paymentDao.softDelete`) and **queue nothing**. They set no `syncState` either, so `SyncOrphanDao.orphanPaymentInstructions`
— which only looks at rows whose state is `PENDING_CREATE`/`PENDING_UPDATE`/`PENDING_DELETE` — cannot catch them
afterwards. The delete is silent on both paths.

These are the two the UI calls: `PaymentListViewModel.deleteSelectedPayments` (line ~329) and `deleteSinglePayment`
(line ~388), through `PaymentInstructionUseCases`. `softDeletePayment` — the one this branch fixed to queue under the
row's own owner — has **no caller** today, so fixing its owner was correctness, not a behaviour change.

### The numbers

- **240 payment instructions on the server. `is_deleted = 1`: 0. Ever.** (`SELECT COUNT(*), SUM(is_deleted=1) FROM
  payment_instructions;`, read-only, 2026-09-20.)
- This is exactly the shape of the client delete before 0068: 5 of 6,027 clients deleted, all by the web, none by a
  phone.

### Why the server half must come first

A payment method that a live invoice or payment names must never disappear from the pull while the document that
names it is still being sent. That is rule 20's lesson (0068, `798843e`, `f8a6722`): the full pull already sends the
deleted **clients**, **businesses** and **products** that a sent row names, as deleted rows — but **not** deleted
payment methods or templates. `AFullPullSendsTheDeletedParentsItsRowsNameTest` covers business and product only.

So the order is:

1. **Backend.** The full pull sends each deleted payment instruction that a row it is sending names
   (`invoices.paymentMethodId`, `estimates.paymentMethodId`, `payments.payment_instruction_id`), read from the rows
   being sent — the same shape as `f8a6722`. Extend `AFullPullSendsTheDeletedParentsItsRowsNameTest`. No migration.
2. **App.** `deletePayment` / `deletePayments` soft-delete **and** queue a DELETE under the row's own owner
   (`PaymentInstructionDao.ownerOf(id)`, already added on this branch), in one transaction with the soft delete, as
   `ClientDao.softDeleteUnlessInUse` does. A guard test in the shape of `ADeletedClientReachesTheServerTest`.

### The risk to a second device, if the order is reversed

Ship the app half alone and a second phone doing a full pull gets an invoice naming a payment method the pull will
never send. On builds up to 1.4.5 the row is dropped and the invoice cannot be stored at all; on 1.4.6+ it becomes a
missing-reference report on every pull. That is class P and the 0068 family repeating.

### An open question for the owner when it is picked up

Whether a payment method **in use** — named by a live invoice, estimate or payment — may be deleted at all, or is
refused by name as a client is (0068's `ClientInUseException`, which was his rule, not ours). Do not decide it in
code.

### Not related to the Payments hold

`memory/payment-form-review-postponed.md` holds everything tied to **payments** (the receipts entered on the Payments
screen). A **payment instruction** is the payment method saved on an invoice — a different table
(`payment_instructions`), a different screen. This task is not under that hold; say so when raising it.
