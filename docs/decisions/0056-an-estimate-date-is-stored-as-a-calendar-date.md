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

## Built (2026-09-11) — branch `fix/an-estimate-date-is-a-date` in `invotick-apis`, not yet deployed

- **`49825b9`, the migration `V20260911_05`.**
  - It adds `estimate_day` and `expiry_day`, both `DATE NULL`, and fills them in the same file.
  - The fill rule is `DATE(x + 12 h − 1 µs)`: a stored moment after 12:00 UTC is the next UTC day.
    That gives each of the 113 stored estimates the day its phone showed. A plain `DATE(x)` would
    have moved 69 of them a day back.
  - `updated_at` and `last_synced_at` are left alone, so no phone re-downloads anything.
- **`0df65ef`, the code.**
  - Every write sets the day, and still writes the old column exactly as today, so the running jar
    and a rollback are unaffected.
  - The pull and the stale-conflict copy read the day. If the old column names a different day,
    something wrote it without the day (the old jar in between, or a rollback), so the old column
    wins and the disagreement is logged.
- **The expiry date ("valid until") moved the same way.** It had the same parser and the same noon
  storage.
- **The switch, `EstimateDayGate`.** It reads `sync.estimate-day.enabled` and
  `sync.estimate-day.min-app-version-code`, and both default to off.
  - Off: every caller gets today's shape, `2026-09-09T12:00:00Z`.
  - On with 93: builds from 1.4.2 get the bare day, `2026-09-09`, which they read as a local day in
    every zone. This is the only part that fixes a phone at UTC+12 to +14.
  - Builds up to 1.4.1 send no version code, so they are never switched.
- **Tests: 655/655** (the baseline was 641). Two failed before the fix: the fill, with
  `Unknown column`, and the UTC+13 round trip, where Auckland showed 09-10 for 09-09.

**Numbers** (production, read-only, 2026-09-11):
- 113 estimates from 44 owners (20 registered, 24 guests). No owner is at UTC+12 to +14, so no
  phone shows a wrong day today.
- The web app shows the day before for 69 of the 113. The code deploy fixes them with no web change.
- Class E was undercounted. Date-parse refusals by build: vc94 44,008, vc95 5, vc97 213. So 1.4.2
  and 1.4.3 sent calendar days too, not only 1.4.4.

**Deploy order:**
1. `e14ba73` (`V20260911_04`) first. Flyway refuses a lower number once `_05` is applied.
2. `49825b9` alone.
3. `0df65ef`. At startup it logs `EstimateDayGate … enabled=false`, which proves the new build is live.

**Waiting on the owner:**
1. Pushing the migration. A schema change is asked about every time.
2. Turning the switch on (`true`, `93`). Recommended.
3. Confirming that the expiry date is included.

## Rejected

Keeping the noon-UTC convention. It is correct only for time zones between −12 and +11.

## Consequences

Invoices' dates have the same shape of risk (`invoice-date-shifts-a-day`). They are not part of this
decision. When checked on 2026-09-11, the invoice defect turned out much larger: 1,125 of 1,761 PKR
invoices created before 09-05 are stored one day early. `invoice_date` is a DATE, so the time of day
is gone and this decision's fill rule cannot repair them. That repair is Tier 1 and is the owner's
decision.
