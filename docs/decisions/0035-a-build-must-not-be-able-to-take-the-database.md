# 0035 — A build must not be able to take the database

**Date:** 2026-09-05 · **Status:** partly done, one number still to measure

## What happened

At 01:44 the phone rang: *"Server ki RAM bhar rahi hai (96.8%)"*. It was true, and it was us.

| time (UTC) | host RAM | JVM heap | what was running |
|---|---|---|---|
| 19:20–19:38 | ~60%, flat | 20–35% | normal |
| 19:40 | 78% | 25% | CI started building `d121f1c` |
| 19:44 | **95.6%** | 25% | **threshold crossed, ntfy sent** |
| 19:46 | 58% | 30% | build finished, memory returned |

The app was never in difficulty — heap under 35% throughout, GC at 0.34%, no OOM, no restart, no
kernel OOM kill. The build that caused it was our own deploy of the health alerter.

## What was wrong, in two separate ways

**The alert was a sample, not a state.** The sentinel read one value and spoke. Every number it
watches spikes for ordinary reasons: a JVM fills its heap right before a collection, a backup reads
the disk, a build compiles. A phone that rings for those learns to be ignored, and an ignored phone
is worth nothing on the night it matters.

**The arrangement it exposed is real.** The GitLab runner is a container on the production box, with
`concurrent = 1` and **no memory limit on job containers**. On 8 GB it shares with the app (capped at
3 GiB), **production MySQL running on the host with no limit at all**, Jariya's API, the exchange
service and the monitoring stack. A build landing on a traffic peak could have the kernel choose the
production database. That is not a monitoring problem.

## Decided

1. **A threshold crossed once is a sample; crossed twice in a row, it is a state.** The sentinel runs
   every two minutes, so two breaches means four minutes.
2. **Our own build does not get to raise an alarm.** While a CI job container is running, host RAM
   and CPU are logged with the reason and not alerted.
3. **If memory runs out, the kernel takes the build.** `oom_priority.sh` on a one-minute cron:
   production MySQL `-700`, the app `-500`, other services `-300`, CI job containers `+800`. It
   costs nothing until memory is actually exhausted. A failed pipeline is a re-run; a killed
   database is an outage.

## Verified, not assumed

A drill sampled every five seconds through a real build while a **control copy** of the same script
ran beside it with the guard disabled and its notifications redirected to a file.

```
RAM above 92% for 10 consecutive readings, peak 94.5%, CI=2

CONTROL (guard off):  WOULD-ALERT: Server ki RAM bhar rahi hai (92.1%)
REAL    (guard on):   ram=94.5 above 92, but a CI job is building - not an alert
real alerts sent:     none
```

The control is the point. Without it the run would only have shown a quiet phone, which is also what
a broken script produces.

## Rejected

- **Raising the threshold.** Hides real problems along with the noise, and the reading was correct.
- **Silencing RAM alerts generally.** The number was true; only the verdict was wrong.
- **Capping job memory tonight, by guess.** A cap set too tight fails the pipeline and blocks
  deploys. `ci_mem2.sh` samples `memory.current` every five seconds (this kernel has no
  `memory.peak`, so the figure is a floor) — the cap gets set from that measurement, not from an
  estimate.

## Still open

The memory cap itself, and the larger question of whether CI belongs on the box it deploys to.
