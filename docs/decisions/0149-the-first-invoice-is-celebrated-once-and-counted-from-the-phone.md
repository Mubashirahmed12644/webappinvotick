# 0149 — "You created your first invoice" is said once, and "first" is read from the phone

**Date:** 2026-09-21
**Status:** built — app `VC_108_VN_149` (`bd6c2091`), for 1.4.9. Not released. No server change, no schema change.
**Related:** 0006 (G1 metric), 0147/0148 (ported onto 1.4.9 in the same push), memory `g1-real-data-metric-gap`.

## What was seen

Pixel, 1.4.8 testing: internet off, the **third** invoice created still showed "Congratulations! You created your
first invoice."

## Root

Not the internet. The create screen had **no rule**: every Preview from create mode set the celebration on, since the
screen was written (`161a9d10`, June). Every invoice made there got it; offline was only where it was noticed.

The same missing fact broke the G1 event the other way. `invoice_created_success.is_first_invoice` read
`hasCreatedFirstInvoice`. That is the onboarding tour's flag, and it is already true once an item sits in the draft.
So every invoice reported itself as not-first: **1,407 of 1,407 `false`** in the 14 days to 2026-09-21 (production,
read-only). Any "first invoice" number built on that parameter up to 1.4.8 is zero by construction.

The owner's guess, "a flag set only after sync", is also true, but it was not the cause. `user_state` gets a row only
from a server sign-in, so for a guest made offline the local "created first invoice" write updates nothing until the
server answers. The new rule does not depend on it.

## Decision

One answer, used by both the screen and the event:
**first = no finished invoice of this account on this phone, and the account's flag does not say otherwise.**

- **The phone's rows** (`InvoiceDao.hasFinishedInvoice`). They count if they belong to this account, are not a draft,
  and are not a seeded sample. The row being saved (the Save gate's kept draft) is left out. A deleted invoice was
  still made, so it counts. This works with no internet.
- **The account's `user_state` flag**. It covers a new phone whose old invoices have not come down yet.
- It is read before the write, as the event already was.
- The overlay shows only when the answer is "first". Every other save goes straight to the preview, as edit mode
  already did. `create_inv_completed_scr` still fires on every create; it has not changed.

## Rejected

- **Keeping the tour flag (`hasCreatedFirstInvoice`) as the test.** It answers "has this person finished the tour",
  and it becomes true before the first invoice is saved.
- **Only the `user_state` flag.** It has no row for an offline guest, which is the case that was reported.
- **Counting only invoices that are not deleted.** Deleting your first invoice does not make the next one your first.
- **A new stored "celebrated" flag.** The invoices themselves already hold the answer. A second copy can disagree
  with them.

## Proof

- `OnlyTheFirstInvoiceIsCelebratedTest` has 4 tests. **3 were red** with the screen's old behaviour.
- `AFinishedInvoiceIsCountedOnThePhoneTest` has 6 tests on Robolectric with the real schema. They cover: offline
  third invoice, empty phone, the kept draft, the row being saved, a deleted invoice, samples and other accounts.
- Whole suite: **945/945**. Android debug build and iOS simulator compile both pass. Not run on a phone.

## For the event history

From 1.4.9, `is_first_invoice` means what its name says. Rows up to 1.4.8 are all `false`. Never mix the two in one
ratio; split by version.
