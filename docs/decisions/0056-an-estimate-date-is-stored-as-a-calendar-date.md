# 0056 — An estimate's date is stored as a calendar date, not a moment in time

**Status:** decided (the owner, 2026-09-11, item 12: agree, and fix it right away).
**Date:** 2026-09-11.
**Related:** the sync audit's class E (fixed in `660168d9`), memory `invoice-date-shifts-a-day`.

## Context

- Since `660168d9`, the server reads the calendar day that 1.4.4 sends for an estimate and stores it
  at 12:00 UTC, in a column that holds a moment in time.
- Noon UTC is already the next day at UTC+12 and beyond (New Zealand in summer, Tonga, Kiribati). So
  anything that shows that moment in local time moves the estimate's date a day forward.

## Decision

- The estimate's date is stored as a date, with no time and no time zone.
- The app already sends `YYYY-MM-DD`.

## Rollout

Additive only, per `deploy-safety-schema-changes`:
1. The migration ships alone and first.
2. Then the code.
3. Older readers keep working until the old column is retired, which is a separate decision.

## Rejected

Keeping the noon-UTC convention. It is correct only for time zones between −12 and +11.

## Consequences

Invoices' dates have the same shape of risk (`invoice-date-shifts-a-day`). They are not part of this
decision; check them the same way.
