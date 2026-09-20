# 0128 — A payment method deleted on the phone reaches the server

**Status:** built on both sides, **nothing deployed, nothing released**. **The owner's question is answered — settled, do not reopen.**
**Date:** 2026-09-20.
**Follows:** [0125](0125-a-sync-failure-is-still-only-a-refusal-and-it-is-counted-once.md)'s handover,
[0068](0068-a-client-is-deleted-like-every-synced-record.md) (the same shape, for clients),
[0060](0060-a-pull-never-deletes-a-row.md) (T4a),
`.claude/agents/sync.md` rules 14 and 20.

---

## What the data says

Read-only from production, 2026-09-20.

| | |
|:--|--:|
| Payment methods on the server | **240** |
| …ever deleted (`is_deleted = 1`) | **0** |
| …named by a live invoice | 59 |
| …named by a live estimate | 1 |
| …named by a live payment | 34 |
| **…in use, any of the three** | **83** |
| …named by nothing | 152 |
| Accounts owning a payment method | 187 |
| …owning more than one | 31 |
| Accounts with two or more live devices **and** invoices naming a payment method | **2** (9 invoices) |

Not one payment method has ever been deleted on the server, while the app has offered a delete button —
single and multi-select — the whole time. This is exactly the shape the client delete had before 0068:
5 of 6,027 clients deleted, every one by the web, none by a phone.

## Why it happened

`PaymentInstructionRepositoryImpl.deletePayment(id)` and `deletePayments(ids)` — the two the Payment
methods sheet calls (`PaymentListViewModel.deleteSinglePayment`, `deleteSelectedPayments`) — soft-deleted
the local row and **queued nothing**. They set no `syncState` either, so
`SyncOrphanDao.orphanPaymentInstructions`, which reads `PENDING_CREATE|PENDING_UPDATE|PENDING_DELETE` rows
only, could not catch them afterwards. The delete was silent on both paths, and invisible to the net that
exists for exactly this.

`softDeletePayment` — the one that does queue — has no caller.

**What the user saw:** the payment method vanished from this phone. On the server, and so on every other
device and after any full pull, it was still there.

## The order: the server half first

A phone stores an invoice only when it holds the payment method the invoice names —
`invoices.paymentMethodId`, `estimates.paymentMethodId` and `payments.paymentInstructionId` are each a
foreign key in its Room schema. The full pull sent **live** payment methods only.

So shipping the app half alone would give a second phone an invoice naming a payment method the pull can
never send: up to 1.4.5 the invoice cannot be stored at all, and on 1.4.6+ it is a missing-reference report
on every pull. That is class P and the 0068 family repeating.

`f8a6722` already closed this for deleted businesses and products, and `798843e` for clients. Payment
methods and templates were the two left out.

## What changed

### 1. Backend (ships first)

`SyncV2PullService.fullPull` now also sends this account's **deleted** payment methods that an invoice,
estimate or payment it is sending still names, as deleted rows — read from the rows being sent, the same
shape as `f8a6722`. A deleted payment method sent this way brings its business with it (it is read before
the businesses block). Never another account's: `findByUserAndIsDeletedTrueAndIdIn` reads only this
account's deleted rows. The delta pull is unchanged — it already sends every payment method deleted since
its cursor, used or not.

**No migration.** Rows touched: what the full pull already reads, plus one primary-key lookup for the named
payment methods not already sent live, and no query at all when there are none.

Because no payment method has ever been deleted, this changes nothing for anybody today. That is the point:
it is the half that must be live before the app's delete can ship.

### 2. App (ships after, in a release)

- The delete is a soft delete **plus a queued DELETE under the row's own owner**. The soft delete and the
  read of that owner are one transaction (`PaymentInstructionDao.softDeleteHere`), and the row is left
  `PENDING_DELETE`, so a process killed before the queue row is written leaves a delete the orphan scan
  sends before the next push. A shared default is refused by the queue itself (`SEEDED_ID_PREFIX`).
- A **pulled** delete uses `markDeletedByServer` (SYNCED). Written as a delete made here it would be
  `PENDING_DELETE`, and the phone would send the server its own delete back — the bug
  `ClientDao.markDeletedByServer` fixed for clients.
