# 0082 — A client's ledger line keeps the client's own currency

**Status:** decided by the owner on 2026-09-14 ("Har client apni currency mein"). Not built yet; goes into 1.4.6 with
0081.
**Related:**
- 0081, every money screen totals in the chip's currency;
- invariant 6, an invoice's currency is client-locked;
- the dashboard currency design of 2026-07-25: an individual amount never converts.

## Context (the owner's iPhone, TestFlight 1.4.6 (16))

- **The ledger converted each client's own figures** into the summary currency.
- **So "Apptrick", a PKR client with one Rs62,500 invoice, showed $225.53.** A person who invoiced Rs62,500 saw a
  number they never wrote, and it moved with the day's rate.

## Decided

- **Each client's line shows the client's own currency, exactly as invoiced.**
  - Apptrick: Rs62,500.
  - Apptrick $: $640,000.
- **Only the ledger's overview total converts,** into the chip's currency (0081) and marked "≈".
- **If a client's invoices ever mix currencies** (legacy data), that one line converts into the chip's currency and
  carries "≈".

## Rejected

- **Every line in the chip's currency.** The line would change a little every day with the rate, and a client's balance
  would read in a currency nobody invoiced them in.
