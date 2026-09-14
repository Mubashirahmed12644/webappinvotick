# 0104 — A payment's date travels as a calendar day, in 1.4.6

**Status:** decided by the owner on 2026-09-14 ("Sirf tareekh abhi theek karo").
- This is a narrow carve-out from the postponed Payments review (`memory/payment-form-review-postponed.md`). Only the
  date's shape on the wire changes.
- It is being built: the server first, then the app.

**Related:**
- 0093, the invoice-date shift and its repair;
- 0056, estimates stored as a calendar date.

## Context

- **The difference.** Invoices (from 1.4.1) and estimates (0056) travel as calendar days. A payment's date still leaves
  the app as an instant (`InvoicePaymentEntityMapper.kt:56`), and the server keeps that moment's UTC day
  (`payments.payment_date`, a DATE).
- **The effect.** In Pakistan, a payment entered between midnight and 05:00 lands on the day before.
- **The count.** Since 2026-08-28, 116 payments arrived:
  - 107 carry the day they were entered (Pakistan time);
  - 9 are a day earlier.
  - The 9 are not proven to be this defect, because some payments are recorded late.

## Decided

- **In 1.4.6 the app sends a payment's date as `YYYY-MM-DD`,** as it does for invoices.
- **The server reads both shapes and counts them.**
  - Older builds keep working, and their share of arrivals is visible.
  - The server part ships before the 1.4.6 app.
  - The pull direction is checked as well, so no side shifts a day, east or west.
- **Nothing else about payments changes:** not the screen, the totals, the logic, or any stored payment.

## Rejected

- **Waiting for the Payments review.** Until then, a payment entered after midnight in the east could still land on the
  day before.
