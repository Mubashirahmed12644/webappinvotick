# Release Impact on the admin panel: the plan

**Khulasa (Roman Urdu, 8 lines)**
1. Panel mein ek naya hissa "Release Impact": upar releases ki timeline (1.5.0 se 1.5.4), neeche har feature ka apna section.
2. Har section apni kism ke hisaab se: ads ka section ads ki tarah (request, load, show, kamai), paywall ka paywall ki tarah, doosri invoice funnel ki tarah.
3. Har section ke upar ek faisla-badge: Behtar / Bura / Koi saaf farq nahi / Data kam hai. Har number ke saath ginti (n) likhi hogi.
4. Agar koi hifazati number (crash, kamai, pehli invoice, raftaar) bigra, to badge laal, aur saath likha hoga kaunsa Remote Config switch band karna hai.
5. Muqabla barabar ka: 1.5.3 abhi 20 % par hai, is liye usi hafte ke naye installs 117 aur 116 par aamne saamne; jo release 99 % par gayi us ka sirf pehle/baad ka muqabla, "jura hua" likh kar, "is ne kiya" nahi.
6. Aaj ads, paywall, rating, crash aur splash ka version-wise koi endpoint nahi; G1 ki seedhi (Muqabla) aur A/B Tests ka page maujood hain, unhi ka tareeqa dohraya jayega.
7. Banane ki tarteeb: pehle 1.5.3 bamuqabla 1.5.2 (namoona), phir 1.5.4 ki doosri invoice (feature ke saath hi), phir 1.5.0 ads, phir baqi; har qadam farzi numbers ke test ke saath.
8. Database mein naya table sirf aap ki ijazat se; pehla daur bina naye table ke, aur production par har parhai sasti aur hadd mein.

Owner of this plan: the `release-impact` agent (`.claude/agents/release-impact.md`). Written 2026-10-19, read-only: no app,
backend or panel code was written. Companion: [`FEATURE-REGISTRY.md`](FEATURE-REGISTRY.md) (row IDs such as `153-03` below
point there). Rules it obeys: `AGENTS.md` sections 1, 5a, 5b; `AGENTS-EVENTS.md`; `docs/measurement-definition-of-done.md`;
decisions 0114 (equal window from first open), 0141 (test harness), 0142 (device journey), 0222 (A/B Tests page).

Sources for the data claims (verified 2026-10-19): backend `origin/stage` `8ffa71c`; panel `origin/main` `403cf71`;
7 bounded GETs through the admin API (`admin-whoami.sh` pattern, all 200; raw answers in the session scratchpad, no
e-mails, no user ids).

---

## Part A. What the owner will see

### A.1 The area

One sidebar entry, **Release Impact**, after A/B Tests (it is analysis the owner opens on purpose, like A/B Tests; the
silence checks go to the Health Centre, never here). The page has three bands:

1. **Release timeline** (top). One row per release (Android 1.5.0 -> 1.5.4, iOS 1.0.1 / 1.0.2 on their own row, never
   mixed): production date, rollout % history, active devices per day per version (a small stacked area, versions
   coloured in order), and a marker per release. Each marker opens that release's sections. A warning chip when two
   releases' new-install windows do not overlap ("version aur calendar alag nahi ho sakte").
2. **Release card** (one per release): the **standard guardrail strip**, the same eight numbers for every release so
   releases can be compared at a glance: user-perceived ANR, crash rate, `error_shown` phones per 1,000, sync-defect
   devices, G1 24 h of new installs, ad revenue per active device-day, paywall net revenue per viewer, splash
   pass-through. Each with n, the previous release's value, and a red / grey / plain mark.
3. **Feature sections** (one per playbook, below). Each section follows the pattern of the agent file:
   - **Header:** release, date, rollout %, the feature, the declared expectation (or "reconstructed" in grey italics),
     the comparison type ("randomised" / "staged rollout, new installs" / "before-after, associated"), the verdict badge.
   - **Expectation vs result** line.
   - **KPI table:** primary, mechanism steps, guardrails (four families), each with arm values, difference, 95 %
     interval, n, and a status cell.
   - **Charts** (one idea each, listed per section).
   - **Segments** (collapsed, labelled "leads, not results").
   - **Honest limits** footer.
   - **Unknown row**: users the data cannot place (no country, no `entry`, iOS before lifecycle events), always shown.

### A.2 The verdict rule (all sections)

- **Badge from the primary KPI only.** Better / Worse when the 95 % interval of the difference excludes 0 **and** both
  arms meet the minimum n. Otherwise "No clear difference" (enough n) or grey "Not enough data" (below n). No green or
  red is ever drawn without n beside it.
- **Guardrails override.** A guardrail is **breached** when its whole 95 % interval lies on the bad side of its
  tolerance (non-inferiority read). A breach turns the badge to **Worse** with a red line: which guardrail, by how much,
  and the switch: *"Band karne ke liye: Remote Config `exit_question_enabled` = false"*. A guardrail whose point
  estimate is bad but whose interval crosses the tolerance is amber ("dekhte rahein"), never red.
