# 0115 — A panel read of analytics_events is one pass, and names its plan when the optimizer's would be random reads

- **Date:** 2026-09-18
- **Status:** decided (technical fix, branch `fix/webpanel-journey-502`, not deployed); three owner questions open below
- **Decision:** The Live Events user list (`active-users`) and the first-invoice journey (`first-invoice-journey`) each read `analytics_events` once per request, and pin the access path with index hints: a clustered scan for wide ranges, the device index only for a few hundred devices, the `created_at` index for the first-open anchor. The journey returns rung and stop-reason signals in the same row, with no second, separately limited query.
- **Why:** On 2026-09-18 both routes answered 502 in the panel (nginx logged 499: the Vercel `/backend` proxy gave up before the backend answered). Measured on production, 30 days, release, 1.65 M rows, 512 MB buffer pool:

  | read | before | after |
  |:--|--:|--:|
  | active-users list | 23 s (walked `idx_analytics_events_user_ts`, 1.45 M random row reads) | one read, 6.1 s, list + total + hidden together |
  | active-users total | 2.7 s | (same read) |
  | active-users no-build count | > 215 s, killed (NOT IN, whole-table scan) | (same read) |
  | active-users, 1 hour | – | 25 ms (created_at range) |
  | journey anchor | 20 s (`idx_analytics_events_name_ts` read all 490 k cold starts ever) | 0.6 s |
  | journey ladder + signals, all versions | ~50 s + > 100 s | 14.3 s (one pass) |
  | journey, one version (390 devices) | 2.1 s | 1.7 s (device lookup) |

  The table is keyed by a random UUID (v4), so rows of one day are spread over all of it; any read through a secondary index that must fetch the row is one random page read per row. A sequential pass over the whole table costs about 2.5 s.

  It also fixes a data defect: the journey kept the 2,000 highest rungs and read signals for an unrelated 2,000 (both `LIMIT 2000`), and 30 days had 4,285 first-time devices. The report silently showed 2,000 of them (inflating conversion, because the dropped ones were the lowest rungs) and bucketed part of the rest `no_signals` — an *unknown* the data could name.
- **Rejected:**
  - Raising the proxy timeout (nginx is at 900 s already; the 499 is the panel proxy). It hides a 3-minute query that runs every five seconds while the page is open.
  - A pre-computed rollup table or a new covering index: needs a migration, which this fix was not to carry. Kept as owner question 1.
  - `IGNORE INDEX` only on the outer journey read: measured worse for one version (the optimizer then walked the version index once per device, 67 s).
  - Always the clustered scan for the journey: 3x slower for one version (6.5 s vs 1.7 s), and its cost grows with the whole table rather than with the range.
  - Optimizer-hint comments (`/*+ NO_INDEX */`): an unknown index there is silently ignored, so a rename would quietly restore the 502. Classic hints fail loudly, and `AnalyticsPanelReadsTest` fails the build first if a hinted index stops being declared.
- **Consequences:**
  - `AnalyticsPanelReadsTest`: every hinted index exists; no `NOT IN (SELECT … FROM analytics_events)`; `activeUsers` makes exactly one repository read.
  - `JourneyReportDto.truncated` (cap `JOURNEY_DEVICE_CAP` = 10,000).
  - `feat/journey-version-comparison` (0114): its `JourneyComparisonStepsMatchTheJourneyTest` reads the step CASE from `findFirstInvoiceJourney`; after this lands it must read it from `JOURNEY_COLUMNS`.
  - The scan cost follows the table: September alone added 755 k rows (to the 18th), and retention is 180 days. At that rate the 30-day all-versions journey reaches about 30–40 s within months. This fix does not end that.

## Open questions for the owner

1. Pre-compute the journey per device (a small rollup refreshed every few minutes) with one migration, so the page costs the same at 10 M rows? Or add a covering index for the user list?
2. The Live Events page asks for 30 days of users every 5 seconds. Poll the 30-day list every 60 s, and keep 5 s only for a range that ends "now" and is 1 day or less?
3. MySQL has a 512 MB buffer pool on an 8 GB box, for 2.35 GB of analytics data and indexes. Raise `innodb_buffer_pool_size` (infra change on the VPS, not in any repo)?
