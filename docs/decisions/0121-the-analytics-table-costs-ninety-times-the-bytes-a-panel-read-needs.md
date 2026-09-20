# 0121 — The analytics table costs ninety times the bytes a panel read needs, and that is the structure, not the query

- **Date:** 2026-09-20
- **Status:** measured on production, read-only. One panel-only quick win is on a branch
  (`invotick-admin-panel` `perf/panel-poll-and-freshness`, `1777492`, **not deployed**). Every
  structural option below is the owner's to choose; nothing else is built.
- **Asked for by the owner, 2026-09-20:** *"jo muqabla, pehli invoice ka safar and live user ka jo
  section hy wo loading main bohat time leta hy … Google firebase / analytics is se bhi heavy
  processing karte hain but instant result dete hain."* And, after the first answer:
  *"firebase pehly sy sari query calculate rakhta hy — usky millions user hain aur har user multi
  dimension sy query kerta hy … I think issue pehly sy ready made result rakhna nhi, issue structure
  side per lag rha hy."*

## Decision

**The owner's second reading is the correct one, and it is recorded here as the frame for all
analytics-read work from now on: the three pages are slow because of how `analytics_events` is
stored, not because the answers are computed on demand.** A pre-computed rollup is therefore one
option among several and not the headline; it cannot answer a question nobody had yesterday.

Measured on production on 2026-09-20 (1.72 M rows, 846 MB data + 1,394 MB index, 512 MB buffer
pool, 8 GB / 2 cores, MySQL 8.0.46):

| page | read | server time, 30 days | 7 days | 1 day | read from disk, 30 days |
|:--|:--|--:|--:|--:|--:|
| Pehli invoice ka safar | `first-invoice-journey` | **17.1 s** | 5.7 s | ~1 s | 742 MB |
| Muqabla | `journey-compare` (24 h window) | **10.8 s** | 4.4 s | 0.3 s | **3,167 MB** |
| Live Events | `active-users`, every 5 s | **5.0 s** | 4.7 s | 0.62 s | 671 MB |

**The one number that names the problem.** One Muqabla read joins 459,233 event rows and uses five
columns of each: `app_instance_id`, `event_timestamp`, `event_name`, `screen_name`, `country` —
about **34 MB of useful bytes**. To get them MySQL asked the buffer pool for 2,087,330 pages
(33.4 GB of page traffic) and read **202,672 of them from disk, 3,167 MB**. That is **93× the bytes
needed from disk and 971× in page traffic**, for one click.

Three properties of the table produce it, and all three were measured:

1. **A random UUID primary key.** `id` is `binary(16)`, UUID v4, so one device's rows are scattered
   over the whole 1,008 MB clustered index. Fetching 94 rows for one device touches ~94 different
   16 KB pages. Proven by removing the fetch: the identical join reading **only indexed columns**
   took **2.23 s**; the moment it needed `event_name` off the row it took **9.29 s**. The row fetch
   alone is **7.1 s of Muqabla's 10.8 s**.
2. **Every event is one wide row with a JSON blob.** `params` averages **390 bytes** (max 2,839) on
   a ~528 byte row. A read that wants 75 bytes drags all of it through the pool.
3. **The hot dimensions are VIRTUAL generated columns over that blob.** `build_type`, `ui_mode` and
   `is_first_open` are not stored; they are `json_unquote(json_extract(params, …))` evaluated **per
   row read**. Measured over the same 1.72 M row scan: no extra filter **0.92 s**, plus one real
   stored column (`platform`) **1.11 s**, plus one virtual column (`build_type`) **2.24 s**, plus
   two **2.48 s**. **A virtual-column filter costs about seven times a real one**, and every one of
   the three pages filters on at least one.

**Where the rest of the journey's 17.1 s goes** (`EXPLAIN ANALYZE`, same read): clustered scan of
all 1.72 M rows 2.6 s → filter to 876,238 rows 2.9 s → **filesort of 876,238 rows to group them
4.3 s** → join to the 4,852 anchor devices 1.4 s → **~45 aggregate expressions over 772,850 rows,
~9 s** → the per-device `device_language` subquery 1.2 s. Probed separately: grouping alone 4.21 s;
seven plain aggregates on top 7.70 s; seven JSON aggregates on top 7.85 s. **The cost is per
aggregate expression per row, about 0.5 s each**, whether or not it touches JSON — so the lever is
fewer rows, not fewer expressions. Extracting each JSON key once in a derived table was measured and
saved only 0.4 s (MySQL merges the derived table); **rejected**.

**Why the 500-device threshold of decision 0115 is right, re-measured today.** The journey's
device-lookup path over 7 days (2,301 devices) took **16.05 s** against the clustered scan's 5.68 s,
and over 30 days (4,852 devices) **2 min 55.83 s**. The threshold stays.

