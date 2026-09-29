# 0186 — Google Play's update prompt is counted from the check to the landing

- **Date:** 2026-09-29
- **Status:** built, merged into `VC_113_VN_149` (merge `df30d49d`, feature `8a89ee04` on
  `feat/update-prompt-events`). Ships with build 114. No schema change, no server change, no UI change.
- **Asked by:** the owner, 2026-09-29: *"iski ginti wala kam abhi krdo taky data aa saky phir usky baad decision
  laingy"* — count it now, decide later.

## The question it answers

In the 24 h to 2026-09-29, about 200 of 954 active Android phones (21 %) were two or more builds behind
(vc 94–106), while 1.4.9 (vc 113) was at 99 %. Nothing said why. For each phone behind, one of:

1. Play never offered it (Play said "not available", or the check failed);
2. Play offered it and the sheet did not open;
3. the user declined Play's sheet;
4. the user accepted and the download failed or was cancelled;
5. it downloaded and nobody pressed Restart;
6. Restart was pressed and Play refused to install;
7. it landed.

**The owner's later decision** — whether we need our own "What's new / please update" dialog — depends on which
of these is large. This change changes none of them: the prompt appears on exactly the conditions it did before
(`checkForUpdate(isFlexible = true)` at the splash, `resumeUpdateIfRequired` at start).

## Decided

All six are **coded** events. Play answers the check, Play draws the sheet, Play reports the download, and Restart
is Material's own snackbar action, so no auto-captured tap can carry any of them (AGENTS-EVENTS §1.3, §1.23). An
outcome is a parameter, never an event per outcome (§1.1). An absent key is unknown (§1.7). Play's codes become
Play's own words, and an unlisted code keeps its number, `unknown_<n>` (§1.15).

