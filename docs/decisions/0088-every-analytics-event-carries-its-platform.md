# 0088 — Every analytics event carries its platform

**Status:** decided by the owner on 2026-09-14 ("Abhi"), against the recommendation to wait. Being built by the
user-journey agent: the migration first and alone (`V20260914_05`), then the code.

**Related:**
- 0083 and 0085: iPhones send events;
- AGENTS-EVENTS §1.12, §1.17 and §3.8: a dimension the panel filters on must live on the event.

## Context

- **`analytics_events` has no platform column.** The panel reads the platform from `analytics_sessions_v2`, and that
  works only for rows that carry a session.
  - No iOS event from before build 17 has a session.
  - Web events never have one.
- **Build 17 is the first iOS build that sends events at all.** Each iPhone's first minutes send an old backlog with
  no session.

## Decided

- **`analytics_events` gains a nullable `platform` column:** `Android`, `iOS` or `Web`. The server fills it on arrival,
  from the batch's platform.
- **Old rows are filled only with what can be proven,** never a guess. A row nothing proves stays NULL, which means
  unknown (§1.7).
  - The first iOS row ever arrived at 2026-09-13 20:34:49 UTC. A row before that is Android, unless it is a web row
    (`surface=web_share_link`).
  - A later row that has a session takes its session's platform.
- **The migration ships alone and first.** Then the code follows:
  - the fill on arrival;
  - the backfill, which runs in batches and not inside the migration;
  - the panel's reads.

## Rejected

- **Waiting until the iOS app is on the App Store,** which was the recommendation. The owner chose now.
- **Guessing the platform from build numbers** (`< 50` means iOS). It breaks as iOS build numbers grow.
- **Reading the platform through sessions for ever.** That cannot label rows with no session, and it adds a join to
  every funnel pass.

## Consequences

- **Every panel filter by platform reads the event itself.** The iOS backlog rows get a platform wherever something
  proves it.
- **Adding a nullable column is instant in MySQL 8.** An index on it rebuilds the table online, so first measure
  whether one is needed.

## Built (2026-09-14)

- **Commits:**
  - backend `analytics/0088-event-platform`: `fcb25a1` is `V20260914_05` alone
    (`ADD COLUMN platform VARCHAR(16) NULL, ALGORITHM = INSTANT`);
  - `4b19a6e`: ingestion reads `prev_screen` into `previous_screen`;
  - `4cbb7fb`: the platform written on arrival, the backfill and its admin endpoint, and the readers;
  - panel `4771874`: the version pickers show "iOS · 1.4.6 (17)", or "platform unknown".
- **INSTANT, proven** on an 8.0.46 copy whose table definition is byte-identical: 0.07 s, against 13.44 s for a
  rebuild.
- **No index is needed.** Every platform-filtered query already reads the event row.
- **Tests:**
  - 10 of 13 new tests fail without the code;
  - the backfill's `platform IS NULL` guard has its own red test;
  - the backend suite is 849/849.
- **Decided by the lead:**
  - The backfill is started by an admin, with a dry run first. It does not start itself.
  - The 416 session-less rows of the iOS backlog stay NULL.
  - `_04` deploys before `_05`.
- **Rejected:**
  - A backfill that starts itself after boot. It has nowhere to record that it finished, so it would re-read 1.4M
    rows on every deploy.
  - Treating `app_version_code < 50` as proof of iOS. The server accepts Web batches at any build number.
  - An index on `platform`, because no measured query needs one.
  - An ENUM column. In strict mode it refuses a platform it does not know, and those events would be lost.
- **Expected backfill counts,** from production on 2026-09-14:
  - Web: 105;
  - Android: about 1,373,317;
  - the session's platform: 4,622;
  - NULL: 416.
