# 0236 — The backend builds its jar and runs its tests at the same time; only the deploy waits for both

Decided: 2026-10-31. Decided by: the owner ("fast and smooth, according to the M3's capacity"; "no load on the server").
Written by the VPS manager. Code: `invotick-apis`, branch `perf/ci-fast-deploy` (commits `05909ce`, `e2d416c`, `e4cb3ae`).
**Status: built, dry-run measured, NOT yet on `stage`** (a push to `stage` is a production deploy and waits for the owner's yes).

## What was measured before (pipeline 2974505878, commit `3a11ba37`, 2026-10-22)

| Step | Seconds | Note |
|:--|--:|:--|
| whole pipeline, push to live | 1258 | 1267, 1317 and 1788 on three other runs (the 1788 had a busy Mac) |
| `test` | 516 | container 60, Gradle + libraries download 128, compile 120, tests 167, artifact upload 30 |
| `build:docker` | 586 | artifact download 20, kaniko build 30, **registry push 524** |
| `deploy:new-server` | 143 | git checkout 36, artifact download 21, server 64 (pull 13, start and health 50) |

Everything ran in sequence: the image waited for the whole test run, and the deploy waited for the image.

## Why the push took 524 s (measured 2026-10-31, nothing assumed)

- The same kaniko push of the same 142 MB jar from a terminal on this Mac: **574 s**. So it is not the CI container.
- A 20 MB upload to Cloudflare from the host: 3 s; from inside a container: 3.8 s. The Mac's internet and Docker's network are fine.
- A raw 20 MB `PATCH` to `registry.gitlab.com`: **103 s (0.19 MB/s)**. The registry endpoint is slow to upload to from here; the
  cause is not found. Download is fast (the server pulls the 142 MB in 13 s).
- kaniko is not emulated (the image is arm64) and compression of 130 MB takes 3 s. The CPU is not the cost.
- So the only lever is to send fewer bytes: the jar is 142 MB, of which 129 MB are libraries that change only with `build.gradle.kts`.

## Decision

1. `test` and the jar are built **at the same time** (`build:jar`, new). `build:docker` starts when the jar exists, beside `test`.
2. **The gate keeps its meaning and is now written out:** `deploy:new-server` needs `test` AND `build:docker`. A red, failed,
   timed-out or cancelled test, or a failed image, means no deploy. `NewServerLayoutGuardTest` fails the build if that is dropped.
   Seen in the first dry run: `test` failed, `deploy (dry run)` was *skipped*.
3. The image is split with Spring Boot's own `extract --layers` into the libraries (129 MB) and our code (6.6 MB), and kaniko
   builds it with `--reproducible`, so the libraries layer is byte-identical on every run and the registry already has it.
   Measured with the real registry: first push 577 s (the one-off), **second push with only the app layer changed: 78 s in total,
   35 s of pushing**. Without `--reproducible` the same jar gave three different layers (kaniko stamps today's time).
4. **Nothing is added to the server.** It pulls the same tag and starts it through the same `deploy-invotick`; its pull is smaller
   (6.6 MB instead of 142 MB when the libraries are already there). Its script, compose file and health check are not touched.
   The layered jar was started next to the fat jar against the test MySQL: both boot (9.0 s and 7.1 s).
5. The Mac is sized to what it has (36 GB, 14 cores). Docker Desktop's VM: 6 CPUs / 8 GB -> **8 CPUs / 14 GB** (disk untouched).
   Runner: `concurrent` and `limit` 1 -> **2**. `concurrent = 1` was the manager's own number, set against a 5 GB VM; it was never
   the owner's rule (see the correction in 0235). Backup of the old files: `/private/tmp/claude-501/*-before-*`.
6. One named Docker volume, `invotick-gradle-home` on `/home/gradle/.gradle`, keeps Gradle's downloads between jobs. It is a
   deliberate change to "no cache volume": it holds content-checked downloads only, the project, build output and database stay new
   per job. The path matters: `/root/.gradle` is a link to it in the image, and a volume mounted on the link stayed empty (the second
   dry run still downloaded Gradle, 2 m 40 s). Pre-filled once by hand (862 MB, 267 s cold).
7. A Slack notice can no longer fail the test job (`|| true`): on a branch that cannot see the protected webhook variable, curl exited
   3 and every dry run died in its first second; a Slack outage would have blocked a real deploy the same way.

## Measured after (dry run of the branch, pipeline 3012152947, the Gradle volume filled)

| Job | Seconds |
|:--|--:|
| `build:jar` (start 15:28:08) | 110 (Gradle 54, artifact upload 36) |
| `test` (start 15:28:09) | **380** — container 25, Gradle configure 44, compile 71, tests ~220 |
| `build:docker` (dry run, nothing pushed) | 97 (one artifact download failed and retried: 30 s) |
| `deploy (dry run)` | 46 (an echo; the real deploy was 143 s) |
| whole pipeline | **459** |

The real push adds ~35 s to `build:docker`, which still ends before `test`. Expected on `stage`: 459 - 46 + about 110 for the real
deploy = **about 520 s (8.7 min) against 1258 s**. That figure is an expectation until the first real pipeline is timed.

## Not measured, not done

- The first real deploy of the layered image on the server. The server's health check and automatic rollback remain the net.
- Whether the CI's libraries layer is byte-identical to the one pushed from this Mac (tag `perf-layered-A`). If not, the first real
  push takes ~9 min once. After the first real pipeline the `perf-*` tags in the registry are deleted.
- The registry has **no cleanup policy** (`container_expiration_policy.enabled = false`), so every commit's image stays. They are
  now ~6.6 MB each instead of 142 MB. Turning a deleting policy on is the owner's decision.
- Earlier I said mysql's image pull cost 44 s every run. Not shown: it was one pull of a changed tag. Not part of this plan.
- Further trims (each one its own commit, timed against 459 s): the 44 s Gradle configure at the start of `test`; the parent's
  `choose-runner` (14 s, once 109 s queued); the real deploy's 36 s git checkout (now depth 1, unmeasured); test forks (risky: some
  tests share a schema).

## Rejected (do not propose again)

- **Build the image on the server, or send it the jar.** Owner, 2026-10-31: no load on the server.
- **Deploy without waiting for the tests**, tests running beside the deploy. About 4 min, but a broken build would reach production
  for minutes and the pipeline is the safety net (AGENTS.md section 2).
- **A job-count or percentage cap on the Mac** other than the owner's own 90 % rule (0235 correction).
- **A different image builder (crane, jib)** — not needed once `--reproducible` gave a stable libraries layer.