- A deleted payment method **this phone never held** is kept, deleted and SYNCED
  (`PaymentInstructionSyncHandler.applyServerDelete`), like a deleted business, client, product or terms.
  Dropped, as it was, it costs every document naming it.
- **One behaviour change worth naming:** a delete made here and not yet sent is now unsent work, so a later
  edit on another phone no longer silently revives the row and erases the delete. It travels, and the
  server decides — as a client's delete does. Both shapes are covered as separate cases.

## The owner's answer (2026-09-20) — settled, do not reopen

**His words, verbatim:**

> "Payment method ager kisi invoice per use hy and usky baad delete krain to invoice my wo payment method
> delete nhi hona chahiye, and payment method bhi aik soft delete ky tour per hoga."

So, decided:

1. **A payment method in use may be deleted.** It is **not** refused by name the way a client is (0068).
   There is no `PaymentMethodInUseException` and there must not be one.
2. **The delete is always a soft delete** — the row stays, marked deleted, everywhere.
3. **An invoice that already carries that payment method keeps showing it.** A list must hide it; a
   document that already uses it must not lose it.

He was shown the numbers before answering: 83 of the 240 in use (59 live invoices, 34 payments, 1
estimate), 152 named by nothing, 31 accounts owning more than one.

### Every render path, checked against the code

A phone stores and renders a document only when it holds the payment method it names —
`invoices.paymentMethodId`, `estimates.paymentMethodId` and `payments.paymentInstructionId` are each a
foreign key in the Room schema, and each is `ON DELETE SET NULL`.

| Where an invoice is rendered | Reads the payment method through | Filters `isDeleted`? | Still shows it |
|:--|:--|:--|:--|
| Saved-invoice screen (`SaveInvoiceViewModel:1010`) | `getInvoiceWithDetailsById` → `InvoiceWithRelations.@Relation` → mapper | **no** | **yes** |
| Preview screen (`PreviewInvoiceViewModel:688`) | the same | **no** | **yes** |
| Edit screen (`EditInvoiceViewModel:199`) | the same; `updatePaymentInstructions` only ever runs on the user's own pick | **no** | **yes** |
| Offline HTML bundle | `buildInvoiceSnapshot(paymentInstructions = …)`, filled from that same `paymentInstruction` | **no** | **yes** |
| PDF / download / share image | built from the same snapshot | **no** | **yes** |
| Online render (`/embed/render`) | `GET /api/shared-invoice/{token}/snapshot` — the **stored** snapshot | n/a, frozen | **yes** |
| Public share page `/i/{token}` | `shared.snapshot`, the stored JSON | n/a, frozen | **yes** |
| Server REST / webpanel invoice reads | `invoice.paymentInstruction`, a plain JPA `@ManyToOne` | **no** | **yes** |
| Estimates, everywhere | `EstimateWithRelations.@Relation` on `paymentMethodId` | **no** | **yes** |
| **Payment-method picker list** (`getAll`, `getPaymentInstructionsForBusiness`, `searchPaymentInstructionsForBusiness`, `hasPayments`) | their own queries | **yes — `isDeleted = 0`** | **no, correctly hidden** |

A **frozen share snapshot is unaffected by construction** (invariant 4): `shared_invoice.snapshot` is JSON
written at share time and never re-resolved, so a later delete cannot touch an already-shared link.

### The soft delete, named exactly

| | Table | Columns |
|:--|:--|:--|
| Phone | `payment_instructions` | `isDeleted = 1`, `dateDeleted`, `syncState = 'PENDING_DELETE'` |
| Server | `payment_instructions` | `is_deleted = 1`, `deleted_at`, `version + 1`, `last_synced_at` |

Neither side removes the row. `PaymentInstructionSyncV2Service.deleteFromSync` sets the flags and saves;
there is no `DELETE FROM payment_instructions` anywhere in the backend.

