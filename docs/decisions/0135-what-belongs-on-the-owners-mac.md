# 0135 — What belongs on the owner's Mac: the test loop, not the pipeline and not production

- **Date:** 2026-09-20
- **Status:** an answer, not a change. Nothing built, nothing applied to the Mac or the VPS.
- **Asked by the owner, 2026-09-20:** *"achy sy check ker ky batao ky kia main local machine MacBook
  per ye sara setup nhi ker sakta — ab mery pass M3 machine hy 36 GB RAM ky sath."*

## The one measurement that decides it

Run on the Mac today, the full backend suite from clean, no warm daemon:

| | test suite |
|:--|--:|
| **M3 Max, natively** | **147 s** (`clean test`, 1,244 tests) |
| the VPS's CI `test` job, median of 13 runs | **1,088 s** |
| the same job at its worst | 1,315 s |

**About 7× faster.** Some of the CI figure is a fresh clone and a cold dependency cache that the
local run has warm, so the honest range is **5–7×**. Either way the Mac is not a little quicker; it
is a different kind of fast.

## Decision

| what | verdict |
|:--|:--|
| **(a) a fast local dev/test loop on the Mac** | **Yes — do this.** It is where the whole win is. |
| **(b) the Mac as a GitLab CI runner** | **No.** Possible, and the wrong trade. Reasons below. |
| **(c) production on the Mac** | **No, and not a close call.** |

## (a) The local loop — why this is the answer

The suite already runs here. What the owner gets is the thing he actually wants: **he sees whether
something works in about two minutes instead of eighteen, without touching the VPS at all.** No
minutes spent, no load on production, no pipeline to watch.

Three practical notes, all measured today:

- **Docker Desktop is currently set to 2 CPUs and 5 GB** (`Cpus: 2, MemoryMiB: 5120`) on a machine
  with **14 cores and 36 GB**. As configured, the containerised half of the work has exactly the
  VPS's core count. Raising it is one dialog and is most of the remaining speed.
- The test MySQL is already here (`invotick-test-mysql`, `127.0.0.1:13306`) and is what the two
  context tests need.
- The suite must run **one at a time** — that is already the rule on this machine, and the shared
  lock exists for it.

## (b) The Mac as a CI runner — why not

**It would work.** It is also the wrong machine for the job, for reasons that are not about speed:

1. **Architecture.** The Mac is `arm64`; the VPS runs `amd64`. Our `Dockerfile` **compiles inside
   the image** (`FROM gradle:8.13-jdk21 AS builder` → `gradle bootJar`), so a
   `--platform linux/amd64` build on the Mac would run the entire Gradle compile under emulation. I
   tried to put a number on that penalty with micro-benchmarks and **could not get one I would stand
   behind** — so I am not quoting one.
   *The good news is that the question can be removed rather than answered:* the jar has **no native
   dependencies** (checked — no netty-tcnative, no JNA, no SQLite, no classifiers), so it is
   architecture-independent. Splitting the Dockerfile — build the jar natively, then a second tiny
   file that only does `FROM eclipse-temurin:21-jre-alpine` + `COPY app.jar` — makes the amd64 image
   almost free to produce anywhere. **That is worth doing on its own merits**, whoever builds it.
2. **It only works while the laptop is awake, open and online.** The owner works from his iPhone
   (`owner-works-from-iphone`), and a laptop that sleeps mid-build leaves a job hanging until it
   times out.
3. **`stage` is production.** A pipeline that runs on a personal laptop is one that can be
   interrupted halfway, and `invotick-apis/CLAUDE.md` already records what a half-run pipeline costs:
   on 2026-08-23 a retried job shipped an older image over a newer one and silently removed three
   things from production while every pipeline showed green. Adding a machine that can close its lid
   mid-deploy makes that class of failure more likely, not less.
4. It solves a problem we have already halved twice today — the buffer pool (decision 0126) and CI
   priority (decision 0134).

## (c) Production on the Mac — no

Home internet has no uptime commitment and a dynamic, residential IP; residential addresses are
widely refused by mail providers and treated as low-reputation by everything else. The TLS
certificates, the domain, `stage.invotick.com`, the backups, the monitoring and the nightly jobs all
point at a machine that is expected to be there at 04:00. A laptop is not that machine, and the
question is not really about horsepower.

## What I would do

1. **The local loop (a), properly set up** — raise Docker Desktop's CPUs and memory, and write down
   the two commands that run the suite. ~2 minutes to an answer instead of ~18.
2. **Split the Dockerfile** so the image build stops recompiling inside Docker. It makes every build
   faster on any machine and removes the architecture question entirely.
3. **Leave CI where it is**, now that it runs at low priority and spends the free minutes first
   (decision 0134).

## Rejected

- *The Mac as a runner.* See (b).
- *Quoting an emulation multiplier from my micro-benchmarks.* The first measured shell startup, the
  second was I/O-bound on hardware-accelerated SHA. Neither measured what it claimed, so neither is
  reported as a number.
- *Production on the Mac.* See (c).

## Open questions for the owner

1. Shall I raise Docker Desktop's allocation (2 CPUs / 5 GB → say 8 CPUs / 16 GB) and write the
   local test loop down as two commands?
2. Shall I split the Dockerfile so the image stops being compiled inside Docker?
