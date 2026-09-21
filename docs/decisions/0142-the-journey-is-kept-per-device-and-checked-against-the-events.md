# 0142 — The first-invoice journey is kept per device, and checked against the events every day

- **Date:** 2026-09-21
- **Status:** built and pushed, **not deployed**. The migration waits for the owner's word.
  - Backend `migration/device-journey-tables` (`02293ef` + `cf6c1dc`), 1,299/1,299.
  - `feat/device-journey-kept-true` (`8761736`, on it), 1,319/1,319.
  - `feat/device-journey-read` (`1bd2e21`, on that), 1,322/1,322.
  - All three sit on `stage` `c79976b`.
  - Panel `feat/journey-says-where-it-read` (`451a0a5`, on `main` `71e201d`).
- **Asked by the owner, 2026-09-21:** option B of the speed work — *"ye kaam ek hi dafa kar lein to
  future mein sab jagah aasani aur fast nahi ho jayega?"* He had already rejected pre-computed
  answers (0121: they cannot answer a new question). This is not that: the tables hold **data in the
  shape the questions need**, and every filter stays an ordinary `WHERE` on their columns.

## What the data already says (production, read-only, 2026-09-21)

| fact | number |
|:--|--:|
| devices with a first-open cold start, ever (the flag exists since 2026-07-27 21:21 UTC) | **5,172** |
| their events | 979,756 |
| the same events, one row per device × arrival hour × build | **36,168** (27× fewer) |
| first-open devices in 30 days (release) | 5,163 |
| … that also sent events on **another build** than the one they first opened on | **791** (15 %) |
| … that sent events **before** the 30-day range started | **130**, carrying **161,237** of the range events |
| … with more than one first-open cold start | 61 |
| heaviest single device | 77,433 events |
| recomputing 200 devices' journey from the events (24,385 rows) | 2.46 s — ~100 µs a row |
| ingestion, `/v2/analytics/track`, 24 h (Prometheus) | 23,365 batches, **61.3 ms** mean |

These numbers decided the shape.

- **One row per device cannot give Safar's answer.** Safar counts a device's events *inside the
  range, on the chosen build*. 791 devices have events on another build and 130 have events before
  the range — and those 130 hold a fifth of the range's events. A lifetime row per device would
  change the answer for about one device in six. The owner asked for identical output, so the
  journey is kept **per device, per build, per arrival hour**. An hour row is the smallest piece
  that lets any range be summed exactly: whole hours come from the table, and the two part-hours
  at the edges of the range come from the events.
- **Muqabla is different.** It reads each device over a fixed window from its own first open, and
  that is exactly "one timestamp per step". Muqabla gets **one row per device**.
- **Recomputing is cheap if it is bounded.** 100 µs a row means a device's current hour costs
  milliseconds, while its whole life costs up to 8 s for the heaviest phone. So the rows are kept
  true by recomputing **only the hours that changed**, never the whole device.

## The design

Three tables in one migration. The third, `device_journey_check`, is the daily check's history, one
row per run: the Health Centre card has to read it from storage, not from memory.

### Table 1 — `device_journey`, one row per device (`app_instance_id`)

A row exists for every device that has sent a first-open cold start. That is the population both
pages count.

| columns | what | decided by | frozen? |
|:--|:--|:--|:--|
| `first_open_at`, `first_open_arrived_at`, `platform`, `build_type`, `app_version`, `app_version_code` | the device's **first** first-open cold start: its device-clock time, its arrival, and its build | the cold start with the earliest `event_timestamp`, tie broken by version code — Muqabla's own `ROW_NUMBER` rule | **Frozen at first open.** It changes only if an earlier cold start arrives late, which the recompute picks up. |
| `first_opens` | how many first-open cold starts the device has | count | Changes on a reinstall. **More than one: Muqabla reads that device from the events** (61 devices), because its first open then depends on the range asked. |
| `step1_at` … `step8_at` | the first moment each rung of the ladder was reached, at or after `first_open_at`, within 7 days | `MIN(event_timestamp)` over events whose rung is exactly *n*. The rung comes from **`JOURNEY_STEP_CASE`, the one definition** | Changes while events for the first 7 days keep arriving, late ones included |
| `shared_at` | the first `invoice_shared_success` in the same window | same | same |
| `country`, `country_at` | the first country any event carried in the window, and when | Muqabla's rule (`event.country` is ~93 % NULL on the cold start) | same |
| `referrer_at`, `utm_source`, `utm_medium`, `utm_campaign`, `meta_shaped`, `meta_payload` | the earliest `install_referrer` from 60 min before the first open to 7 days after | Muqabla's rule (the referrer is stamped before the cold start) | same |
| `dirty_seq`, `clean_seq`, `dirty_from`, `refreshed_at` | bookkeeping: has anything arrived since the row was last recomputed, and from which hour | ingestion and the refresher | — |