| Event | When | Parameters |
|---|---|---|
| `update_check` | Play answered (or failed) the splash's check. **Once per process when an update is offered; otherwise at most once per 24 h per phone.** | `outcome` `answered\|failed` · `requested_type` `flexible\|immediate` · `availability` `available\|not_available\|in_progress\|unknown` · `install_status` (`unknown\|pending\|downloading\|installing\|installed\|failed\|canceled\|requires_ui_intent\|downloaded`) · `current_version_code` · only with an update: `available_version_code`, `staleness_days` (Play's `clientVersionStalenessDays`, absent when Play does not know), `update_priority`, `flexible_allowed`, `immediate_allowed` · on `failed`: `error_code` + `reason` (Play's `InstallErrorCode` word, e.g. `app_not_owned`, `play_store_not_found`, `api_not_available`) + `exception_class` |
| `update_prompt_result` | One per launch of Play's sheet: its answer, or the launch that failed | `outcome` `accepted\|declined\|failed\|launch_failed` (`RESULT_OK`, `RESULT_CANCELED`, `RESULT_IN_APP_UPDATE_FAILED`) · `type` · `path` `check\|resume` · `answer_ms` (launch → answer) · `available_version_code` · on `launch_failed`: `reason` `not_started\|send_intent_failed` + `exception_class` · an unlisted result: `unknown_<n>` + `result_code` |
| `update_download_result` | The download ended. Never a progress tick. Once per outcome per process. | `outcome` `downloaded\|failed\|canceled` · `elapsed_ms` since acceptance · `bytes_downloaded`, `total_bytes` · on `failed`: `error_code` + `reason` · `available_version_code` |
| `update_restart_offered` | The "Update downloaded / Restart" snackbar was handed to the UI. Once per process. | `path` `download` (the listener saw it finish) \| `resume` (a launch found it already downloaded) |
| `update_restart_tapped` | Restart pressed | `path` of the offer |
| `update_restart_failed` | `completeUpdate` failed | `error_code` + `reason`, `exception_class` |

**The landing is a parameter, not an event:** `app_cold_start.updated_from_version_code` = the build this install ran
at its previous cold start, when it differs from the build running now. It is how an update is seen to have landed
whichever way it came (the prompt, the store, auto-update). The build is kept beside the open count
(`analytics_journey` preferences, `last_version_code`).

- Absent on a first install, and on a cold start of the same build.
- **Absent on everyone's first cold start of build 114**, because no earlier build recorded one. So the stamp
  answers from the update *after* 114 onwards. Until then, landing is read on the server: the same `app_instance_id`
  later sending a higher `app_version_code` (the second query below).
- A downgrade (a sideload; Play never does one) is also a different build and is reported the same way.

**The activity result was never read.** `startUpdateFlowForResult` was called with request code 1001 and nothing
overrode `onActivityResult`. `MainActivity` now forwards it to `AppUpdateChecker.onActivityResult`, which reports it
and does nothing else.

**Where things live** (`invoice-kmp-app`):
- `core/in-app-update/.../UpdatePromptTelemetry.kt` — plain Kotlin, no Play types: the mapping, the rate limit, the
  per-process memory. One instance per process (`ProcessUpdateTelemetry`), because the activity is recreated.
- `PlayUpdateCodes` copies Play's constants; `PlayUpdateCodesTest` fails if Play ever moves one.
- `InAppUpdateManager` calls it beside each existing branch; no branch changed.
- `LastRunBuild` / `updatedFromVersionCode` in `core/analytics`, stamped by `AnalyticsLifecycleObserver`.

**Volume.** A current phone sends one `update_check` a day. A phone with an update pending sends one check per cold
start, plus 3–6 rows per update it goes through. `app_cold_start` goes from 15 to 16 keys at most.

**iOS does nothing.** There is no Play update on an iPhone, and the App Store updates apps itself. `AppUpdateChecker`
on iOS stays a stub and sends nothing. `updated_from_version_code` is Android-only for now; iOS's cold start does not
carry it.

## Rejected

- **One event per step outcome** (`update_accepted`, `update_declined`, `update_download_failed`, …) — §1.1. One
  answer is one row with `outcome`.
- **One event for the whole flow with a `step` parameter** — six different moments under one name would make every
  count a filter nobody remembers to write.
- **A separate `update_prompt_shown` row.** Play delivers the sheet's answer through `onActivityResult`, also to a
  recreated activity. So "shown" is every `update_prompt_result` except `launch_failed`, and a second row would count
  one sheet twice. The cost: a sheet whose answer never arrives is not counted.
- **A row per download progress tick** — thousands of rows that say nothing the end state does not.
- **An `update_landed` event** — the new build's `app_cold_start` already fires exactly once at that moment. A
  parameter on it costs nothing (§1.1).
- **Reporting the landing from the old build** (for example after `completeUpdate` succeeds) — Play kills the process
  to install, so that row is usually never written.
- **A `update_check` on every check.** Most phones are current, and their check says nothing the version column does
  not. Once a day keeps the one case that matters: a phone that is behind while Play says `not_available`.
- **Changing the prompt** (immediate instead of flexible, our own dialog, a different moment) — that is the decision
  this data exists for. It is the owner's, later.

## The owner's query (once data arrives)

Phones Play offered an update to, by the build they were on: prompt shown → accepted → downloaded → Restart → landed.

```sql
SET @from = '2026-10-01 00:00:00', @to = '2026-10-15 00:00:00';
WITH offered AS (
  SELECT app_instance_id AS dev, MIN(app_version_code) AS from_vc, MIN(event_timestamp) AS t0
  FROM analytics_events
  WHERE event_name = 'update_check'
    AND event_timestamp >= @from AND event_timestamp < @to
    AND platform = 'Android' AND build_type = 'release'
    AND params->>'$.availability' = 'available'
  GROUP BY app_instance_id
),
steps AS (
  SELECT o.dev, o.from_vc,
    MAX(e.event_name = 'update_prompt_result'
        AND e.params->>'$.outcome' IN ('accepted', 'declined', 'failed'))                AS shown,
    MAX(e.event_name = 'update_prompt_result' AND e.params->>'$.outcome' = 'accepted')     AS accepted,
    MAX(e.event_name = 'update_download_result' AND e.params->>'$.outcome' = 'downloaded') AS downloaded,
    MAX(e.event_name = 'update_restart_tapped')                                            AS restart_tapped,
    MAX(e.event_name = 'app_cold_start'
        AND e.params->>'$.updated_from_version_code' IS NOT NULL
        AND e.app_version_code > o.from_vc)                                               AS landed
  FROM offered o
  JOIN analytics_events e
    ON e.app_instance_id = o.dev
   AND e.event_timestamp >= o.t0 AND e.event_timestamp < @to + INTERVAL 7 DAY
   AND e.event_name IN ('update_prompt_result', 'update_download_result',
                        'update_restart_tapped', 'app_cold_start')
  GROUP BY o.dev, o.from_vc
)
SELECT from_vc, COUNT(*) AS phones_offered, SUM(shown) AS prompt_shown, SUM(accepted) AS accepted,
       SUM(downloaded) AS downloaded, SUM(restart_tapped) AS restart_tapped, SUM(landed) AS landed
FROM steps GROUP BY from_vc ORDER BY from_vc;
```

Run against production on 2026-09-29: it parses and plans, and returns no rows, as it must before build 114.

**Landing before the stamp exists** (updates *to* 114, which 114's own stamp cannot see): any row from a newer build
on the same phone. Per build the phone was on in the window, how many were later seen on a newer one:

```sql
WITH seen AS (
  SELECT app_instance_id AS dev, MIN(app_version_code) AS from_vc, MIN(event_timestamp) AS t0
  FROM analytics_events
  WHERE event_name = 'app_cold_start' AND platform = 'Android' AND build_type = 'release'
    AND event_timestamp >= @from AND event_timestamp < @to
  GROUP BY app_instance_id
)
SELECT s.from_vc, COUNT(*) AS phones,
       SUM(EXISTS (SELECT 1 FROM analytics_events e
                   WHERE e.app_instance_id = s.dev AND e.event_name = 'app_cold_start'
                     AND e.event_timestamp > s.t0 AND e.event_timestamp < @to + INTERVAL 7 DAY
                     AND e.app_version_code > s.from_vc)) AS later_on_newer_build
FROM seen s GROUP BY s.from_vc ORDER BY s.from_vc;
```

**The other half of the answer** — phones behind that Play never offered anything:

```sql
SELECT app_version_code, params->>'$.outcome' AS outcome, params->>'$.availability' AS availability,
       params->>'$.reason' AS reason, COUNT(DISTINCT app_instance_id) AS phones
FROM analytics_events
WHERE event_name = 'update_check' AND platform = 'Android' AND build_type = 'release'
  AND event_timestamp >= @from AND event_timestamp < @to
GROUP BY 1, 2, 3, 4 ORDER BY 1, 5 DESC;
```

A phone on an old build with `availability=not_available`, or `outcome=failed` with `reason=app_not_owned`
(not installed from Play), is behind for a reason no prompt of ours could fix.

## Caveats

- **Verified by unit tests only.** 30 new tests (the mapping of every Play code and result, the once-per-process and
  24 h limits, the landing on a first install, the same build and an upgrade), and a test that fails when either
  limit or the landing rule is removed. This Mac had no emulator and the test Pixel was not reachable on
  2026-09-29, so no debug-build run was made. A debug build gets no update from Play in any case, so on a device only
  `update_check` (`not_available` or `failed/app_not_owned`) and `updated_from_version_code` can appear.
- **`update_restart_offered` is "handed to the UI", not "drawn".** The snackbar is `Indefinite` and waits behind any
  snackbar already on screen. A launch asks Play twice (the `init` and the snackbar binding), so it was handed over
  twice before and still is; it is counted once.
- Rows from builds before 114 have none of these events. A phone that updates from 107 to 114 through the prompt is
  not counted by the prompt events, because 107 does not send them. Its landing is visible only through the server
  query above.
