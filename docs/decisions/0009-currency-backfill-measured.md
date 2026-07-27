# 0009 — What the currency backfill actually left behind

**Date:** 2026-07-27 · **Status:** measured, fix not yet written

## The question

"Did every invoice get its currency filled?" Asked after the server-side guard shipped to `stage`.

## The answer: no — 2,717 of 5,004 (54%) are still wrong

Measured live against production, read-only:

| | Invoices | |
|---|---|---|
| Currency matches the client's | 1,861 | 37% |
| **Provably wrong** — says USD, client says otherwise | **2,717** | **54%** |
| Undecidable — client has no currency either | 424 | 8% |

By the currency they *should* carry: **PKR 1,412 · MMK 476 · INR 150 · RWF 101 · ZWL 66 · LKR 51**, across **58 currencies**.

## Why the earlier backfill missed them

The 2026-07-25 backfill ran and did exactly what it reported — 1,931 rows, `still_empty = 0`. It was not
a failed migration. It asked the wrong question:

```sql
WHERE currency IS NULL OR currency = ''
```

`Invoice.kt` declares `var currency: String = "USD"`. A currency-less invoice was therefore never
stored empty — it was stored as **"USD"**, indistinguishable from a deliberate choice of dollars.
Those rows were invisible to that WHERE clause, and `still_empty = 0` read as success.

**The lesson is about the check, not the fix.** A verification query that can only find one shape of
the bug will always report success once that shape is gone.

## Two traps found on the way

**The production database is named `invotickdb_dev`.** 656 MB, 56 tables, 5,661 invoices, 11,299
users. `invotickdb` — the name that looks like production — is an abandoned 1.1 MB shell whose last
write was 2026-01-05. The first pass of this investigation queried `invotickdb`, got "89 invoices,
all USD", and was about to report a small, tidy problem. It was caught only because the user asked
for the database sizes.

**Filling from the client asserts the client is right.** That has not been checked. If a client's own
currency was set wrongly, this backfill copies that mistake onto every invoice of theirs.

## Why this is safe for users on v1.4.0 and older — verified, not assumed

| Surface | Reads `invoices.currency`? |
|---|---|
| v1.4.0 in-app render | **No** — `InvoiceEntity` has no such column; currency comes from the client |
| Share link `/i/{token}` | **No** — `SharedInvoiceService:148` uses the share *request's* currency |
| Sync pull | Sends it (`SyncV2PullResponse.kt:825`), but the old app has nowhere to put it |
| **Dashboard / webpanel** | **Yes** — `WebpanelInvoiceService:44,166` |

So the only thing a backfill changes is the dashboard — which is where the PKR 8,668 → 2.4M figure
came from in the first place.

Worth saying plainly: that is safe **by accident**. Had the old entity carried a currency column, a
server-side backfill would have reached into people's local data on their next sync.

## Decided

- Fix the **2,717** where the client's currency is present.
- **Leave the 424** whose client currency is also blank. Guessing there is the original mistake
  repeated — it is how "USD" got written in the first place.
- Count first, in a form that can be read; update second.
- The totals contain junk: one INR group sums to 2×10¹⁶, an XAF group to 590 billion. A currency
  backfill does not touch amounts, but the dashboard is adding this up today.

## Rejected

- **`WHERE currency IS NULL OR currency = ''` again.** This is the query that produced the false
  all-clear. The condition has to be "disagrees with the client", not "is empty".
- **Filling the undecidable 424 with USD.** Indistinguishable from the bug.
- **Waiting for the app fix to cover it.** The shipped guard only fixes invoices arriving from now
  on. These 2,717 rows are already at rest and will stay wrong forever unless something moves them.

## How this was measured

Read-only production access, created for this: `ssh -i ~/.ssh/invotick_ro claudero@82.112.253.168`,
then `mysql invotickdb_dev -e "…"`. SELECT only — no sudo, no docker, no writes. Root was deliberately
not requested, which is also why the DB grant had to be done by hand.
