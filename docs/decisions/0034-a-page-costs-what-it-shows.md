# 0034 — A page costs what it shows, not what the database holds

**Date:** 2026-09-04 · **Status:** decided, being applied

## Context
On 2026-09-04 the backend died twice of `OutOfMemoryError`. The cause was one job, written in April,
that built a summary of every user by loading every row of `analytics_events` — 988,339 entities —
into the heap. It runs every 20 minutes whether or not anyone opens the page it feeds, so it had been
doing this ~72 times a day for five months, getting heavier as the table grew: 53,000 rows in April,
988,000 today. The first failure went unnoticed for 3 h 43 m and took the admin panel, Google
sign-in and the share-link mint with it, because the JVM stayed alive with no memory to answer.

Measured the same day, the panel's other endpoints tell the same story: All Users **57.9 MB**,
All Users (stats) **28.5 MB**, Inventory **5.2 MB**, Invoices 2.5 MB / 6.7 s, Contact Data 5.1 s
(over an 82,898-row `findAll()`), Live Events **HTTP 500**.

## Decision
**A request or a scheduled job may only read what it is about to show.** Its cost must scale with the
page, the user, or the date window — never with the size of a table.

In practice:
1. Every list endpoint takes `page`/`size` with a hard cap. No unbounded `findAll()` in a webpanel or
   admin path.
2. Counting and summarising happen in SQL. Loading rows in order to count them moves the table into
   the heap.
3. Every analytics query carries a date range, and that range is indexed.
4. A figure that cannot be produced without scanning a large table is **pre-computed** (a rollup
   updated on a schedule), and the page reads the rollup. Everything else is read live — a
   pre-computed figure is a figure that can be stale, so it is a cost, not a default.
5. Heavy per-user detail belongs to that user's drill-down, never to a list of all users.

**The test is cost, not popularity.** The page that killed production had not been opened in weeks;
its schedule kept running. "Most visited" is the wrong filter — "how many rows does this touch" is
the right one.

## Rejected
- Raise the memory limit and move on — 2 GiB to 3 GiB buys a few months at the current growth, and
  the same morning arrives again. (The limit was raised anyway, as headroom, not as the fix.)
- Pre-compute everything for every page — staleness and machinery nobody asked for; most pages are
  already bounded and correct.

## Consequences
New pages answer one question before they are written: *how many rows does this touch?* If the
answer is "all of them", the design changes before the code is written. A guard test fails the build
when a webpanel service reaches for a whole table, and the JVM now exits on OOM (with a heap dump)
so a repeat is a restart and an alert, not a silent three-hour outage.
