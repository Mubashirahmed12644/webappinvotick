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
