# 0190 — A splash loss names its way out, its phase, and its country

- **Date:** 2026-09-30
- **Status:** built, **not merged**. App: branch `feat/splash-loss-measurement` off `VC_113_VN_149` (ships with the
  release after 1.4.9). Backend: branch `feat/analytics-country-from-ip` off `stage`. Docs: this branch.
  No schema change, no UI change, no change to any ad, gate or wait.
- **Asked by:** the owner, for the release shipping now: the next release must say **why** people leave on the splash.
- **Evidence:** `kaam/research/2026-09-29-splash-drop.md` §2 (loss anatomy) and §8 (data gaps 3–7).
- **Queries for the next study:** `kaam/research/2026-09-30-splash-loss-queries.sql` (loss by phase × reason, silent
  losses through `prev_process_id`, `ad_wait_source`, country coverage before/after, screens per cold start), with the
  baseline it gives on vc 106/107/113: first opens 74.7 % pass, 3.5 % lost silently; 68.5 % of lost first opens have a
  country; returning cold starts with no screen 6.2 % (vc106), 3.4 % (vc107).

## The gaps, and what closes each

| Gap (study §8) | Closed by | Where |
|---|---|---|
| 5. `app_background` has no reason | `app_background.reason` = `back\|home_or_recents\|screen_off\|other_activity\|unknown` (Android only) | `LeaveSignals` + `LeaveReasonTracker` (core:analytics), `MainActivity`, `PdfViewerActivity`, `MyApplication` |
| The phase had to be rebuilt by hand | `app_background.phase` = `before_first_frame\|loading\|ad_hold\|ad_showing\|after_gate` while the splash is in progress (both platforms) | `SplashJourney`, driven from the gateway |
| 4. Silent losses (2.6 % / 3.2 %) | `app_cold_start.prev_ended_in_splash` (`true\|false`), and when true `prev_splash_phase`, `prev_splash_ms`, `prev_process_id` | `SplashJourney` + a marker in `analytics_journey` prefs / NSUserDefaults |
| 3. Returning opens with no `screen_view` (3.1 %) | `screen_view` `pdf_viewer` | `PdfViewerActivity` |
| 6. No country for early leavers | `analytics_events.country` from `ip_records` when the batch sent none, with `params.country_source=ip` | backend `AnalyticsCountryFromIp` |
| 7. Remote Config cannot move the first-open wait | `splash_ready.ad_wait_source` = `bundled\|remote_cached\|remote_fresh`, and the rule in AGENTS-EVENTS §3.17 | `AdWaitSourceReporter` (core:ads) |

## Decided

**Parameters on existing events, no new event** (AGENTS-EVENTS §1.1). Absent means unknown everywhere (§1.7):
`reason` is absent on iOS, `phase` outside the splash, `prev_*` on a first install, `ad_wait_source` for a config a
build before this one stored, `country_source` on every row whose country the phone sent.

**The phase is read from the events the study classified by**, in the gateway, so no splash or ad code changed and
the app and the study cannot disagree: `app_cold_start` → S0, `screen_view splash_scr` → S1, `splash_ready` → S2,
`ad_shown` (`type=app_open`, `path=splash`) → S3, `app_open_decision` (`path=splash`) → S4, `first_screen_reached`
→ done for the life of the process.

**The reason and the phase are taken at the activity's stop, not at `app_background`.** Android reports the process
stop 700 ms after the last activity stops, and the gate can decide in those 700 ms (the ad arrives and is refused,
the budget runs out), which would put a leaver who left in the hold into `after_gate`. The order of reasons: activity
finishing → `back`; screen off → `screen_off`; an activity we started, an in-app excursion, an ad click or the ad's
own activity in front → `other_activity` (before the user's signals, because launching also produces the user-leave
hint); a back press within 3 s → `back` (Android 12+ moves the task behind the launcher on back instead of finishing
it); the user-leave hint → `home_or_recents`; else `unknown`. Back is observed without being taken: the key event up to
Android 15, and Android 16's `PRIORITY_SYSTEM_NAVIGATION_OBSERVER` callback, which the platform provides for this.

**The marker is written with `SharedPreferences.apply()`** on each change of phase — memory at once, disk on a
background thread — in the file `app_cold_start` already reads at that moment, so a cold start reads nothing new.

**The 126 returning cold starts with no screen were `PdfViewerActivity`**, the one screen outside both navigation
hosts (Invotick in "Open with" for a PDF). Measured, 7 days to 2026-09-29, vc106/107/113: 126 of 2,850 returning cold
starts announced no screen; 88 of them stayed ≥ 6 s or never paused, while a returning splash announces itself at p90
2.4 s; 13 showed a resume ad over it; none had a tap, because that activity never had the tap logger either. It now
announces `pdf_viewer` once per arrival (not again on a rotation), so `first_screen_reached` follows with
`screen=pdf_viewer`. **Those opens never had a splash: exclude them from splash pass-through.** The rest (under 3 s,
about 23) are real S0 losses.

**The server's country comes only from `ip_records`**, read-only, one indexed read per new address, cached in memory
(≤ 5,000 addresses, about 0.5 MB; a hit for 6 h, a miss for 10 min). No outside lookup, no address stored, never over
the phone's own country, never for `Platform.Web` (its address is Vercel's).

## Rejected

- **A new `app_left` or `splash_abandoned` event.** One leave, one event: `app_background` with parameters (§1.1).
- **A timer or `commit()` for the marker.** A synchronous disk write on the main thread five times per cold start
  buys nothing: the loss happens seconds after the last phase change, long after `apply()` has reached the disk.
- **Stamping `phase` on every event.** Only the leave needs it; the rest carry `screen` and `ms_since_start`.
- **Overriding back (an `OnBackPressedCallback`) to see it.** It would take the predictive back-to-home animation
  away, which changes what the user sees.
- **Calling the outside lookup services from ingestion for a miss.** It would send every early leaver's address to
  four third parties, store it in `ip_records`, and spend the quota the three-hourly batch runs on (decision 0072
  calls it paid). See the open question below.
- **A Remote Config A/B of the first-open ad wait.** The fetch had come back by `splash_ready` in 31 of 3,683 first
  opens; see AGENTS-EVENTS §3.17 for how a first-open test must be built.

## Open — the owner's

1. **The server's country will cover few of the people it is for.** A new phone's first batches arrive seconds after
   install, and `ip_records` learns an address up to three hours later (the batch). Measured on users created
   2026-09-22..28: 178 of 2,663 (6.7 %) had an address already in `ip_records` when they were created; all 2,663 did
   later. So expect about **7 %** of first-open early leavers to gain a country, more for returning phones. Two ways to
   the rest, both the owner's call: (a) an outside lookup on a miss, asynchronously, with its quota and privacy cost;
   (b) a free local country database (DB-IP Lite, CC BY 4.0, monthly file) read in memory — no per-call cost, no
   address leaves the server, a small monthly download to maintain.