**Worked out when the page is read, and never stored:**
- **Tier.** `CountryTiers` is our own classification, and it changes with a release, not with an
  event.
- **Campaign.** The Meta payload is stored. It is decrypted when read, so a key set later opens old
  installs too.
- **Whether a device is ready** ("eligible"). That depends on *now*.

For a window W (1 h, 24 h, 3 d or 7 d), a device's rung is the highest *n* whose `step_n_at` falls on
or before `first_open_at + W`. That is exactly the old query's `MAX(step)` over the events in the
window, because a rung is reached in the window exactly when its first occurrence is in the window.

### Table 2 — `device_journey_hour`, one row per device × arrival hour × build

The key is `(app_instance_id, arrival_hour, app_version_code, build_type)`. The columns are **the
output of `JOURNEY_COLUMNS` itself**, grouped by hour and build instead of by device. The same
constant produces them, so there is no second copy of any signal. There are also a few extra columns:
- `min_created_at` / `max_created_at`;
- `first_opens` — the Safar anchor, counted in the hour;
- `has_dark` / `has_light` — for the mode filter, which looks at any build;
- `last_leave_key` — the time-stamped key behind `lastLeaveScreen`, so hours can be merged.

A Safar read for `[from, to)` is **one SQL statement**. It adds up:
1. the stored hours that lie wholly inside the range and are not waiting for a refresh;
2. the part-hour at each edge, `[from, next hour)` and `[last hour, to)`, read from the events
   through the `created_at` index. That is less than two hours of events, whatever the range;
3. the hours of a device that are still waiting for a refresh, read from the events;

and merges them per device with the rule each signal already obeys: `MAX` for the rung, `MIN` for a
first time, `SUM` for a count. It then keeps the devices whose first-open cold start is inside the
range, on the build asked for — the same anchor as today. **Every filter is a `WHERE` on a column:**
version, build and mode today, and any column added tomorrow.

Muqabla is one `SELECT` on `device_journey` filtered by `first_open_at`. Devices waiting for a refresh,
and the 61 with two first opens, are read from the events by today's query, limited to those
devices through the covering index.

## Keeping it true

- **On ingestion, after the batch commits:**
  - A batch with a first-open cold start **inserts** the device's row, marked "never built".
  - Any other batch **bumps** `dirty_seq` and lowers `dirty_from` to the batch's arrival hour. That
    is one `UPDATE` by primary key, and it does nothing for a device with no row.
  - It runs *after* the commit, outside the batch's transaction. A failure there can never roll back
    or refuse a stored event: it is logged and counted, and the daily check repairs it. It never
    reads `analytics_events`.
- **The refresher, every 20 s:**
  - For each device that has something waiting, it recomputes the hours from `dirty_from` onward,
    using the `created_at` index. That is a few thousand index entries, whatever size the phone is.
  - It also recomputes the device's row.
  - It marks the device clean **only if `dirty_seq` has not moved meanwhile**. A batch that lands
    during the recompute leaves the device waiting, so no event is ever lost.
  - Devices never built are done whole, by device, 20 at a time.
- **Why this works when events arrive late or out of order:**
  - Nothing is incremented. A row is always recomputed from the events it covers, so the order of
    arrival cannot matter, and doing it twice gives the same row.
  - An event that arrives "before it happened" (3.2 %, a phone clock ahead of ours) is still filed
    under its **arrival** hour, which is what Safar's range means.
  - An event a week late (0.10 %) lands in the current hour and dirties the device. Muqabla's step
    times are recomputed from device time, so a late step moves `step_n_at` to where it belongs.
- **A read never waits for the refresher.** Anything not yet refreshed is read from the events in
  the same statement. If the refresher falls behind by more than 3 hours, or more than 50 devices
  are still unbuilt (the backfill), the page reads the events the old way. The answer's `source`
  says which way was used, and why.

## The daily check

Once a day (03:40 UTC), the check does four things:
1. It recomputes, straight from the events, the rows of every device whose first open **arrived in
   the last 8 days** (about 1,300 devices). That covers the 7-day window plus a day of late arrivals.
2. It compares the results with what is stored, column by column. It skips a device that became
   dirty during the check, because that is not a mismatch.
