# 0087 — CI keeps running on the production box

**Status:** decided by the owner on 2026-09-14 ("Jaisa hai").

**Related:**
- `memory/ci-runner-shares-production.md`;
- the 25 × 500 of 2026-09-13, 00:00–00:05 UTC;
- the VPS move at the end of September.

## Context

- **GitLab's jobs run on a runner on the production VPS.** That covers `test`, `build:docker` and `deploy`, beside the
  app and MySQL.
- **On 2026-09-13, between 00:00 and 00:05 UTC,** the `test` job of pipeline 2843772345 raised the box's load from
  0.59 to 28.4.
  - The database pool timed out 59 times.
  - `/v2/analytics/track` answered 500 twenty-five times.
- **In the 30 days to 2026-09-13** there were 121 pipelines:
  - `test`, 1,044 min;
  - `build:docker`, 599 min;
  - `deploy`, 223 min.

  GitLab's free tier gives 400 minutes a month.

## Decided

- **CI stays on the production box, as it is.** A deploy may slow the server briefly.

## Rejected

- **A separate small server for CI,** about $5–10 a month.
- **GitLab Premium,** $29 per user per month for 10,000 minutes.

## Consequences

- **A deploy's test job can slow the app,** and now and then make requests fail, as on 2026-09-13.
- **The existing guards stay:**
  - CI job containers are the kernel's first choice to kill when memory runs out (`oom_priority.sh`, +800);
  - the sentinel ignores RAM and CPU while a CI job runs.
- **Revisit at the end-of-September VPS move,** where other projects will share the new box.
