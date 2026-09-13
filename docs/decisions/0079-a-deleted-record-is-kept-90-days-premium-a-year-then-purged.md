# 0079 — A deleted record is kept 90 days (premium: a year), then purged

**Status:** decided by the owner on 2026-09-13 ("Sab ke liye 90 din, premium 1 saal"). Not built. It needs 0059
amended first, then a purge job and a Health Centre line.
**Related:** 0059 (a delete of a record the server does not hold), 0042 (the version rule), 0053 (declined guest work,
90 days), 0077 (log retention by user type), 0078.

## Context (2026-09-13)

- **A deleted record stays on the server for ever,** marked deleted (soft delete).
- **The owner asked** that deleted records be kept according to a retention policy.
- **Two risks shaped the numbers:**
  - A phone offline for longer than the window may send an old edit of a record the server has already purged, and
    bring it back.
  - Invoices and payments are money records.

## Decided

- **A soft-deleted synced record is purged for good 90 days after its delete.** For a premium account it is one year.
- **Before any purge:**
  - 0059 is amended, so that a delete of a purged record is not a sync failure, and an edit of one is not a new
    record;
  - there is a purge job that goes children first, one account per transaction;
  - there is a Health Centre line: purges due, done and failed.

## Rejected

- **Log-style windows (guests 15, registered 30, premium 90).** A phone offline for more than 15 days could bring a
  record back, and a guest's deleted invoice would be gone for good in 15 days.
- **Keeping deleted records for ever.** That was today's state. The rows are small, but they are personal data held
  with no end.

## Consequences

- **Payments wait for their form's review** before any purge touches them.
- **0053's declined guest work** already has its own 90-day keep. It uses the same job, keyed on an explicit recorded
  "no".