3. It corrects and counts every difference.
4. It looks for first-open devices in the same 8 days that have **no row**. A lost insert is the
   one fault the refresher cannot see on its own. A light sweep over the last 3 hours also runs
   every 10 minutes.

The result is written to `processing_state` — on storage, not in memory. **Health Centre check
`device-journey`** (a `HealthCheck` component, not a new page) reads it:
- **OK** when 0 rows were corrected.
- **WARNING** when more than **0.5 %** of the devices checked were corrected, or any row was missing.
- **CRITICAL** when more than **2 %** were corrected, when the check has not run for 36 h, or when
  the refresher is more than 15 minutes behind.

Why those thresholds: correct code produces **no** mismatches. A difference can only come from a
lost ingestion touch (a crash between commit and touch, or a database error) or from a code change
that forgot the tables. 0.5 % of 1,300 is about 6 devices. That is more than a restart mid-batch can
explain, and fewer than any real defect would produce.

## Backfill

- There is no separate job. The first sweep after deploy inserts a "never built" row for every
  device with a first-open cold start since **2026-07-27 21:21 UTC**. That is the whole history of
  the flag — all 5,172 devices — so **the owner loses nothing beyond 30 days**.
- The refresher then builds them at 20 devices per run, one device per statement, through the device
  index. That is roughly 45 minutes of light load. The heaviest phone takes one ~8 s statement.
- The pages read the old way until fewer than 50 are left unbuilt.
- The tables follow the events' 180-day retention: the daily check deletes hours older than 181
  days. Any Safar range starting more than 179 days ago reads the events.

## What this does NOT cover

- **A question about a step that is not on the ladder**, or a signal that is not in
  `JOURNEY_COLUMNS`, needs a new column and a rebuild. A rebuild means marking every row "never
  built" (one `UPDATE`), and the refresher redoes them in about 45 minutes. It is the price of
  storing data in a shape.
- **Any other page.** The screen funnel, Live Events, the event summary and UTM still read
  `analytics_events`.
- **The Live Events user list (6.5 s)** is a different read: `active-users`, a full scan grouped by
  user. The owner asked whether to index it. The answer is at the end of this file, with the number.

## Deploy order — everything keeps working at every step

1. **`migration/device-journey-tables`** — two empty tables. Nothing reads or writes them yet.
   A plain `CREATE TABLE`, no rebuild of `analytics_events`, a second of Flyway. **Needs the owner's
   word (schema).**
2. **`feat/device-journey-kept-true`** (on 1) — the ingestion touch, the refresher, the sweep and the
   backfill, the daily check, and the Health Centre card. The pages still read the events.
3. **`feat/device-journey-read`** (on 2) — Safar and Muqabla read the tables. They fall back on their
   own while the backfill runs. `source=events` on either endpoint forces the old way, so the owner
   can compare. The panel shows which way was used.

## Built — what changed from the design above

- **Three things also write `analytics_events` and now tell the tables:**
  - the v1 ingest (`/v1/analytics/track`), exactly as v2 does;
  - the platform backfill (0088): a pass that writes marks every device for a rebuild;
  - the closed-account eraser: it marks the devices unbuilt before it deletes the hours that name the
    erased account. The hour table's `user_id` is `binary(16)` so the eraser finds it by its own key.
- **A summed signal may be NULL** (`cf6c1dc`). SUM over rows whose test is NULL (a heartbeat without
  an `open_count`) is NULL, and the dry run on production showed a NOT NULL column refusing such an
  hour.
- **Strings from `params` are stored `utf8mb4_bin`**, the collation `->>` gives them. So MIN/MAX over
  stored hours pick the same value that MIN/MAX over the events do.
- **`readFrom=events`** on either endpoint asks for the old read. Every answer says `readFrom`
  (`table` | `events`) and `readFromReason`. The panel prints it and has a checkbox for the old read.
  - The pages fall back to the events by themselves when:
    - the tables are not filled yet, or are still filling (more than 50 devices unbuilt);
    - the refresher is more than 3 h behind;
    - the range starts more than 179 days ago.
  - `analytics.device-journey.read=false` switches the tables off without a release.
- **Rows are ordered by rung then device (Safar), and by device (Muqabla).** Ties used to come back in
  whatever order the database gave, so two reads of one answer could list them differently.

## Proven identical, on production data (read-only, 2026-09-21 09:37 UTC, load 0.7)

How: the shipped SQL, run verbatim. It built the tables as `TEMPORARY` tables on production and read
them, alongside the old queries on the same instant. Release builds, the last 30 days. Nothing was
written.

