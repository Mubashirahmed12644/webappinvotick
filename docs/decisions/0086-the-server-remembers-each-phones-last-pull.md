# 0086 — The server remembers each phone's last pull, so phones already out there stop skipping changes

**Status:** decided by the owner on 2026-09-14 ("Server par, raseed ke baad"). Not built.
- It comes after the receipt number (#1).
- That follows the owner's order of 2026-09-11: receipt number → pull bookmark → S1 → delete version.

**Related:**
- `.claude/agents/sync.md` rule 25, "Not closed: the pull bookmark";
- `docs/SYNC-RECEIPT-NUMBER-PLAN.md`, F2 and step 2.7, the app half, approved on 2026-09-12 as plan question 3;
- 0078, what the web writes reaches the phones.

## Context

- **A push moves the phone's pull bookmark to the push's own time** (`SyncPushHandler.kt:207-209`), and the pull steps
  back only 60 s.
  - So a change made in between, on the web or on another phone, can be skipped by the next delta pull.
  - A full pull never brings a delete.
- **The app half** (the push stops moving the bookmark, step 2.7) ships in the release after 1.4.6. It reaches a phone
  only when that phone updates, and about 81% of phones stay on older builds for days.
- **Today's harm is small.**
  - In about 26 hours the web changed at most 5 records.
  - None of the accounts whose invoices changed had a phone.
  - The only accounts with two phones are our test accounts.

## Decided

- **The server keeps each phone's last pull,** per account and device.
  - The next delta pull starts from there, whatever bookmark the phone sends.
  - A phone's own pushed records are not sent back to it.
- **It needs a small migration,** a place for each phone's last pull time. The migration ships alone and first.
- **It is built after the receipt number (#1).**

## Rejected

- **Only the app half.** Phones that never update would keep skipping changes and deletes.
- **The server always sending one day back.** It is simple, but a phone closed for longer than a day still misses
  changes, and every pull gets bigger.

## Consequences

- **Older phones (1.4.4, 1.4.5, 1.4.6) receive the changes they used to skip.**
  - They apply them the way they apply every pull, so there is no new path on the phone.
  - Pulls get slightly bigger.
- **About 1–1.5 days of work.**
- **Measure before and after:**
  - the records a phone had skipped, which the server can now see;
  - the size of a pull.