- **Tolerances (default; a feature may declare tighter ones in its decision):**

  | Family | Guardrail | Breach when the interval is entirely beyond |
  |:--|:--|:--|
  | Trust | user-perceived ANR (Play) | +0.10 pp over the comparison, or above Play's 0.47 % line |
  | Trust | crash rate (Play) | +0.10 pp, or above Play's 1.09 % line |
  | Trust | `error_shown` phones per 1,000 active phones | +50 % relative |
  | Trust | return in days 2-7 (new installs) | -2.0 pp |
  | Money | ad revenue per active device-day (all formats, and per format) | -3 % relative (the owner's reference rule) |
  | Money | net premium revenue per paywall viewer | -3 % relative (with fewer than 10 buyers per arm: never red, "Not enough data") |
  | Activation | G1 within 24 h of first open (new installs) | -1.5 pp |
  | Speed | splash pass-through per cold start | -2.0 pp |
  | Speed | first-open `splash_ready.wait_ms` p50 | +300 ms |

- **Minimum n before any colour:** proportions: 200 finished units per arm and 10 outcomes per arm (0222's rule);
  means per device-day (revenue): 500 device-days per arm and 50 devices with an impression per arm; Play rates: Play's
  own published value only (Play withholds small samples); counts per 1,000: 2,000 exposures per arm. Each section also
  shows the **planned n** for its declared smallest effect and "about N more days at today's intake" (slower arm).
- **Statistics:** proportions: Wilson per arm, Newcombe hybrid score interval for the difference, pooled z (the
  A/B page's code, reused); revenue per device-day: device-clustered bootstrap (2,000 resamples, fixed seed) on values
  capped at the 99.5th percentile, the cap shown; medians and p75: bootstrap. Segment tables carry a Holm correction and
  the word "lead".
- **Looks:** read dates are declared per feature (24 h, day 7, day 30). The page shows the current numbers at any time
  but writes a recommendation (KEEP / ITERATE / ROLL BACK / WAIT) only at a declared read date. A novelty bump at 24 h
  that is gone by day 7 is shown as such.
- **Words:** codes and numbers come from the backend; every sentence is written in the panel (Roman Urdu), so wording
  never needs a backend deploy, and no backend string states an opinion about an ad (0222). Names say what was seen,
  never why (`AGENTS-EVENTS` §1.14).

### A.3 The comparison designs, in order of strength

1. **Randomised arms (ours):** tour, French UI, translated UI, returning-splash wait, and the 1.5.4 nudges holdout.
   Cohort = devices dealt an arm, new installs, first assignment (0222). "Caused" may be said.
2. **Staged rollout, new installs (Play's draw):** while a release is below 100 %, new installs whose **first** open is
   on the new build vs new installs whose first open is on the previous build, **same calendar days** (from the first
   new-build first open to the day the rollout widens), equal window from first open (0114), our phones out.
   - **Balance check shown first:** the new build's share of first opens per day should sit near the rollout %; the
     country mix of the two arms side by side. If the share is far from the rollout % (Play may not apply the
     fraction to new installs the way we expect), the section falls back to design 3 and says so.
   - **Updaters vs non-updaters** are shown only as a lead: early updaters are more active, so they flatter the new
     build.
   - Wording: "staged rollout, Play ne chuna" and "associated, strong" rather than "caused".
3. **Before / after with controls:** releases that went to 99 % at once (1.5.0, 1.5.1). New installs on build N vs build
   N-1, each on its own equal window from first open, with: country mix standardised to build N's mix (direct
   standardisation by country tier, the Codlytics `like.ts` method), weekday mix shown, and a list of known calendar
   events (Meta campaign changes, Remote Config changes, server deploys) drawn on the timeline. Where a part of the
   population could not be affected, it is the control (difference in differences), e.g. EEA vs non-EEA for consent.
   Always labelled "associated".

---

## Part B. The seven sections

Each section lists: the registry rows it covers, the **KPI table** (primary, mechanism, guardrails by family, segments,
time shape, counter-metrics), the **charts**, the **comparison**, the **verdict thresholds with minimum n**, and the
**switch per guardrail breach**. "Standard guardrails" = the release card's eight numbers of A.1, restricted to the
section's population.

### B.1 Section "1.5.3 against 1.5.2" (the pattern; build first)

Rows 153-01 to 153-13. Playbooks: rating, paywall, reliability. This is the release overview for a staged rollout and
the first place the pattern is proven; its sub-sections are B.3 (rating), B.4 (paywall exit question) and B.5
(reliability), shown with the 117 vs 116 comparison.

| KPI | Definition (unit, denominator) | Source | Min n / arm | Read |
|:--|:--|:--|:--|:--|
| **Primary (release)** | none: a release has no single goal. The card shows the eight standard guardrails, and each feature sub-section has its own primary | | | 24 h, 7 d |
| Balance | share of new first opens on 117 per day vs the rollout %; country mix per arm | `device_journey` (first open, version, country) | - | daily |
| Trust | ANR user-perceived, crash (Play, per versionCode); `error_shown` phones per 1,000 active; sync-defect devices; return d2-7 | Play Reporting API (new read); `error_shown`; `sync_failure`; `device_journey_hour` | as A.2 | daily, 7 d |
| Money | ad revenue per active device-day by `type` (app_open, interstitial, banner); impressions per device-day by type; paywall viewers, Continue, purchases, net revenue per viewer | `ad_impression_value`, `ad_shown`, `screen_view premium_scr`, `premium_purchase_result`, `purchase_charge` | 500 device-days | 7 d, 30 d |
| Activation | G1 24 h and 7 d of new installs; invoice created 24 h | `device_journey` (Muqabla ladder) | 200 | 24 h, 7 d |
| Speed | splash pass-through per cold start; `splash_ready.wait_ms` p50 / p90 | `first_screen_reached` / `app_cold_start` per `process_id`; `device_journey_hour.splash_ready_ms` | 2,000 cold starts | 24 h |
| Segments | country top 8, new vs updater, first session vs later, language (`lang_variant`), guest vs account | | leads only | 7 d |
| Counter-metrics | none at release level (see sub-sections) | | | |

- **Charts:** balance bar (share of first opens on 117 per day, rollout % as a line); paired bars with interval whiskers
  for the eight guardrails; daily line per guardrail with the release marked and the 7-day window shaded.
- **Comparison:** design 2 (staged, new installs), plus design 1 inside it for the tour holdout leak (153-08).
- **Verdict:** per sub-section; the release card goes red only on a guardrail breach.
- **Switches named on breach:** `exit_question_enabled` (paywall, Save / Share completion), `rate_sheet_direct_enabled`
  (rating, support load), `sync_unreachable_retry_enabled` (sync delay), `signup_email_suggestion_enabled` (sign-up),
  `anr_trace_params_enabled` (ANR family A from the trace collection itself); crash / ANR from a change with no switch:
  "halt the staged rollout in Play Console" (the owner's action, the one lever that exists while staged).

### B.2 Section "1.5.0: ads, consent and the splash" (ads playbook)

Rows 150-01 to 150-09, 150-06. Always filtered on `type`; banner reads only from 1.4.9.

| KPI | Definition | Source events | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary** | splash app-open ads **shown** per non-EEA first open (`app_open_decision` path=splash, outcome=`ad_dismissed`, / decisions), **with app-open USD per 1,000 first opens beside it** | `app_open_decision`, `ad_impression_value` joined by `ad_request_id` | 200 decisions per arm | 24 h, 7 d |
| Mechanism (per format, per path) | requests -> loaded -> shown -> paid; fill = loaded / requests; `consent_pending` share; `load_timeout` share; `ad_show_failed` by `refused_by`; `since_request_ms` p50 / p90 | `ad_request`, `ad_loaded`, `ad_load_failed` (`reason`, `message`, `adapter_*`, `ad_host_dns`), `ad_shown`, `ad_show_failed`, `app_open_decision` (`outcome`, `consent_state`, `ads_mode`, `splash_wait_ms`) | 200 requests | 24 h, 7 d |
| Money | ad revenue per active device-day, total and per format; impressions per device-day per format; eCPM per format (our `value_micros`; AdMob API for the money truth, see C.4) | `ad_impression_value`, `ad_shown` | 500 device-days | 7 d, 30 d |
| Trust | ANR (Play), return d2-7, `error_shown` | standard | | 7 d |
| Activation | G1 24 h of new installs | Muqabla | 200 | 24 h |
| Speed | splash pass-through; time from first open to `splash_ready`; exits by `phase` (`loading`, `ad_hold`, `ad_showing`) and `reason` (Back) | `app_background.phase|reason`, `splash_ready`, `first_screen_reached` | 2,000 cold starts | 24 h |
| Segments | EEA/UK vs rest (the consent control); `consent_state`; `ads_mode`; country top 8; first vs returning open | | leads | 7 d |
| Time shape | 24 h after release; day 7; day 30 (a returning phone's cached consent answer only shows from its second open) | | | |
| Counter-metrics | an ad moved from splash to landing is not lost: value per **process** (all formats), not per splash; ad clicks (`ad_clicked`, `other_activity` exits) are not losses; estimate-gate interstitials (150-07) add inventory and must not be read as a fall in invoice interstitials | | | |

- **Charts:** the pipeline funnel per format (requests -> loaded -> shown -> paid), 113 vs 114 side by side; stacked
  bars of `app_open_decision` outcomes per build with whiskers; revenue per device-day daily line with the release
  marked; failure-reason table (`reason` x `ad_host_dns` x `adapter_source`); splash exits by phase (bars).
- **Comparison:** design 3 (before / after, 113 vs 114, equal window), with EEA vs non-EEA as the difference-in-differences
  control for the consent rows (EEA phones could not get a splash ad either way, land-first). The returning wait test
  (150-03) is design 1 the day the owner switches it on: its own card with **pass-through and USD per 1,000 returning
  opens always side by side**, never a verdict, only the two numbers and the owner's question.
- **Thresholds:** primary: interval excludes 0 with 200 decisions per arm; revenue per device-day breach at -3 %;
  `consent_decision` error for EEA phones > 0 is a red trust line on its own (0 errors was the 114 state).
- **Switches named on breach:** `consent_gate_enabled` exists but is **never** offered as a fix (turning it off is an
  AdMob EU-policy breach; 0162). Named instead: `returning_splash_wait_test_percent` = "0" (wait test),
  `estimate_save_gate_enabled` (estimate gate), `meta_first_share_enabled` (Meta). For the consent race there is no
  switch: the next release.

### B.3 Section "Rating and feedback: 1.5.0 dialog, 1.5.3 support sheet" (rating playbook)

Rows 150-14, 153-01, 153-02.

| KPI | Definition | Source | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary** | store flows run per 1,000 weekly active Android devices: 1.5.3 = `rate_sheet_result` outcome `card_completed`; before = stars dialog `outcome=play_store` presses | `rate_sheet_result`, dialog submit tap (`stars`, `outcome`, `trigger`) | 2,000 active devices | 7 d, 30 d |
| Mechanism | dialog / sheet opens by door (`trigger`); help card vs rate card presses; `rate_sheet_result` outcomes (`card_completed`, `fast_end_listing`, `error_listing`, `listing_opened`, `listing_unavailable`) with `elapsed_ms` distribution; stars distribution; `store_review_requested` / `_not_requested` by `reason`; `rate_us_not_shown` by `reason` | | 200 opens | 7 d |
| Trust | 1-star share of stars given; Play average and rating count (**manual**, Console, entered by hand or by the bulk-report read in C.4); help messages per 1,000 active devices (`support_help_whatsapp` outcome `whatsapp_opened` + `copied`); topics | | 100 stars | 30 d |
| Money | none direct; ad revenue per device-day (the sheet holds the process's one ask, `OneAskGate`) | | | 7 d |
| Activation | G1 of new installs (the support sheet sits on the lists) | | | 7 d |
| Speed | none | | | |
| Segments | door (`trigger`); platform (**never sum `listing_opened` across platforms**: normal on iOS, a fallback on Android); country | | leads | |
| Time shape | Play's quota resets slowly: day 7 and day 30 | | | |
| Counter-metrics | the exit question and the rate sheet share the one ask per process: `store_review_not_requested.reason=exit_question_this_session` and `rate_sheet_this_session` counted; auto-shown dialog showings lost | | | |

- **Charts:** door funnel bars (opens -> rate press -> store flow); stars distribution per build (bars, 1-5); 
  `elapsed_ms` distribution with the 1,500 ms line; help topics bars; weekly line of store flows with releases marked.
- **Comparison:** design 2 for 117 vs 116 on **active devices of the same days** (not only new installs: the support
  icon is used by returning users). Play's rating cannot be split by arm: shown as a manual weekly number with the
  release dates drawn, labelled "Play, sab versions mila kar".
- **Thresholds:** 1-star share breach: +5 pp with 100 stars per arm.
- **Switch named on breach:** `rate_sheet_direct_enabled` = false (back to the stars dialog). Line held (0176, 0225):
  the store sheet is never shown only to 4-5 star answers; the panel never proposes it.
- **Honest limits:** whether anyone rated, whether Google's card was drawn (`card_completed` is a flow longer than
  1,500 ms, not a drawn card), whether a WhatsApp message was sent: all unknowable.

### B.4 Section "Paywall: 1.5.1 Continue fix, 1.5.3 exit question" (paywall playbook)

Rows 151-01, 153-03, 153-04.

| KPI | Definition | Source | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary (151-01)** | Continue presses that reach the store's sheet / Continue presses | `premium_purchase_result` (`outcome`, `reason`) | 100 presses | 7 d |
| **Primary (153-03)** | answered strips / strips shown; reasons per `question` x `entry` (counts only under 30 answers) | `paywall_exit_reason` | 30 answers for any percent | 7 d, 30 d |
| Mechanism | paywall viewers by door (`entry`) -> plans loaded (`plans`, `plans_ms`) -> Continue -> store result (`outcome`, `sub_response`) -> purchase -> charge; exit strips by `outcome` (`answered`, `skipped`, `timed_out`, `interrupted`) and `shown_ms` | `screen_view premium_scr`, Continue tap, `premium_purchase_result`, `purchase_charge`, `paywall_exit_reason` | | 7 d |
| Money | **net revenue per paywall viewer** (baseline $0.035, 1,783 viewers, 30 d); purchases per viewer; refunds and cancellations; **ad revenue per active device-day** (premium removes ads; ads and premium are linked) | `purchase_charge`, `user_revenue_day`, `ad_impression_value` | 10 buyers per arm before any colour | 30 d |
| Trust | `error_shown` on the paywall; Play rating (manual); uninstall proxy (no return d2-7) | | | 7 d |
| Activation | Save and Share completion on the screens the strip sits over (Save -> created, share sheet -> confirmed) | `create_inv_saved_click`, `invoice_created_success`, `share_bottom_sheet_open`, `invoice_shared_success` | 200 | 7 d |
| Speed | `plans_ms` p50 / p90 | | | 7 d |
| Segments | door, plan, country (prices differ 13x), first session vs later (**57 % of Continue pressers are first-session and are never asked**), guest vs account | | leads | |
| Time shape | 7 d (answers), 30 d (money), renewals at 30 / 365 d | | | |
| Counter-metrics | the strip holds the process's one ask (rating asks lost); a strip over the Save screen could delay a save | | | |

- **Charts:** door funnel (views -> Continue -> sheet reached -> purchase) per door, side by side per build; reasons
  bars per question (counts under 30 answers, never percent); per-country table of viewers / Continue / buyers / net
  revenue; net revenue per viewer with interval (grey until 10 buyers per arm).
- **Comparison:** 151-01 design 3 (114 vs 115); 153-03 design 2 (117 vs 116) for the money guardrails, while the
  answers themselves have no comparison arm (a measuring tool).
- **Thresholds:** Save / Share completion breach at -2 pp (200 per arm); revenue per viewer as A.2; with 8 buyers in the
  product's whole life, the money verdict is "Not enough data" for months: the section says how many weeks.
- **Switches named on breach:** `exit_question_enabled` = false (or `exit_question_gap_days` up). 0208 has no switch by
  choice; a breach there names "the next release". Never proposed: weakening the paywall or an ad (monetisation rule):
  any trade is a question with revenue and cost side by side.

### B.5 Section "Reliability: 1.5.1 to 1.5.3" (reliability playbook)

Rows 151-04 to 151-10, 152-02, 153-05, 153-06, 153-09 to 153-12.

| KPI | Definition | Source | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary** | user-perceived ANR rate per versionCode (Play), with crash rate beside it | Play Developer Reporting API (`anrRateMetricSet`, `crashRateMetricSet`, per versionCode, daily) | Play's own | daily, 7 d |
| Mechanism | our own `prev_exit` = crash / anr per 1,000 cold starts (>= 115 only); share of ANR opens carrying `anr_main_state` (>= 117); top Play clusters per version (new / gone / named fix -> 0: `2029a9ac`, `143b01ff`, `49892fbd`) | `app_cold_start` (`prev_exit`, `prev_exit_detail`, `prev_stack`, `anr_*`), Play `errorIssues` | 2,000 cold starts | 7 d |
| Trust | `error_shown` phones per 1,000 active per cluster (`action`, `subject`, `kind`, `sqlite_code`); downloads saved / (saved + failed) per OS band (Android 7-9 vs 10+); sync: devices with a live defect, unreachable reporters per 1,000 per week, `queue_renumbered`, 502-504 `sync_failed` | `error_shown`, `pdf_download_result` (`save_method`), `sync_failure`, `sync_failed` (`probe_*`) | 2,000 active devices | 7 d |
| Money | ad revenue per device-day (an ANR at start loses the splash ad) | | | 7 d |
| Activation | G1 24 h | | | 24 h |
| Speed | cold start to first frame (`ms_since_start` on the first `screen_view`) | | | 24 h |
| Segments | Android API level band, device maker (Transsion), RAM class if stamped, country | | leads | |
| Time shape | daily for 14 days after a release (crashes show early), then weekly | | | |
| Counter-metrics | a change that silences a report must not hide a failure: `sync_failed` down must come with `data_arriving_ended outcome=done` not down | | | |

- **Charts:** rate by version with releases marked (daily line, Play's bad-behaviour lines drawn); top clusters table
  (new / gone / named); `error_shown` clusters bars per version; Android 7-9 download success bars.
- **Comparison:** design 2 for 117 vs 116 (Play rates are per versionCode, so the staged split is natural); design 3
  for 115 and 116.
- **Thresholds:** as A.2; a named fix row is red if its cluster still has reports on the fixed version after 7 days.
- **Switches named on breach:** `sync_unreachable_retry_enabled`, `anr_trace_params_enabled`; otherwise "halt the
  staged rollout" (Play Console, the owner) or "fallback build stays 100 % for new installs" (Play).

### B.6 Section "1.5.4: second invoice" (activation playbook, built with the feature)

Rows 154-01 to 154-03. The measurement code ships in the same branches as the nudges (definition of done).

| KPI | Definition | Source | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary** | first-invoice sharers who create a **second** `invoice_created_success` within 7 days, on arm vs off arm (one per phone, full windows only) | `nudges_assigned` (arm), `invoice_shared_success`, `invoice_created_success` (`origin`, `repeat_entry`) | planned n per declared effect (+4 pp: about 1,500 per arm); colour from 200 | 24 h, 7 d, 30 d |
| Mechanism | A: card shown -> pressed / dismissed / left (`next_step_card`, `layout`) -> create opened -> created with `origin=repeat`; B: `repeat_action` opened / failed; C: strip -> opt-in (`reminder_opt_in`, `permission`) -> notification delivered -> opened (`unpaid_reminder`) -> reminder share (`purpose=reminder`) | new coded events of the mockup | 100 per step | 7 d |
| Time between steps | first share -> second invoice: median and p75 per arm | | | 7 d |
| Trust | duplicate invoice numbers = 0 (`ci_save_validation_failed field=invoice_number`); `repeat_action failed`; `error_shown`; `amounts_changed=false` share (watched, never a goal); reminder `asked_denied`, `stopped`; uninstall proxy; ANR | | | 7 d |
| Money | Save ad dialog shown, interstitial impressions and revenue per phone, both arms (more invoices = more Saves) | `ad_dialog_shown`, `ad_impression_value` | 500 device-days | 30 d |
| Activation | first-invoice confirmed share rate on arm not lower than off (the card sits after the share, it must not delay it) | | 200 | 24 h |
| Speed | none | | | |
| Segments | country (PK 21.9 % vs KE 6.5 % baseline), what happened to the first invoice (shared / downloaded / paid), first session vs later, notification permission state | | leads | |
| Time shape | 72 % of 7-day second invoices happen within 24 h: read 24 h first, day 7, day 30 (reminders act on day 3+) | | | |
| Counter-metrics | `origin=repeat` invoices that copy amounts unchanged (throwaway risk, G1 honesty); reminder shares excluded from G1 and from the review counter (`purpose=reminder`) | | | |

- **Charts:** funnel bars, arm side by side (share -> card -> press -> second invoice); cohort curve "made a second
  invoice by hour / day since first share" per arm (24 h, 7 d, 30 d marks); step-time distribution; per-nudge mechanism
  bars.
- **Comparison:** design 1, `nudges_holdout_percent`, dealt once per install by FNV-1a with its own salt, **code
  default = the test value** (the tour lesson: ~26 % of new phones decide before Remote Config arrives), plus design 2
  for the release guardrails.
- **Thresholds:** primary: interval excludes 0 at 200 per arm; "WAIT, about N weeks" from the planned n (at ~125
  sharers a week: +6 pp about 9 weeks, +4 pp about 19 weeks; reading all ~475 first-invoice creators a week shortens
  +4 pp to about 9 weeks: open question D.4).
- **Switches named on breach:** `next_step_card_enabled`, `repeat_action_enabled`, `unpaid_reminder_enabled` (each its
  own), `nudges_holdout_percent`.

### B.7 Section "Growth loop and speed: 1.5.0-1.5.1" (growth and speed playbooks)

Rows 150-08, 150-13, 150-17, 150-19, 151-02. Lower priority; built last.

| KPI | Definition | Source | Min n | Read |
|:--|:--|:--|:--|:--|
| **Primary (G2)** | receiver decisions (approved + rejected) and "Create your own" presses per receiver open, per build | `shared_invoice_opened` (`entry`), `shared_invoice_approved|rejected` (`decided_as`), create-own taps, web `shared_invoice_page_view` / `_create_own_click` | 200 opens | 7 d |
| **Primary (speed)** | first-open `splash_ready.wait_ms` p50 and splash pass-through | `splash_ready`, `first_screen_reached` | 2,000 cold starts | 24 h |
| **Primary (update prompt)** | phones offered an update that land on the new build within 7 days | `update_check`, `update_prompt_result`, `update_download_result`, `app_cold_start.updated_from_version_code` | 200 offered | 7 d |
| **Primary (Meta first share)** | cost per G1 on the `first_invoice_shared` ad set vs the install set (Meta side, manual or Marketing API) | Meta | - | 14 d |
| **Primary (iOS 1.0.x)** | iPhone first opens reaching G1 within 24 h | `device_journey` with `platform=iOS` | 200 | 7 d |
| Guardrails | standard; owner-opens producing a decision = 0 (`shared_invoice_decision_failed reason=sender`) | | | |
| Counter-metrics | Print and Download as substitutes for Share (G1 share leg) | | | |

- **Charts:** loop funnel (shares -> receiver opens -> decisions -> create-own -> installs with `iv_doc`); update
  adoption curve per offered build; wait-time distribution per build.
- **Comparison:** design 3; iOS on its own row, never with Android.

---

## Part C. The data

### C.1 What exists today and can be reused

| Need | Existing source (stage `8ffa71c` / panel `403cf71`) | Fit |
|:--|:--|:--|
| New-install cohorts per build, G1 ladder, equal window, `too_few`, Wilson, z, calendar warning | `GET /v1/webpanel/analytics/journey-compare` (0116; `by=version|country|tier|source|campaign|platform`, `windowHours` 1/24/72/168, reads `device_journey`, test devices out) | **reuse** for every Activation row and B.1's G1 line. Checked 2026-10-19: 116 (1,750) vs 115 (259), all steps `within_noise` |
| Randomised arms | `GET /v1/webpanel/ab-tests` (0222, live; `ExperimentCatalog`: `tour`, `ui_fr`, `ui_translated`, `splash_wait`; Wilson, Newcombe, z, 20-min cache, `MAX_EXECUTION_TIME(15000)`, 503 `computing`) | **reuse** the engine and add `nudges` to the catalog for B.6. Checked 2026-10-19: tour PROVEN, translated PROVEN, French LEANING, splash wait NOT_STARTED |
| Per-device activity per hour and build (active device-days, splash and ad timings) | `device_journey_hour` (0142, on stage): device x hour x build, `splash_ready_ms`, `ad_*_ms`, `guest_login_ms`, save / discard / premium clicks | **reuse** as the device-day denominator and for Speed; no read exposes it yet |
| Per-screen money and gate by version | `screen_stay` (0184): `app_version_code`, gate, `g1_24h`, purchases, `ad_*_micros`, `ad_*_n`; `/v1/webpanel/screen-map/*` | **reuse** for per-screen ad value by version (B.2, B.6 Save screen) |
| Revenue per user per day | `user_revenue_day`, `purchase_charge` (0182) | **reuse** for premium money; **no version column** (join via the device's build of that day from `device_journey_hour`) |
| One event's parameters by value per build | `GET /v1/webpanel/analytics/event-summary`, `event-detail` (`appVersionCode`, `buildType`, 366 days) | **silence checks and exploration only**: no platform filter, no test-device exclusion, filters on arrival time. Never a verdict source |
| Sync defects per build | `/v1/webpanel/sync-health/app-versions`, `/signatures` | **reuse** for B.5 sync rows |
| Errors users saw | `/v1/webpanel/errors-users-saw` (no params) | **reuse** cluster definitions; needs a version + date-range variant |
| Versions reporting | `/v1/webpanel/analytics/app-versions` | **reuse** for the timeline's active devices per version per day |
| Test-device exclusion | `testing_devices` table **and** `OurOwnAccounts` (`health.our-own.*`); 0222 flags, others drop | **use both**, flag-and-count like 0222 |
| Version floor | `analytics.min-app-version-code=91`, `AnalyticsVersionGate` (Web and iOS exempt) | respected by construction |

What does **not** exist: any per-version read for ads, paywall, rating, crash / ANR, splash timings, PDF results or
`error_shown` clusters; any release catalog; any silence check per feature event; the panel's version picker list
`lib/publishedVersions.ts` stops at 107. The panel has **no charting library** (hand-written SVG / CSS, e.g.
`features/ab-tests/components/Visuals.tsx`): the plan keeps it that way.

### C.2 Which events feed each section (and the indexes they ride)

- Version-bucketed counts (`app_version_code`, `event_name`, `event_timestamp`) ride
  `idx_analytics_events_version_name_ts`: B.2 pipeline counts, B.3 / B.4 / B.5 event counts per build.
- Per-device outcomes in a window ride `idx_ae_instance_ts_cover` with FORCE INDEX named (decision 0141's trap), the
  0222 / Muqabla shape: B.1 activation, B.6 primary, B.4 Save / Share completion.
- Rows whose `params` must be read (`type`, `value_micros`, `outcome`, `reason`) are fetched only inside a bounded
  range: 116 sent 4,680 `ad_impression_value` rows in 2 days, so 30 days of one build is about 70,000 row fetches.

| Section | Events / tables |
|:--|:--|
| B.1 | `device_journey`, `device_journey_hour`, `app_cold_start`, `first_screen_reached`, `error_shown`, `sync_failure`, `ad_impression_value`, `premium_purchase_result`, Play vitals |
| B.2 | `ad_request`, `ad_loaded`, `ad_load_failed`, `ad_shown`, `ad_show_failed`, `ad_clicked`, `ad_impression_value`, `app_open_decision`, `consent_decision`, `screen_view consent_form`, `app_background`, `splash_ready`, `returning_splash_wait_assigned` |
| B.3 | `rate_sheet_result`, `support_help_whatsapp`, stars dialog taps (`stars`, `outcome`, `trigger`), `support_sheet_*` taps, `store_review_requested|not_requested`, `rate_us_not_shown` |
| B.4 | `screen_view premium_scr` (`entry`, `plans`, `plans_ms`), Continue tap, `premium_purchase_result`, `paywall_exit_reason`, `purchase_charge`, `user_revenue_day` |
| B.5 | Play vitals, `app_cold_start` (`prev_exit*`, `anr_*`), `error_shown`, `pdf_download_result`, `pdf_print_result`, `pdf_share_result`, `sync_failed`, `sync_failure`, `data_arriving_ended` |
| B.6 | `nudges_assigned`, `next_step_card`, `repeat_action`, `reminder_opt_in`, `unpaid_reminder`, `invoice_created_success` (`origin`, `repeat_entry`, `amounts_changed`), `invoice_shared_success` (`purpose`) |
| B.7 | `shared_invoice_*`, web `shared_invoice_page_view` / `_create_own_click` / `_pdf_click`, `update_*`, `splash_ready` |

### C.3 Gap list: KPIs with no data source yet

Event and parameter gaps go to the **user-journey** owner (`.claude/agents/user-journey.md`), who decides names under
`AGENTS-EVENTS.md`; this list proposes, it does not name events finally.

| # | KPI with no source | What would close it | Owner |
|:--|:--|:--|:--|
| G-01 | Ad revenue, impressions and fill **per version** | backend read over `ad_impression_value` / `ad_*` by `app_version_code` (data exists, no read) | backend |
| G-02 | ANR / crash rate **per version** in the panel | daily read of the Play Developer Reporting API (the `play-uploader` service account already reads it) into a small table | backend, **schema: owner** |
| G-03 | AdMob's own revenue per version (the money truth beside our `value_micros`) | AdMob mediation report by `APP_VERSION_NAME` (as `ops-scripts/admob-report.py` reads it), daily into a small table | backend, **credential + schema: owner** |
| G-04 | Play rating average / count per version, uninstalls per version (the 72-hour uninstall guardrail) | Play bulk reports (`stats/ratings/*_app_version.csv`, `stats/installs/*_app_version.csv`): needs "view app information and bulk reports" for the service account and the Console developer id | **owner** grants; then backend |
| G-05 | Real vs throwaway data in an invoice (the G1 question itself) | parameters on `invoice_created_success`: e.g. `items_count`, `has_logo`, `optional_fields_filled` (removed in 1.4.3); 1.5.4 adds `amounts_changed` for copies | user-journey |
| G-06 | PAID stamp present on a paid invoice's PDF (152-01) | parameter `paid_stamp=true|false` on `pdf_download_result`, `pdf_share_result`, `pdf_print_result` when the invoice is paid | user-journey |
| G-07 | Payment duplicates, payments on deleted invoices, estimate currency mismatch (150-15, 150-16, 151-13) | server-side counts on `invoice_payment` / `estimates` by the creating build (no event needed) | backend |
| G-08 | Rollout % history per release | daily read of Play `edits.tracks` (read-only, edit abandoned, as done 2026-09-23) into the release catalog; until then typed by hand | backend |
| G-09 | Calendar events that confound before / after (Meta campaign changes, Remote Config changes, deploys) | an annotation list in the catalog: Remote Config template versions (readable, 0222's read), deploys (CI), campaigns (manual or Meta Marketing API, read-only token pending) | backend + owner (Meta token) |
| G-10 | Meta cost per G1 (151-02) | Meta Marketing API read, or the owner's weekly number typed in | owner |
| G-11 | Sign-up sends vs verified (153-13) | server count of OTP e-mails sent vs verified per day and build (server tables) | backend |
| G-12 | Help message actually sent; store card actually drawn; a rating actually given | **unknowable by design** (WhatsApp, Play, App Store say nothing): written as limits | - |
| G-13 | Silence per feature event per version | one Health Centre check (C.6) | backend |
| G-14 | Banner impressions on `invoice_screen` by tour arm (150-10's declared cost) | backend read only (`placement` + `overlay_variant` exist) | backend |
| G-15 | Reminder delivered vs scheduled (154-03) | `unpaid_reminder.delivery` (designed) must distinguish "scheduled, never delivered" (permission revoked, OEM battery kill): add `delivery=none` with `reason` | user-journey |
| G-16 | Version pickers hide 113-117 | `lib/publishedVersions.ts` replaced by the release catalog endpoint | panel |
| G-17 | iOS parity: lifecycle exists from the build after 17; iOS `ad_load_failed` lacks the adapter list; `network_changed` off | known, written as a limit on every iOS row | user-journey |

### C.4 Codlytics reuse check (`~/Documents/App Optimisation Model`, HEAD `a6b3934`)

- **What it is:** Python ETL into its own Postgres. `version_daily` (GA4 by date x appVersion, Play crash / ANR by
  versionCode, Play review CSVs), `version_strata` (GA4 by version x country x first session; AdMob mediation by
  APP_VERSION_NAME x country x format; Play vitals by country), `bq_experiments` (BigQuery Firebase export, experiment
  arms). Statistics in `panel/lib/mix.ts` and `panel/lib/like.ts` (direct standardisation, shift-share, cluster
  variance, Holm, verdicts); the `/releases` page with its like-for-like card (`docs/LIKE_FOR_LIKE.md`).
- **Verdict: do not reuse the jobs; reuse the ideas and the pure statistics.**
  - The jobs never read MySQL; Invotick's truth is `analytics_events` in MySQL. Whether Invotick has a GA4 property or
    a BigQuery export was not verified, and our own pipeline is the agreed source of truth.
  - Codlytics' `CLAUDE.md` rule 6 isolates it from Invotick (own database, nothing shared). Adding Invotick as an app
    row there would break that rule: the owner's decision, not recommended.
  - **Take:** port `like.ts` / `mix.ts` logic (country-tier standardisation, Holm, verdict wording) into the backend's
    Kotlin metric library with the same test vectors; copy the `/releases` page layout ideas; copy the **two read
    paths** Invotick's MySQL cannot give (Play vitals per version, AdMob per version) as Invotick-owned jobs (G-02,
    G-03).

### C.5 Production cost (section 5a)

Every new read answers "how many rows does this touch?" in its commit message. Estimates, from the measured volumes:

| Read | Rows touched (30 days, one platform) | Shape |
|:--|:--|:--|
| Timeline: active devices per version per day | `device_journey_hour` rows of 30 days (one per device x hour x build: on the order of 10^5) | grouped in SQL |
| B.1 activation per arm | as `journey-compare` today (`device_journey`, ~7,000 devices), already measured 2.5 s -> 0.08 s | reuse |
| B.2 pipeline counts per build | version-index range scans; `params` fetched for about 70,000 `ad_impression_value` + about 5x that for the request / load / shown rows of one build: about 400,000 row fetches for 30 days, two builds | the heaviest read: cached 20 min, `MAX_EXECUTION_TIME(15000)`, one at a time |
| B.3 / B.4 / B.5 counts | thousands per build per 30 days | cheap |
| B.6 per-device outcomes | per sharer device through the covering index (hundreds of devices a week) | cheap |

If B.2 measures above 10 s on production (timed by the read's own log line after deploy), Plan B is a rollup
`release_device_day` (device x day x build: impressions and micros per format, error phones, cold starts, `prev_exit`
counts, paywall views, Continue, purchases), filled like `device_journey`: a schema change, so **the owner's word first**.

### C.6 The silence check

One Health Centre check, `feature-events-arriving` (a `HealthCheck` `@Component`, detail behind a card, never a page):
for each feature in the release catalog and each release build at or above the feature's first build with at least
200 active devices in the last 24 h, the count of the feature's events in those 24 h.
- 0 rows while the build has reach = **amber "no data yet"** for the first 48 h after the build first appears, **red**
  after that; never green. Rows below the expected order (declared per feature, e.g. `paywall_exit_reason` should be
  at least 1 per 50 paywall exits) = amber.
- Reads `idx_analytics_events_version_name_ts` with a 24 h range; one row per feature event: cheap enough for the
  alerter's 15-minute cadence.
- Catches the trap class "a stale name reads as a step nobody reached".

---

## Part D. The build plan

### D.1 Order

1. **Release catalog + timeline (backend + panel).** `ReleaseCatalog` in code, like `ExperimentCatalog`: releases
   (platform, versionCode, name, production date, rollout history typed by hand until G-08), features (registry ID,
   release, playbook, primary KPI id, guardrail KPI ids, declared or reconstructed expectation code, switch key, read
   dates, minimum effect, first build). `GET /v1/webpanel/release-impact/releases` (ADMIN, read-only, `from`/`to` full
   instants, at most 92 days). Panel: sidebar entry, timeline band, release cards with honest empty states. Replace
   `publishedVersions.ts` (G-16).
2. **The metric library (backend).** One pure Kotlin module: proportion (Wilson, Newcombe, pooled z, reused from
   0222's code), mean per device-day (device-clustered bootstrap with a fixed seed, p99.5 cap), median / p75
   (bootstrap), non-inferiority guardrail rule, Holm for segments, minimum-n gate, planned-n and "days left". Tested
   against textbook vectors and against Codlytics' `like.ts` vectors.
3. **Section B.1, 1.5.3 vs 1.5.2 (the pattern).** `GET /v1/webpanel/release-impact/section?feature=&platform=&from=&to=`
   returning codes and numbers per arm, KPI, interval, n, status, verdict code, switch key. Cohort step = design 2
   (staged new installs) with the balance check. Its sub-sections first in this order: B.5 reliability (vitals need
   G-02; until then Play numbers typed in), B.4 paywall exit question, B.3 rating. Same safety as 0222 (one worker,
   15 s cap, 20-min cache, 503 `computing`, never a partial number).
4. **Silence check** `feature-events-arriving` (C.6), from the same catalog.
5. **Section B.6, 1.5.4 second invoice, in the nudges' own branches** (definition of done): events per the user-journey
   owner, `nudges` added to `ExperimentCatalog`, section, synthetic data, data-travel test, silence entries. The
   release gate of 1.5.4 includes them.
6. **Section B.2, 1.5.0 ads** (needs G-01; G-03 when the owner gives the AdMob credential).
7. **Section B.7** and the remaining 1.5.0 / 1.5.1 rows; the A/B Tests page stays where it is and B-sections link to
   its cards for randomised rows (one source of truth for arms).

### D.2 Effort, in agent-sized steps (one step = one agent session with its own tests)

| Step | Repo | Size | Depends on |
|:--|:--|:--|:--|
| S1 catalog + `releases` endpoint + tests | invotick-apis | 1 | - |
| S2 metric library + vectors | invotick-apis | 1 | - |
| S3 panel: sidebar, timeline, release card, empty states, version list from the catalog | invotick-admin-panel | 1 | S1 |
| S4 `section` endpoint, cohort design 2 + balance, B.1 guardrail strip | invotick-apis | 2 | S1, S2 |
| S5 synthetic generator + data-travel tests for S4 (D.3) | invotick-apis + harness | 1 | S4 |
| S6 panel section component (header, badge, KPI table, SVG charts: paired bars with whiskers, daily line with release marker, funnel bars, distribution) | invotick-admin-panel | 2 | S3, S4 |
| S7 sub-sections B.5, B.4, B.3 on S4's engine + their synthetic cases | both | 2 | S5, S6 |
| S8 silence check `feature-events-arriving` | invotick-apis | 1 | S1 |
| S9 Play vitals daily read (G-02) | invotick-apis | 1 | owner: schema |
| S10 B.6 nudges measurement (with the feature) | all three | 2 | 1.5.4 decision |
| S11 B.2 ads section (G-01) | both | 2 | S4 |
| S12 AdMob per version (G-03) | invotick-apis | 1 | owner: credential + schema |
| S13 B.7 | both | 1 | S4 |

About 18 steps; S1-S8 (the pattern, live with 1.5.3) is about 11. Gradle runs one at a time on this Mac (memory
`never-parallel-gradle`); the backend gate is `./gradlew test` with the test MySQL up.

### D.3 Synthetic data and the data-travel test (decision 0141 harness)

**Generator:** a test fixture that writes app-shaped batches (the exact JSON the app's `AnalyticsFlusher` posts) and
sends them to `POST /v2/analytics/track` on the branch jar (port 18085) against a throwaway database cloned from
`invotick_sync_push_test`; then reads the panel endpoint; then the page in real Chrome (panel on port 3000 only, CORS).
The expected numbers are **computed by hand / by a second implementation in the test's own file** (Python here, below),
never by calling the code under test. Every dataset also contains, and the test asserts their exclusion: 5 of our own
devices (prefix list) with outcomes; a debug build; an iOS device in an Android read; a batch from versionCode 90
(refused at ingestion, 0 rows); the same event id sent twice (stored once); a late batch (event time inside the window,
arrival 3 days later: counted, because windows are on `event_timestamp`); out-of-order batches; a device whose window
has not passed (pending, not "did not"); a device that first opened on 116 and later updated to 117 (stays in 116).

| Case | Data | Expected at the endpoint and on the page (computed independently) |
|:--|:--|:--|
| T1 activation, no clear difference | 117: 250 new devices, 30 with G1 in 24 h; 116: 1,000, 100 with G1 | 12.0 % vs 10.0 %; diff +2.0 pp, Newcombe 95 % [-2.01, +6.92] pp; z 0.93; Wilson 117 [8.54, 16.61] %, 116 [8.29, 12.02] %; badge **No clear difference** (not green) |
| T2 activation, better | as T1 but 45 of 250 on 117 | 18.0 % vs 10.0 %; +8.0 pp [+3.28, +13.51]; z 3.53; badge **Better** |
| T3 guardrail on the edge | as T1 but 15 of 250 on 117 (G1 as a guardrail) | 6.0 % vs 10.0 %; -4.0 pp [-7.08, +0.04]; z -1.957; interval crosses 0 and the -1.5 pp tolerance: **amber, not red** (the boundary test) |
| T4 small n | 60 vs 60 devices, 8 vs 6 outcomes | 13.3 % vs 10.0 %; [-8.68, +15.41] pp; below 200 per arm: grey **Not enough data**, numbers shown with n |
| T5 money breach | device-days: 116 = 1,000 (900 at $0.0040, 100 at $0.0130), 117 = 250 (225 at $0.0030, 25 at $0.0100) | means $0.0049 vs $0.0037 per device-day, -24.5 %; Welch 95 % [-$0.00151, -$0.00089], entirely below -3 % (-$0.000147): **red, Worse**, line names the feature's switch. (The production statistic is the bootstrap; for this two-valued set the test asserts the bootstrap interval lies within ±10 % of the Welch bounds, fixed seed) |
| T6 exit question small-number rule | 60 strips from real devices: answered 24 (too_expensive 10, not_now 6, unclear_value 4, other 4), skipped 12, timed_out 18, interrupted 6; plus 3 from our phone, 2 duplicates, 1 debug | response 24 / 60 = **40.0 %**; reasons as **counts only** (24 < 30 answers); `other` 4 / 24 = 16.7 % (below the 25 % flag); our phone counted apart (3), duplicates stored once |
| T7 platform split | Android `rate_sheet_result`: card_completed 40, fast_end_listing 12, listing_opened 3; iOS: listing_opened 9 | Android card_completed 40 / 55 = 72.7 %; iOS shown on its own row; the page never shows a combined `listing_opened` of 12 |
| T8 pending window | 20 devices whose first open is 10 h before `to` | 24 h read: 20 pending, not in either denominator |
| T9 silence | 117 with 300 active devices for 49 h and 0 `paywall_exit_reason` rows | check **red**; with 47 h: amber "no data yet"; never green |
| T10 balance fallback | first opens on 117 = 2 % of first opens while the catalog says 20 % | section shows the balance warning and switches its label to design 3 ("associated") |

**The test must be able to fail:** each case is run once with one road step broken on purpose (the platform filter
removed, the test-device exclusion removed, the window computed on arrival time) and must go red; the commit carries
both runs (`a-check-that-cannot-fail`). Test and log output stays ASCII (Gradle report trap).

### D.4 Risks

- **Schema changes need the owner's word** (Flyway has no rollback): Play vitals table (G-02), AdMob table (G-03), the
  Plan B rollup. Phase 1 (S1-S8) needs **no schema change**.
- **Production reads must stay cheap.** The ads read is the heaviest; it is timed after deploy and moved to Plan B if
  above 10 s. No polling; one computation at a time; 15 s statement cap; any slow read is a 503, never a partial number.
- **A staged rollout may not split new installs the way we expect.** The balance check (T10) is the guard; the
  fallback is labelled.
- **Small numbers.** Premium (8 buyers ever) and iOS (5 real new iPhones) cannot carry a colour for months; the page
  must say "Not enough data, about N weeks" rather than draw one.
- **The denylist does not apply in release** (`analytics-allowlist-empty`): every auto-captured tap count is "sent
  unless switched off, and switching off may not work". Verdicts use coded events wherever one exists.
- **Stale names.** A KPI built on a name the app stopped sending reads as zero: every KPI's event names are checked
  against `event-summary` for the latest build before the section ships (the silence check keeps watching).
- **Two lists of our own devices** (`testing_devices` and `OurOwnAccounts`): use both, count what was excluded.
- **No backend sentence about ads.** Wording lives in the panel; an ad trade is always a question with both numbers.

---

## Part E. Open questions for the owner (each with my recommendation)

1. **Kya hum pehla daur bina naye database table ke banayein, aur sirf Play ke crash/ANR numbers ke liye ek chhota naya
   table baad mein aap ki ijazat se?**
   Recommendation: yes. Phase 1 (catalog, timeline, 1.5.3 vs 1.5.2, silence check) needs no table. The Play vitals table
   (G-02) is small (one row per version per day) and is the only way the panel can show crash/ANR per version.
2. **Google Play ke "ratings" aur "uninstalls" version-wise parhne ke liye service account ko ek aur ijazat ("view app
   information and bulk reports") aur Console ka developer id dena: kya aap denge?**
   Recommendation: yes. Without it the panel cannot show rating or uninstall per release, two of the trust guardrails;
   the alternative is you typing the Console numbers in once a week.
3. **AdMob ki apni kamai (version-wise) panel mein lani hai to backend ko AdMob ki read-only ijazat chahiye. Dein, ya
   abhi hamare apne `ad_impression_value` par hi chalein?**
   Recommendation: start on our own `ad_impression_value` (already per version), add AdMob later for the monthly
   check; it is the money truth but not needed for a better/worse read.
4. **1.5.4 ki doosri-invoice wali nudges: ek saath teeno (A+B+C) ek holdout ke saath, ya pehle sirf A (next-step card)?
   Aur kis par parhein: sirf pehla share karne walon par (~125 / hafta, +4 points ke liye ~19 hafte) ya har pehli
   invoice banane wale par (~475 / hafta, ~9 hafte)?**
   Recommendation: all three behind **one** holdout (20 % off, code default 20, not 0), read on all first-invoice
   creators with the sharer number beside it; it answers in about 9 weeks instead of 19, and per-nudge mechanism steps
   still show which part works.
