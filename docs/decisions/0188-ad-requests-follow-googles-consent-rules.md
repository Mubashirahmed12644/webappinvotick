# 0188 — Ad requests follow Google's consent rules, and the returning splash wait gets a 50/50 test

- **Date:** 2026-09-29
- **Status:** built on app branch `fix/splash-consent-race-and-startup` (off `VC_113_VN_149` @ `0475387c`), **not
  merged**, for the build after 1.5.0: `69ba867b` (race), `2906acd2` (consent parameters), `2f153bf7` (wait test),
  `4d7eded6` (startup). Unit gate 2,087 tests, 0 failed (baseline 2,061); iOS simulator compile passes. No schema
  change, no server change.
- **Asked by:** the owner, 2026-09-29: *"tm ny ads request ko consent ky sath keon joda jabky gdpr ky consent just
  personlised ads ko rokty hain. isky hisab sy setting kero"*, and a test only of the returning-open splash wait.

## What Google's own documents say (read 2026-09-29)

| # | Question | Google's words | Source |
|:--|:--|:--|:--|
| 1 | When may an app request ads? | "Before requesting ads, use `canRequestAds()` to check if you've obtained consent from the user." | [UMP guide, Android](https://developers.google.com/admob/android/privacy) |
| 2 | Before this launch's lookup? | "`canRequestAds()` always returns `false` until you have called `requestConsentInfoUpdate()`." Ads may be requested "immediately after you have called `requestConsentInfoUpdate()`", because "the UMP SDK might have obtained consent in the previous app session." | same |
| 3 | What makes `canRequestAds()` true? | Once `requestConsentInfoUpdate` is called, it is true when the status is `NOT_REQUIRED` or `OBTAINED` — so **any** answer, a refusal included. | [ConsentInformation reference](https://developers.google.com/admob/android/privacy/api/reference/com/google/android/ump/ConsentInformation) |
| 4 | What does a refusal get? | Limited ads: "serve ads without using personal data for personalization", when "user preferences don't allow serving Personalized Ads or Non-personalized Ads". Programmatic limited ads are on by default. | [Limited ads](https://support.google.com/admob/answer/10105530) |
| 5 | EEA/UK/CH request with no TC string? | "Google will also attempt to serve an eligible limited ad for requests from the EEA, the UK, or Switzerland that don't include a TC string from a Google-certified CMP." | same |
| 6 | What must the publisher obtain? | Consent to "the use of cookies or other local storage where legally required" and to "the collection, sharing, and use of personal data for personalization of ads". | [EU User Consent Policy](https://www.google.com/about/company/user-consent-policy/) |
| 7 | Certified CMP | "Only traffic from a certified CMP is eligible for personalized ads." | [CMP requirements](https://support.google.com/admob/answer/13554116) |

## The four questions, answered

1. **Outside the EEA/UK/CH the splash ad should be requested at once.** The rule: a request needs Google's answer
   from this phone at least once — this launch's, or the previous session's (row 2). On a **fresh install** the
   region is not known until UMP's first lookup returns, and on Android that lookup needs an Activity, so the first
   request waits for it (1.4.9: first request p50 0.94 s → 3.17 s). Nothing in Google's documents lets an app
   request before a first answer when it cannot tell the region (see 3).
   - **Found and not fixed on this branch:** on returning phones, too, the Application start reads
     `canRequestAds() == false` (row 2) and the start logic then treats a stored status plus that `false` as
     "form owed". Measured on vc113, non-EEA opens after a phone's first launch of the build: **48 of 137** first
     foregrounds read "consent pending", 46 of them on phones that had already requested an ad on the build. The
     fix built for it — keeping Google's last real answer and using it at the next start, as row 2 allows — was
     **refused by the session's permission check** as a consent-weakening change, so it is left for the owner to
     approve explicitly. Nothing of it is on the branch.
2. **A refusal or partial answer still gets ads.** Audited: every ad path (app-open, interstitial, banner, both
   platforms) gates on `canRequestAds()` alone (`ConsentGate.allowed()` / `open`), which is true after any answer
   (row 3). No code reads the purposes to refuse an ad; the TCF strings are read only for Firebase Consent Mode, the
   `consent_decision` outcome and Meta (decision on partner consent, 2026-09-28). The GMA SDK reads the stored TC
   string itself and Google serves personalised, non-personalised or limited (rows 4, 7). **No change needed.**
3. **EEA/UK before the form is answered: requests keep waiting.** Row 5 describes what Google's servers do with a
   request that has no TC string; row 1 is Google's integration instruction, and it says to check `canRequestAds()`
   first. Row 6 makes device storage the publisher's obligation, and the SDK touches the device before Google's
   server decides anything. The documents do not grant permission to request before the answer, so the app does not.
   The land-first placement of the form is unchanged. **If the owner wants requests before the answer, that is a
   legal question for counsel, not an engineering one.**
4. **`consent_state` and `ads_mode` on the ad events** — built, below.

## Decided and built

- **The consent race is fixed at its root.** `ConsentAdsSwitch.googleSays(true)` wrote `settled` before `open`, and
  the splash's wait, resumed inline on `Main.immediate` between the two writes, read "answered, not open" and
  recorded `consent_pending` at the moment Google said yes (vc113, non-EEA: 35 of 53 such decisions within 50 ms of
  the preload the same answer fired; about 22 % of non-EEA first opens). The two booleans are one value now,
  `ConsentAdsState` (`ASKING|SHUT|OPEN`), and the splash reads only that. `consent_pending` keeps its meaning; it
  stops counting the race. A test reproduces the production shape (red before, green after).
- **`consent_state` + `ads_mode`** on `ad_request` (app-open, interstitial, banner; Android and iOS) and on
  `app_open_decision`. `consent_state` = UMP's status (`not_required|obtained|required|unknown`); `ads_mode` = what
  the stored answer allows (`personalised|non_personalised|limited|none`, `ConsentSignals.adsMode`) — the ceiling,
  not what Google served. `ad_loaded`, `ad_shown`, `ad_impression_value` join by `ad_request_id` (§1.18). Absent =
  unknown (§1.7). No new event.
- **The returning-open splash wait test.** Remote Config `returning_splash_wait_test_percent`, a string, bundled
  default `"0"` = off. Arms `wait_6s` (today) and `wait_4s`. Returning opens only (the splash's `isFirstOpen=false`
  path, i.e. `splash_ready.destination=directly_to_main`); a first open is never touched. Dealt once per install, at
  its first returning splash **while the share is above 0**, from FNV-1a of the install id with salt
  `returning_splash_wait_v1`, stored and kept for ever. `splash_wait_arm` on every event while known;
  `returning_splash_wait_assigned` (coded) at the dealing; `splash_wait_ms` (the budget actually given) on the
  splash's `app_open_decision`. Back to `"0"` = everybody on today's wait at the next open. Android only.
  - **The Remote Config trap (research §6.2) does not apply here:** the share is read at process start from what the
    **previous** run's fetch stored, which is what a returning phone has. `ReturningSplashWaitArmTest` proves the arm
    takes effect with no fetch in the process. It does mean a change in the console reaches a phone one open later.
  - The arm of the **first** dealt open is known from its `app_open_decision`; `splash_ready` carries it from the
    next open on (the dealing happens at the splash's ad decision, after `splash_ready`).

## Rejected

- **Requesting before Google's first answer on a fresh install** (the pre-1.4.9 timing), on the strength of row 5 —
  see question 3.
- **Guessing the region from the phone** (SIM, locale, time zone) to skip the lookup — a guess on a legal boundary.
- **Dealing every install `wait_6s` while the test is off** — the overlay holdout's shape — because it would lock
  every returning install into control before the owner switches the test on.

## Reading the test

```sql
-- Returning-open splash wait test: pass-through and ad value per returning open, per arm.
-- A returning open = one process with app_cold_start is_first_open=false whose splash went to the dashboard
-- (the only splash that uses the returning wait). Arm from the decision, else from splash_ready.
-- Set the window to start after the owner switched the share on; exclude test devices (Appendix B of the research).
WITH cs AS (SELECT params->>'$.process_id' pid FROM analytics_events
  WHERE event_name='app_cold_start' AND params->>'$.is_first_open'='false'
    AND platform='Android' AND build_type='release' AND app_version_code >= 114
    AND event_timestamp >= '2026-10-01' AND event_timestamp < '2026-10-15'),
ready AS (SELECT params->>'$.process_id' pid, MAX(params->>'$.splash_wait_arm') arm FROM analytics_events
  WHERE event_name='splash_ready' AND params->>'$.destination'='directly_to_main'
    AND event_timestamp >= '2026-10-01' AND event_timestamp < '2026-10-16' GROUP BY 1),
dec AS (SELECT params->>'$.process_id' pid, MAX(params->>'$.splash_wait_arm') arm,
    MAX(CAST(params->>'$.splash_wait_ms' AS UNSIGNED)) wait_ms, MAX(params->>'$.outcome') outcome FROM analytics_events
  WHERE event_name='app_open_decision' AND params->>'$.path'='splash'
    AND event_timestamp >= '2026-10-01' AND event_timestamp < '2026-10-16' GROUP BY 1),
passed AS (SELECT DISTINCT params->>'$.process_id' pid FROM analytics_events
  WHERE event_name='first_screen_reached' AND event_timestamp >= '2026-10-01' AND event_timestamp < '2026-10-16'),
val AS (SELECT params->>'$.process_id' pid,
    SUM(CAST(params->>'$.value_micros' AS UNSIGNED)) micros,
    SUM(IF(params->>'$.type'='app_open', CAST(params->>'$.value_micros' AS UNSIGNED), 0)) app_open_micros
  FROM analytics_events WHERE event_name='ad_impression_value'
    AND event_timestamp >= '2026-10-01' AND event_timestamp < '2026-10-16' GROUP BY 1)
SELECT COALESCE(dec.arm, ready.arm) arm, dec.wait_ms,
  COUNT(*) opens,
  SUM(passed.pid IS NOT NULL) passed, ROUND(100 * SUM(passed.pid IS NOT NULL) / COUNT(*), 1) pass_pct,
  SUM(dec.outcome = 'ad_dismissed') splash_ads_watched, SUM(dec.outcome = 'load_timeout') load_timeouts,
  ROUND(SUM(COALESCE(val.micros, 0)) / 1e6 * 1000 / COUNT(*), 3) usd_per_1000_opens_all_ads,
  ROUND(SUM(COALESCE(val.app_open_micros, 0)) / 1e6 * 1000 / COUNT(*), 3) usd_per_1000_opens_app_open
FROM cs JOIN ready ON ready.pid = cs.pid
LEFT JOIN dec ON dec.pid = cs.pid LEFT JOIN passed ON passed.pid = cs.pid LEFT JOIN val ON val.pid = cs.pid
WHERE COALESCE(dec.arm, ready.arm) IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;
```

- `wait_ms` separates opens that got the arm's wait from opens after a kill switch (`6000` in the `wait_4s` row).
- Value is everything the process earned — the splash, the landing and resume ads, interstitials — because a shorter
  wait can move an ad from the splash to the landing rather than lose it. Banner value rides from 1.4.9 on.
- Size: returning opens are about half of all opens. A 3 pp difference in pass-through near 80 % needs about 2,900
  returning opens per arm (80 % power, α 0.05); value per open needs its own variance check before any reading.

## Also on the same branch (no decision needed, recorded for the release notes)

- The throwaway WebView that warms Chromium for the ad now starts just **after** the first frame instead of before it.
- The splash's second phase (session, and the guest on a first open) starts beside its 300 ms minimum display instead
  of after it. Neither touches the ad request, the consent flow or the gate's budget, which starts at `splash_ready`.
- The trade is the owner's (monetisation rule): the result is two numbers per arm, never a verdict.