**The box.** 7,936 MB total, 2 cores; 4,615 MB used, **399 MB free, 1,727 MB already in swap**.
`mysqld` alone has **736 MB swapped out — more than its entire 512 MB buffer pool**. RSS: backend
JVM 1,885 MB (Docker limit 3 GB), mysqld 1,045 MB, `jariya-api` 446 MB (a different product),
exchange service 173 MB, the Loki/Grafana/Prometheus/promtail/cAdvisor stack 541 MB, nginx 172 MB,
plus the GitLab CI runner. `innodb_buffer_pool_size` is **512 MB against 2,239 MB of analytics data
and indexes** and 3.7 GB of database; `innodb_buffer_pool_instances` is configured 8 but MySQL
forces 1, because the pool is under `chunk_size × instances` = 1 GB. The pool has been reading
**6.9 TB from disk in 73 days, ~94 GB a day**.

**The size context, which changes the answer.** March 333 rows/day → August 7,788 → **September
41,573**. Retention is 180 days, so steady state on today's volume is ~7.5 M rows ≈ **10.5 GB** with
indexes, and ~20 GB if the install base doubles. Today's 2.24 GB is the small version of this
problem. Also found: the oldest row is 2026-03-05, **199 days**, past the 180-day retention — the
retention job's actual behaviour is unverified and is a separate question.

## Why Firebase feels instant, honestly

Firebase's console is fast for two different reasons, and only one of them is pre-computation. Its
standard reports **are** pre-aggregated daily tables, which is why they answer instantly and why
they are also fixed. Its Explorations and BigQuery, where a person asks a new question, are **not**
pre-computed — they are fast because the events sit in a **columnar** store: each column is a
separate compressed file, so a query that wants five columns reads five columns and nothing else,
at 1–3× the useful bytes rather than our 93×. The owner is right that ready-made answers are not
the mechanism for ad-hoc questions. He is also right that the gap is structural — and the number
above (93×) is that gap, written down.

## The options, with what each is worth

Costs are the measured deltas above; "page time" is the expected 30-day time for the three reads.

| # | option | work | running cost | risk | ad-hoc questions | journey / Muqabla / Live Events |
|:--|:--|:--|:--|:--|:--|:--|
| A | **Buffer pool 512 MB → 2 GB** (config + restart) | ~0, one line | needs ~1.5 GB of RAM freed on a box with 399 MB free and 1.7 GB swapped | MySQL restart = brief outage of app + sync; too high a value starts the OOM killer | unchanged, all get faster | ~13 s / **~3 s** / ~3 s |
| B | **Covering index** `(app_instance_id, event_timestamp, event_name, screen_name, country)` | 1 migration, ~1 day | **+250–320 MB** of index competing for the same pool; one more index write per insert | `ALTER` rebuilds a 2.24 GB table at boot — Flyway blocks the deploy for minutes | unchanged | 17 s / **~3.5 s** / 5 s |
| C | **Drop 3 redundant indexes** — `…_event_name` (103 MB, a prefix of `…_name_ts`), `…_screen_name` (80 MB, a prefix of `…_screen_ts`), `…_item_id` (55 MB, cardinality 1) | 1 migration, hours | **−238 MB of index**, 3 fewer index writes per insert | low; `…_event_name` is the plan the optimizer picks for the UTM reads, so re-measure those on `…_name_ts` first | unchanged | small gain everywhere |
| D | **Hot dimensions out of JSON** — `build_type`, `is_first_open`, `ui_mode` VIRTUAL → STORED, plus `open_count`, `ms_since_start`, `placement` as real columns | 1 migration + app/ingest change, 2–3 days | +~20 bytes/row; table rebuild | same boot-blocking rebuild; a STORED column cannot be added INSTANT | unchanged | ~12 s / ~9 s / ~3.7 s |
| E | **Partition by month** on `created_at` | 1 migration (PK must become `(id, created_at)`), 2–3 days | none ongoing; retention becomes `DROP PARTITION` instead of a DELETE that churns the table | full table rebuild; the largest single change | unchanged, and **the only option whose value grows with the table** | at 10 GB: reads 1 month instead of 12 |
| F | **Rollup tables**, nightly + incremental, per device-day | 1 migration + a scheduler, 2–3 days | one small job every few minutes; a stale figure is a cost (0034) | low | **cannot answer a new question** — only the ones built into it | **<0.1 s** for the fixed top line, unchanged for everything else |
| G | **Cache the answer for N minutes** + a "computed at" line | ~half a day | keeping answers in RAM is the pattern that caused the 2026-09-04 OOM, and the standing rule is storage, never RAM | medium if in RAM, low on storage | first click still pays full price | 2nd click <0.1 s |
| H | **ClickHouse on the same VPS**, fed from MySQL, app writes unchanged | 1–2 weeks: ingest, three queries rewritten, backups, a Health Centre check | ~1 GB RAM it does not have today; disk **shrinks** — 2.24 GB compresses to ~250–400 MB | a second database to run, upgrade and back up; two stores to keep honest | **fast for every question, including tomorrow's** | **~50–300 ms each** |

