# 0162 — The backend tests run on the owner's Mac, shared minutes second, never the VPS

- **Date:** 2026-09-28
- **Status:** decided by the owner; built on `invotick-apis` (`.gitlab-ci.yml`, `.gitlab/ci/child.yml`, `ops/mac-runner/`).
- **Owner, 2026-09-28:** *"Test mere Mac par chalein."*
- **Supersedes** 0135 (b), "the Mac as a CI runner — no", and the VPS fallback of 0134.

## Why

- The month's 400 shared minutes ran out on 2026-09-28 (399, then 400 used).
- The VPS cannot run the suite. Compile + tests + MySQL got its 2560m runner container killed (exit 137),
  and raising the limit is what caused the 2026-09-21 outage. The box is also being replaced this month.
- The stop-gap of that morning (`4e575ac`) built the jar only and relied on a local run before every push.
  That is a gate somebody has to remember.

## Decision

`test` runs, in this order:

1. **the owner's Mac.** GitLab runner 56820544 `mac-m3-docker`, tag `mac`, docker executor. Each job gets a
   fresh container and a fresh `mysql:8`, with nothing mounted and no cache, like a shared runner;
2. **GitLab's shared runner,** while at least 60 of the month's minutes are left;
3. **nowhere.** The job fails with "no test runner", posts to Slack, and nothing deploys.

The only exception is an emergency override, `TESTS_RAN_ON_MAC=<sha>`, on a commit whose message names a local
run. Then the VPS builds the jar only.

## How

- `choose-runner` runs on the VPS and decides. It generates a child pipeline, and `tests-and-deploy` triggers it
  with `strategy: depend`. A dotenv variable cannot drive `tags:`.
- `build:docker` and `deploy:staging` moved into the child. A parent cannot take a child's artifacts, and in
  one pipeline a failed or cancelled `test` stops both, as before.
- **The Mac counts as free only when its runner was heard from in the last 180 s.**
  - An idle runner never refreshes `contacted_at`, so a LaunchAgent runs `gitlab-runner verify` every minute.
  - It does so only while the runner service runs and Docker Desktop answers.

## Rejected

- **A `$RUNNER_TAG` from dotenv in `tags:`.** Never expanded: pipeline 2867717241 waited for ever.
- **The earlier shell-executor Mac runner** (56585838, `ops/ci-mac-runner`, 2026-09-22).
  - It ran in the owner's own environment against his local `invotick-test-mysql`, so it was not the clean
    slate a shared runner gives.
  - It is paused and out of the Mac's config.
- **Raising the VPS runner's memory.** That caused the 2026-09-21 outage.
- **A Gradle cache volume on the Mac.** It is a speed win, but the owner asked for exactly the shared runner's
  clean slate, and a restored cache is how a red guard test once read green.
