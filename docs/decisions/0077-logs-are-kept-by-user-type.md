# 0077 — Logs are kept as long as the user's type allows: guests 15 days, registered 30, premium 90

**Status:** decided by the owner on 2026-09-13 ("Guest 15, sign-up 30, premium 90"). Being built on
`feat/log-retention-by-user-type` plus the VPS config for Loki and promtail. Not live.
**Related:** 0050, 0076 (logs carry ids and codes, never values), `memory/log-pipeline-stream-limit.md`,
`memory/storage-not-ram.md`.

## Context (read-only, 2026-09-13)

- **Logs live on the VPS disk, not in RAM.**
  - The Loki store is 3.3 GB (3.1 GB of chunks).
  - The Docker log files that promtail reads are 118 MB.
  - Loki holds about 157 MB of recent lines in memory, and writes them to its WAL on disk as well.
- **Loki had no retention,** so every line since July stayed, including the lines that carried users' values
  before 0076.
- **The owner asked** that retention follow the user's type: guests the shortest, signed-up users longer, premium
  users the longest.

## Decided

| Log lines of | Kept for |
|:--|:--|
| guests | 15 days |
| registered (signed-up) users | 30 days |
| premium users | 90 days |
| lines with no user (system work) | 30 days |

- **Each log line carries a `user_type` label** with a small fixed set of values: `guest`, `registered`, `premium`,
  or none. Loki's compactor deletes each stream at its own age.
- **Premium is known without a database query on every request:** a small bounded set of premium ids, rebuilt on a
  schedule. It is cheap to rebuild and loses nothing on a restart.

## Rejected

- **A per-user label** (a user id on each stream). It is the 643k-streams mistake that blinded Loki for a month.
- **Keeping everything.** Personal data, including the old value lines, would stay for ever, and the disk would keep
  growing.
- **One age for everyone.** The owner asked for the split.

## Consequences

- Lines written before the label exists fall under the 30-day default. The oldest lines, including the old value
  lines, go once the compactor runs.
- Debugging a guest's problem has a 15-day window. Lean on `sync_failure` rows and the app's own reports, which
  retention does not touch.
