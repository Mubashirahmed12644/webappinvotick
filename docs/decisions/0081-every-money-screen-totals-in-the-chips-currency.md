# 0081 — Every money screen totals in the chip's currency

**Status:** decided by the owner on 2026-09-14 ("Chip wali currency, har jagah"). Not built yet; goes into 1.4.6.
**Related:**
- the dashboard currency design of 2026-07-25 (`memory/dashboard-currency-and-all-businesses.md`);
- `BuildSummaryRates` in `domain` (one implementation of the multipliers);
- invariant 6: an invoice's currency is client-locked.

## Context (the owner's iPhone, TestFlight 1.4.6 (16), 2026-09-14)

One business, with a $640,000 invoice and a Rs62,500 invoice, showed three different totals on three screens:

| Screen | What it showed | Why |
|---|---|---|
| Invoices dashboard | PKR, converted | its "Summary in" chip |
| Client ledger | $640,225.53, while its chip said "PKR (Rs)" | it picks the currency holding the most money |
| Analytics tab | Rs702,500 | both amounts added at face value, nothing converted |

## Decided

- **One currency on all three screens.** The dashboard, the client ledger and the Analytics tab total in the currency
  on the screen's currency chip.
  - It starts as the business's own currency.
  - The user can change it, and the choice is remembered per business. This is the preference the dashboard already
    keeps.
- **Other currencies are converted** into it at the day's rate, and a converted figure carries "≈".
- **The chip always names the currency the numbers are in.**

## Rejected

- **Each screen picking the currency that holds the most money**, which was the ledger's rule. The same money showed as
  rupees on one tab and dollars on the next, with a chip that named a third thing.

## Consequences

- **The ledger's `dominantCurrency` rule goes.**
- **The Analytics tab gains the conversion it never had,** including the daily points of its revenue trend.
- **Whether a client's own line in the ledger converts too** is a separate question, asked next.