**On H, plainly.** ClickHouse is what Firebase actually does, and it is the only option that makes
ad-hoc multi-dimensional questions cheap *by construction*. At 1.72 M rows it is over-engineering
for the data; the reason to consider it is not the row count but that this box has 2 cores and
399 MB free, and a columnar store would need a fraction of both. Even so it is a second database on
a box that already runs MySQL, a 1.9 GB JVM, the exchange service, the monitoring stack and the CI
runner. **Not first.** Revisit when the table passes ~10 GB, or when the VPS migration lands.

## Recommendation, in stages

1. **A + C together** — raise the pool to 2 GB and give it back 238 MB of dead index. Nothing to
   build, the largest measured win per hour of work, and it helps sync and auth too. It needs the
   owner's word on a MySQL restart and on where ~1.5 GB of RAM comes from.
2. **B** — the covering index; 7.1 s off Muqabla, measured, and it is the same "read only the
   columns you need" that makes a columnar store fast.
3. **E** — partition by month, before the table reaches 10 GB, not after.
4. **F** only for the mandate's fixed table (first-time users → made an invoice → did not, by
   reason), never for exploration.
5. **H** when the size or the box says so.

**What stage 1 does NOT fix:** the journey stays about 13 s, because it is CPU-bound on ~45
aggregate expressions over 772,850 rows, not I/O-bound. Only fewer rows (E) or fewer devices (a
shorter range) moves that one.

## Built now, on a branch

`invotick-admin-panel` `perf/panel-poll-and-freshness` (`1777492`), panel only, no migration, no
backend change:

- Live Events asks the 30-day question **once a minute** instead of every five seconds; the 5 s beat
  is kept only when the range ends today and covers at most a day, where the read is 25 ms. At
  5.0 s and 671 MB of disk per poll, the old beat held one of two MySQL cores at ~100 % and ~134 MB/s
  for as long as the tab was open — which is why Funnel Analysis crawled in the next tab. This
  answers decision 0115 question 2.
- Both pages print **when what is on screen was computed and how long the server took**.
- The panel has no test suite (its `CLAUDE.md` says so). Lint is unchanged at 27 problems / 7
  errors, all pre-existing on `main`; `tsc --noEmit` is clean.

## Rejected

- *Framing this as "pre-compute everything like Firebase".* The owner's correction: Firebase does
  not pre-compute every combination, and a rollup cannot answer tomorrow's question. Recorded above.
- *A derived table that extracts each JSON key once.* Measured: 7.85 s → 7.44 s. MySQL merges it.
- *Raising `JOURNEY_LOOKUP_MAX_DEVICES` above 500.* Re-measured: 2,301 devices cost 16.05 s by
  device lookup against 5.68 s by scan.
- *Caching the answers in the JVM heap.* That is the shape of the 2026-09-04 OOM, and the owner's
  standing rule since 2026-09-13 is storage, never RAM.
- *Changing the default range on the three pages from 30 days to 7.* It would make the journey
  3× faster with one line, but what the owner looks at by default is his decision, not mine.
- *Changing the primary key to `(app_instance_id, event_timestamp, id)`.* It would be worth most of
  option B and more, but it rebuilds the table, rewrites 2.24 GB, and changes what Hibernate maps.
  Option E's rebuild should carry it if it is done at all.
- *Raising the proxy timeout.* Already rejected in 0115, for the same reason.

## Open questions for the owner

1. Raise `innodb_buffer_pool_size` from 512 MB to 2 GB, and where do ~1.5 GB come from — the
   backend JVM's 3 GB limit, the monitoring stack (541 MB), `jariya-api` (446 MB), or a bigger VPS
   in the migration already planned for end-September? It needs a MySQL restart, which is a short
   outage for the app and sync.
2. Drop the three redundant indexes (238 MB back, 3 fewer writes per event), after re-measuring the
   UTM reads on `idx_analytics_events_name_ts`?
3. Add the covering index (7.1 s off Muqabla, +~300 MB)? Note that the migration rebuilds a 2.24 GB
   table while Flyway holds the deploy.
4. Merge the panel branch, so Live Events stops asking a 30-day question every 5 seconds?
5. The oldest row is 199 days old against a 180-day retention setting. Shall I check whether the
   retention job is running?