| | old read | from the tables | devices | differing |
|:--|--:|--:|--:|--:|
| Pehli invoice ka safar, all versions | 15.3–19.2 s | **0.8–1.4 s** | 5,175 (1,071 invoices) | **0** of 44 fields |
| Muqabla, 24 h window | 2.5–2.6 s | **0.08–0.09 s** | 5,174 | **0**, 5,113 from the table |
| building every table from nothing | — | 33–39 s + 23 s | 5,183 devices, 981,327 events → 48,367 hours | — |

- 61 of the 5,174 Muqabla devices opened for the first time twice. The code reads those from the
  events, through the covering index.
- One earlier Muqabla run differed on 1 device. An event for it arrived between the build and the
  read, and in the shipped code that device would have been waiting for a refresh, and so read from
  the events.
- `dismissMethods` differs as text on 12 devices and is the same as a set. The value is not used on
  the page, and the code reads both as a sorted set.
- **One refresher pass** is small: 3–4 first-open devices sent a batch in 20 s, and their current hour
  took under 1 ms.
- **In the suite** (real MySQL), on devices built to break it:
  - two builds, history before the range, a day-late arrival, a clock a day ahead;
  - two first opens, a debug build, dark mode, a NULL heartbeat sum;
  - something arriving after the build, and a device two days old that is not ready for 3 or 7 days.

  Two levels were compared:
  - rows: Safar old against table for 4 ranges × 3 versions × 3 builds × 3 modes, Muqabla for 4
    windows × 3 builds;
  - pages: Safar page against Safar page, and Muqabla page against page for all six compare-bys ×
    3 windows.

  Each goes **red** when the part-hour edges, the not-ready window or the live remainder is removed.

**Measured before, as the pages feel it** (Prometheus, server time per request, last 24 h):
- Safar **42.1 s** mean (3 opens), and **121 s** over 7 days (38 opens, worst 519 s);
- Muqabla **12.6 s** (11 opens);
- Live Events list **12.6 s** (102);
- ingestion `/v2/analytics/track` **61.3 ms** mean over 23,365 batches.

The after numbers wait for the deploy. They are one PromQL query each, and this file gets them the
day it is live.

## The Live Events list — the owner asked whether to index it

The owner asked this separately. Measured today, 30 days, 942,928 rows:
- **As deployed: 9.6–11.1 s**, with a CI job running (load 2.1). It was 6.5 s on a quiet box in 0141.
- **The same grouping, reading only indexed columns: 1.4–2.4 s.** That is the floor a covering index
  `(created_at, user_id, app_version_code, build_type, app_version)` could reach.

Plainly:
- **The index is worth about 6.5 s → ~2 s.**
- It costs ~150 MB of index in a 1 GB pool, one more index write on each of ~53,000 events a day, and
  a hand-run online ALTER of the 2.24 GB table.
- It stays a scan of the whole range, so it grows with the table again.
- The same pattern as this decision — a small per-user table kept by ingestion, like 0122's live
  registry — would make it instant and stop it growing.

**Recommendation: not the index. If the list matters, a per-user table next.** Owner's call.

## Open questions for the owner

1. **The migration** (`migration/device-journey-tables`): three new, empty tables, no change to
   `analytics_events`, a second of Flyway. Approve?
2. **Deploy order:** migration → `feat/device-journey-kept-true`. Look at the Health Centre card
   `device-journey`; about an hour later it should say filled. Then → `feat/device-journey-read` →
   the panel. Each step works without the next.
3. **Live Events:** the covering index (~6.5 s → ~2 s, +150 MB), a per-user table (instant, a day of
   work), or leave it at once a minute?

## Rejected

- *One row per device for Safar too.* It would change the answer for 791 + 130 devices (measured
  above). The owner asked for identical output.
- *One row per device-day.* A range that starts mid-day would need a day of events read live
  (~50 k rows, seconds). An hour bounds the edge at ~2 k rows.
- *Incrementing counters on ingestion.* `save()` with the app's own event id rewrites a resent event
  instead of refusing it, so an increment would count a resend twice. It would also need a second
  copy of every signal's logic, written as an update.
- *Recomputing the whole device on every batch.* The heaviest phone costs ~8 s each time.
- *Updating the tables inside the ingestion transaction.* A failing statement there marks the
  transaction rollback-only and loses the phone's events — the one trade that is never acceptable.
- *Reading devices that are waiting for a refresh from the stored row anyway* (a few seconds stale).
  The owner asked for identical output, and reading them live costs less than a second.
- *Storing tier and campaign.* The tier list and the Meta key change without an event.
- *A new page for the check.* Health Centre rule.
