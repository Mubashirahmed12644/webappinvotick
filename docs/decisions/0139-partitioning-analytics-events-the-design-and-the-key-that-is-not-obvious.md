# 0139 — Partitioning analytics_events: the design, and the partition key that is not obvious

- **Date:** 2026-09-21
- **Status:** **designed and measured, nothing built and nothing applied.** It waits on the index
  ALTER (0121 Q2+Q3, branch `migration/analytics-covering-index` `6230d91`) being deployed and
  proven, and on one decision the owner has to make.
- **Asked for by the owner, 2026-09-20:** after the index change, partition `analytics_events` by
  month. He understands deploys pause while it rebuilds.

## First: what the 1 GB pool actually bought, re-measured on a quiet box

The earlier "after" numbers were taken while a CI build held both cores and were not usable. Box
quiet (load 0.81, no CI), two passes each, 2026-09-21:

| read, 30 days | seconds before (512 MB) | seconds after (1 GB) | disk before | disk after |
|:--|--:|--:|--:|--:|
| Pehli invoice ka safar | 17.1 s | **14.3–15.6 s** | 742 MB | **64–240 MB** |
| Muqabla (24 h window) | 10.8 s | **8.5–9.8 s** | **3,167 MB** | **276–284 MB** |
| Live Events user list | 5.0 s | **4.3 s** | 671 MB | **8 MB** |

**Disk down 68–99 %. Seconds down only 9–21 %.** That is the honest result, and it confirms what
decision 0121 predicted: with the I/O gone, **these reads are CPU-bound**. The pool was still worth
it — it protects the box, it stopped mysqld swapping, and sync and auth share the same pool — but
**the page is not visibly faster and the owner should not be told otherwise.**

## The decision the owner has to make: which column to partition on

This is not a detail. MySQL prunes partitions only when the query bounds the **partition key**, and
the two halves of this page bound **different columns**:

| | bounds `created_at` | bounds `event_timestamp` |
|:--|:--|:--|
| Pehli invoice ka safar (`findFirstInvoiceJourney*`) | **yes** | no |
| Muqabla (`JourneyComparisonRepository`) | **no — zero occurrences in the whole file** | yes |
| Live Events list, event summary, UTM, live-now seed | **yes** | no |
| retention (`deleteOlderThan`) | no | **yes** |

- **Partition by `created_at`:** Safar, the Live Events list and everything else prune. **Muqabla
  gets nothing.** Retention changes meaning from "when it happened" to "when it arrived".
- **Partition by `event_timestamp`:** Muqabla prunes, Safar does not, and the **503 future-dated
  rows land in a partition that never ages out**.
- **Third option, and the one I would take:** partition by `created_at` **and** give Muqabla a
  generous `created_at` floor so it prunes too. Whether that is safe is a measurable question, and
  it has now been measured.

### How late events actually arrive — measured, 30 days, 939,812 rows

| | rows | share |
|:--|--:|--:|
| within 1 minute | 787,511 | 83.8 % |
| within 1 hour | 93,912 | 10.0 % |
| within 1 day | 46,731 | 5.0 % |
| within 1 week | 10,714 | 1.1 % |
| **later than a week** | **944** | **0.10 %** |
| **arrived *before* it happened** (phone clock wrong) | **30,394** | **3.2 %** |

So a floor of `created_at >= :from - 30 days` on Muqabla would still prune two-thirds of the table
at steady state and lose effectively nothing. A 7-day floor would lose 0.1 %.

**The 3.2 % with a clock ahead of ours is its own finding** and is where the 503 future-dated rows
come from. It also means any ordering done purely on `event_timestamp` is wrong for one row in
thirty.

## What partitioning is actually worth here — with numbers, not adjectives

**Pruning today is about 2×, not 6×.** A 30-day window touches **939,763 of 1,741,644 rows = 54 %**,
because the table is young and lopsided (September alone is 48.8 % of it). At steady state on
180-day retention a 30-day window is one month in six, so it becomes **~6×**.

