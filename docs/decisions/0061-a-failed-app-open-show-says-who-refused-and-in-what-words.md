# 0061 — A failed app-open show says who refused it, and in what words

- **Date:** 2026-09-12
- **Status:** decided (owner, 2026-09-12: *"pending work start kro apni tarteeb sy"*, on the user-journey
  agent's recommendation); built for 1.4.6 on `invoice-kmp-app` `feat/146-journey-instrumentation`,
  not merged, not yet seen on a device.
- **Decision:** When `app_open_decision.outcome` is a failed show — `show_failed` on the resume and
  landing paths, `ad_show_failed` on the splash path — it carries two parameters:
  - `refused_by=guard` + `reason` ∈ `already_showing | no_activity | activity_finishing |
    no_cached_ad | host_not_resumed`: one of our own checks in `AppOpenAdManager.show()` refused
    before the SDK was asked;
  - `refused_by=sdk` + `reason` = the SDK's word from the show table (`internal_error | ad_reused |
    not_ready | app_not_foreground | mediation_show_error | unknown_<n>`), the same word
    `ad_show_failed.reason` carries (decision 0043).

  No new event.

## Why

`show()` answers `onFailed` from five places. One is the SDK's `onAdFailedToShowFullScreenContent`,
which also sends `ad_show_failed`. The other four are our guards, and they sent nothing, so a failed
show could only be explained by pairing it with an `ad_show_failed` row — and most had none.

| 7 days to 2026-09-12 | failed-show decisions | with an `ad_show_failed` in the same process + path | none |
|---|---:|---:|---:|
| vc101 (1.4.5) | 12 (splash 2, landing 5, resume 5) | 2 (both resume, `app_not_foreground`) | **10** |
| vc97 (1.4.4) | 327 (landing 134, resume 119, splash 74) | cannot be paired: `ad_show_failed` has no `path` before 1.4.5 | — |

On vc97 only the aggregate could be read (243 decisions against 67 `ad_show_failed` on 2026-09-11,
72 % unexplained).

## Rejected

- **A new event for our guards** (`app_open_show_refused`). AGENTS-EVENTS §1.1: the decision already
  fires at the right moment; the variation is a parameter.
- **Sending `ad_show_failed` for our guards.** That event and its `code` are the SDK's (§1.15). Our
  guards would raise the SDK's show-failure count and put our word beside an SDK integer.
- **`reason` without `refused_by`.** `host_not_resumed` (our lifecycle check) and `app_not_foreground`
  (the SDK's) are nearly one fact seen by two observers. A reader must not need to know which list a
  word came from.
- **Renaming the splash outcome `ad_show_failed` to `show_failed`.** It splits a stored value's history
  (§1.8). Both spellings stay and both carry the pair.
- **`error_domain` / `cause_*` on the decision.** They stay on `ad_show_failed`; the decision carries the
  word only.

## Consequences

- A failed-show query reads `outcome IN ('show_failed','ad_show_failed')` and groups by `refused_by`,
  `reason`. Absent means a build before 1.4.6: unknown, never a value (§1.7).
- The guard order lives in `AppOpenShowRefusal.firstGuard`, pinned by `AppOpenShowRefusalTest`.
  `show()` calls it, so the order tested is the order that runs. Proved to fail: reversing the first two
  guards and dropping `refused_by` turned exactly the two matching tests red.
- Still owed: a debug-device run counting both gateway log channels, and the first week of vc102 rows.