**One thing changed for this:** `PaymentInstructionDao.delete(entity)` and `deleteByIds(ids)` were declared
on the phone and **never called**. They are removed. A hard delete there fires `ON DELETE SET NULL` on all
three links and strips the payment method off every document that used it, in silence — five such paths are
exactly what broke client deletes before 0068. The DAO now has no hard delete at all, and
`aHardDeleteWouldStripThePaymentMethodOffItsInvoice` shows on real SQLite why.

### A phone that only ever receives the deleted row

`PaymentInstructionSyncHandler.applyServerDelete` keeps it, deleted and SYNCED, so the invoice naming it can
be stored and rendered. Guarded by `anInvoiceShowsAPaymentMethodThisPhoneOnlyEverReceivedDeleted`.

## Rejected

- **Shipping the app half first, or alone.** It is the whole reason 0125 handed this over as a task with an
  order rather than a one-line fix. See above.
- **Refusing the delete of a payment method in use,** the way a client is refused (0068). Proposed, and the
  owner said no on 2026-09-20 — an account with a single payment method that one invoice used could then
  never remove it. **Do not re-propose this.**
- **Clearing the link on the document** when its payment method is deleted. The owner's answer forbids it in
  as many words.
- **A hard delete.** Same answer, and it silently nulls all three links.
- **Setting `syncState` in the shared `softDelete` and leaving the pull to use it.** That is how the phone
  came to send the server its own delete back for clients; the pull gets `markDeletedByServer` instead.
- **Queueing outside the transaction with no `PENDING_DELETE` mark.** That is what made the original defect
  unrecoverable: with no state on the row, a lost queue row is a delete nobody can ever find again.
- **Fixing deleted templates in the same change.** The full pull leaves them out too (the other half of
  what `f8a6722` missed), but templates are already `PENDING_DELETE` on delete and reach the server today.
  It is a separate, smaller task; noted here so it is not lost.
- **Repairing anything on the server.** Nothing is wrong there — the deletes simply never arrived. Once the
  app half is released, the phones send them.

## Evidence

- Backend: `fix/full-pull-sends-deleted-payment-methods` @ **`0e84fac`** (from `stage` `0fd4e3f`), pushed.
  Guard: 3 new cases in `AFullPullSendsTheDeletedParentsItsRowsNameTest`; **2 failed first** (no payment
  method sent at all, and the deleted business a deleted payment method names never arriving); the
  other-account case and the delta case pass before and after — they are what must not change.
  Full suite **1233/1233**. `0e84fac` adds the owner's-rule guard: a deleted payment method keeps its row,
  and the invoice, estimate and payment that used it all still name it.
- App: `fix/147-a-deleted-payment-method-reaches-the-server` @ **`f51d81ca`**, based on
  `fix/147-sync-failed-only-real-refusals` (`d1d2bf40`, which already touches payment-method ownership — so
  no conflict), pushed, not merged. Guards: `ADeletedPaymentMethodReachesTheServerTest` (9 cases; **6
  failed first** and the `applyServerDelete` case **did not compile**, naming exactly what the code adds;
  the 3 that passed are what must not change) and 2 new cases in
  `APulledTemplateOrPaymentMethodNeverDeletesItsRowTest`. `f51d81ca` adds the owner's-rule guards (6 cases)
  and removes the two unused hard deletes. `:data:testDebugUnitTest` **350/350** (baseline 333);
  `:composeApp:compileDebugKotlinAndroid` and `:composeApp:compileKotlinIosSimulatorArm64` both pass.
- The owner's-rule guards pin behaviour that was **already right**, so they pass before and after. Proved
  they bite: filtering the deleted row out in `InvoiceWithRelationMapper`
  (`paymentMethod?.takeIf { !it.isDeleted }`) makes `anInvoiceStillCarriesThePaymentMethodAfterItIsDeleted`
  fail. The probe was reverted.
- No migration on either side. No version bump. Nothing deployed.

## Not under the Payments hold

`memory/payment-form-review-postponed.md` holds everything tied to **payments** — the receipts entered on
the Payments screen. A **payment instruction** is the payment method saved on an invoice: a different table
(`payment_instructions`), a different screen. This work is not under that hold.