| month | rows | share |
|:--|--:|--:|
| 2026-03 | 4,807 | 0.3 % |
| 2026-04 | 37,958 | 2.2 % |
| 2026-05 | 191,056 | 11.0 % |
| 2026-06 | 187,703 | 10.8 % |
| 2026-07 | 227,894 | 13.1 % |
| 2026-08 | 241,437 | 13.9 % |
| **2026-09** | **850,789** | **48.8 %** |

**What that does to Safar:** its scan reads all 1.74 M rows and filters to ~940 k. Pruning would
make it read ~940 k instead — saving roughly the scan half of ~2.6 s, so **about 1–2 seconds today**
off a 15 s read. The ~45 aggregate expressions run over the same rows either way. **Partitioning
does not fix Safar.** Only fewer devices (a shorter range) or fewer aggregates will.

**What it does to Muqabla:** nothing at all, unless the `created_at` floor above is added.

**What it genuinely fixes, and this is the real reason to do it:**

1. **Retention becomes `ALTER TABLE ... DROP PARTITION` — instant.** That retires the
   `10,000 rows a day` cap against **53,575 arriving**, which otherwise falls ~43,000/day behind
   from about **March 2027** and never catches up. It also stops rewriting nine secondary indexes
   per deleted row.
2. **The 503 future-dated rows finally go**, because a partition is dropped by *arrival*, and they
   arrived in the past. Today they can never reach the cutoff.
3. **The cost stops growing with the table**, which was decision 0121's whole argument.

## A risk I expected, measured, and did not find

I expected partitioning to **hurt** Muqabla's shape, because MySQL has no global indexes on a
partitioned table: every index is per-partition, so a device lookup that does not bound the
partition key must probe every partition's tree.

I built both tables — same columns, same `(app_instance_id, event_timestamp)` index, 300,000 rows,
one plain and one in eight monthly partitions — and measured:

| | plain | partitioned |
|:--|--:|--:|
| Muqabla shape (device lookup, **no** `created_at` bound) | 0.10 s / 0.22 s | **0.05 s / 0.05 s** |
| Safar shape (range scan **with** `created_at` bound) | 0.03 s | **0.01 s / 0.00 s** |

**The partitioned table was equal or faster in both.** So the concern is **not confirmed**, and I am
not reporting it as a risk. The caveat is honest too: 300,000 rows on a fast Mac with everything in
memory is not 1.74 M rows on a two-core VPS, and that test can only be run by doing it.

## What the change involves

- **The primary key must change** from `(id)` to `(id, created_at)` — MySQL requires every unique key
  to contain the partition column. That is a **full table rewrite**, not an index build.
- It is `ALGORITHM=INPLACE, LOCK=NONE`-capable, so the app keeps reading and writing, but the whole
  2.24 GB is rewritten and there must be that much free disk (there is: 39 GB free).
- **12 partitions plus a `MAXVALUE` catch-all**, one per month, with a small scheduled job that adds
  next month's before it is needed. A `MAXVALUE` partition that silently collects everything is how
  partitioning quietly stops working.
- Flyway must not run it at boot for the same reason as the index ALTER — it would hold the
  container's start for the length of a full rewrite. Same pattern: run by hand, and write the
  migration to check `information_schema` first so it is a no-op afterwards.

## Rejected

- *Partitioning by `event_timestamp`.* It would make the 503 future-dated rows permanent and stop
  Safar, the Live Events list and the event summary pruning — four reads to buy one.
- *Doing it before the index ALTER is deployed and proven.* The owner asked for one at a time and
  that is right: two rewrites of the same table at once leaves nothing to attribute a result to.
- *Quoting "6× faster".* Measured: pruning is ~2× today and reaches ~6× only at steady state, and
  the read it would speed up is not the one that is slow.

## Open questions for the owner

1. **Which column?** I recommend `created_at`, **plus** a `created_at >= :from - 30 days` floor added
   to Muqabla so it prunes too — measured to lose effectively nothing (0.10 % of rows arrive more
   than a week late). That floor is a code change and would ship separately from the migration.
2. Given the measured gain — **~1–2 s off Safar today, nothing off Muqabla without the floor** — is
   partitioning still worth a full 2.24 GB rewrite **now**, or is its real value the retention fix,
   which becomes urgent around **March 2027**?
