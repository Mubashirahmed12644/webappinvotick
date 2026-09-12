# 0060 — A pull never deletes a row, and a delete made here is the row's latest change

**Status:** decided by the sync owner, under the owner's word that class P is fixed in this batch
(2026-09-11) and "pending work start kro apni tarteeb sy" (2026-09-12).
- Built for 1.4.6 (`f538e08e`) and merged into `VC_102_VN_146`. Not released yet.
- Extended 2026-09-13, also merged into `VC_102_VN_146`:
  - templates and payment methods (T4a, `0fa7e977`);
  - L7 in all 21 pull handlers (T4b, `d8282c14`).

  The other 18 handlers still insert with REPLACE rather than ABORT; that remains T4c.

**Date:** 2026-09-12 · **Goal:** G3 · **Related:** [0042](0042-the-server-owns-the-version-and-the-device-merges.md),
[0059](0059-a-delete-of-a-record-the-server-does-not-hold-is-not-a-sync-failure.md), contract
[L6 and L7](../SYNC-CONFLICT-CONTRACT.md), audit classes P and Q.

## What the data says (production, read-only, 30 days to 2026-09-12)

- `pull_apply` "Product: NOT NULL constraint failed: invoice_items.productId":
  - vc94: 466 reports from 2 phones (08-30 → 09-04);
  - vc97: 7 from 3 phones (09-07 → 09-12);
  - vc101: none yet.
- It is class Q showing up on the pull. On `399a4d80` (vc97), 5 product deletes were queued without an
  owner and none reached the server. The server kept those products live, and the phone's pull failed
  on them.

## What the code said (1.4.5, `f9df66ac`)

- `ProductSyncHandler.processFromServer` looked the product up with `getProductById(id, userId)`, which
  reads `isDeleted = 0 AND userId = :userId`. A product deleted on this phone, or one held under an
  earlier owner id, read as "not here".
- It then wrote with `ProductDao.insert`, which is `INSERT OR REPLACE`.
  - REPLACE deletes the row it collides with. The delete fires `ON DELETE SET NULL` on
    `invoice_items.productId` and `estimate_items.productId`. Both are NOT NULL, so the write fails.
  - When no line uses the product, the same REPLACE succeeds. The server's live copy replaces the
    deleted row, and the user's delete is undone on this phone without a trace.

## Reproduced before the fix

- **Real SQLite, the shipped v5 schema (`5.json`):**
  - REPLACE of a product that an invoice line uses: "NOT NULL constraint failed: invoice_items.productId";
  - the same for an estimate line;
  - the upsert shape (INSERT, then UPDATE on the unique failure) succeeds, and the line keeps its product.
- **Real Room on Robolectric, the real handler** (`APulledProductNeverDeletesItsRowTest`):
  - 3 of 5 cases failed with the production message (SQLite code 1299);
  - the unused deleted product came back (`isDeleted` 0);
  - the new-product control passed.

## Decided

1. **A pull decides "new or existing" by the primary key alone:** deleted or not, whoever's
   (`ProductDao.findForPull`). The id is what an insert collides with.
2. **A pull never deletes a row.** It changes an existing row with an UPDATE. It inserts an absent row
   with ABORT (`ProductDao.insertNew`), so a collision fails loudly instead of deleting.
3. **A delete made on this phone is the row's latest change (contract L7).**
   - The row's time is the later of `dateUpdated` and `dateDeleted`, and then L1–L4 decide.
   - So a server copy from before the delete leaves the phone's delete in place.
   - A copy edited on another device after the delete still wins.
   - L6 still protects unsent work first.
4. **No Room schema change.**

## Rejected

- **A Room migration.** The audit line first planned this.
  - *`productId` nullable.* SQLite cannot alter a column, so Room would rebuild `invoice_items` and
    `estimate_items`, which hold the guests' only copy of their invoice lines. The REPLACE would then
    succeed silently: every line using the product would lose its product link, and the deleted product
    would come back. The server requires `inventory_item_id` NOT NULL, so each such line's next push
    would be refused.
  - *The foreign key from SET NULL to NO ACTION.* This is also a table rebuild. The REPLACE would then
    succeed silently, because the parent row is back by the end of the statement, and the deleted
    product would come back.
  - Both options turn a loud failure into silent damage, at Tier 1 risk, for no gain. The
    contradiction in the schema only bites a write that deletes a product still in use, and after this
    change no pull does that.
- **`@Upsert` with the lookup unchanged.** The failure goes, but a deleted product then comes back on
  every pull while its delete is still on its way, because the lookup still cannot see it.
- **"A pull never brings back a row deleted here", whatever the times say.** This is simpler. But a
  copy another device edited after the delete would never come back here, although it lives on the
  server and on every other device.
- **Applying L7 and the id lookup to all 21 pull handlers now.** The same shapes exist elsewhere (see
  below), but nothing measures them yet, while class P is measured. They stay open.

## What the code says, not measured — open

- **Other handlers.** Twenty other pull handlers insert with REPLACE. Where the lookup already reads by
  id alone (invoices, estimates, their lines and others), REPLACE only reaches an absent row and deletes
  nothing.
- **Invoice lines.** A REPLACE of an *existing* invoice would delete every one of its lines (`CASCADE`).
  On the v5 schema, 0 lines were left. No pull path does this today, because the invoice lookup reads
  by id.
- **Resurrection.** The soft deletes of estimates, invoices and lines also leave `dateUpdated`
  unchanged. So a server copy with the same time (L2) brings back, on the phone, a record deleted there
  whose delete has not reached the server yet. L7 fixes that where it is applied.

## Measure after the release

- `pull_apply` "NOT NULL constraint failed: invoice_items.productId" or `estimate_items.productId` from
  versionCode ≥ 102 should be 0.
- The fingerprint of the rule working: a product deleted on a 1.4.6 phone stays deleted there until the
  server confirms the delete, and no `pull_apply` names it.
