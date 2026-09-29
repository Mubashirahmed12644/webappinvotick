# 0176 — The store's rating sheet is requested after the Nth confirmed share, and nothing is asked first

- **Date:** 2026-09-27
- **Status:** built, not released. App `invoice-kmp-app`: `feat/store-review-after-share` @ `d90a7908` is merged into
  `VC_113_VN_149` (`a4846d44`); the owner's schedule (below, 2026-09-27) is `feat/store-review-schedule` @ `6b680e1f`
  off `a4846d44`, **pushed, not merged**. No schema change, no server change. One new dependency on Android
  (`com.google.android.play:review` + `review-ktx` 2.0.2). Three new Remote Config keys, all optional.
- **Asked by:** the owner, 2026-09-27. He was told what Play and Apple allow, and chose the compliant shape.

## The rule the owner chose

The store's own rating sheet — Google Play's in-app review card, StoreKit's rating alert — is **requested** at a
natural happy moment, with **no question of ours before it**.

- Google Play's in-app review guidelines forbid asking anything before or while the card is shown: no "Do you like
  the app?", no "Would you rate us 5 stars?".
- Sending only happy users to the store is review gating, against Play's ratings policy. Apple's rule is the same.
- So the app's own star-rating feedback dialog (`core/ui/.../FeedbackDialog.kt`: stars + text → WhatsApp) **stays
  exactly as it is and is never connected to the store sheet**. The store sheet is not shown from it, after it, or
  based on its stars. Nothing in the new code reads that dialog.

## Decided

**1. The moment is the Nth confirmed invoice share.** `invoice_shared_success` is G1's proof (0006): the user picked
an app in the share sheet and the invoice went to it. Beside that event, `SaveInvoiceViewModel` now also calls
`ConfirmedInvoiceShares.confirmed()`. The app counts these per install; at N since the last request (default 2) it
waits for a settled screen and asks the store once.

**2. "Settled" means back in the app, and nothing else on screen.**
- The app has been in front for 2 s without leaving. On Android, picking WhatsApp takes the user out of the app, so
  this is the return from WhatsApp. On iOS the share extensions run inside the app, so it is the sheet having gone.
- No full-screen ad on screen. If one is up, the request waits for it to close, pauses 1.5 s, then settles again.
- Nothing of ours drawn over the screens (`ScreenCover`: the ad-or-premium dialog, the paywall, the ad's loading
  dialog, any sheet or dialog), and no native question holding the screen (`SystemPrompt`: the consent form, Apple's
  tracking alert).
- A moment refused by any of these spends nothing. The count stays at N and the next confirmed share tries again. A
  return that has not come within 10 minutes of the share is let go the same way.

**3. Never:** on the install's first launch; before the owner's schedule allows the next request (see **The owner's
schedule** below); after the schedule's last request; when Remote Config says off. The store then applies its own quota
and may show nothing — we only request.

## The owner's schedule (2026-09-27, replaces the single 90-day cooldown)

**His words:** *"3 dafa 7 din baad and 3 dafa 14 din ky bad and 3 dafa 1 month ky baad."*

He was told plainly first:
- neither Google nor Apple tells the app whether the user rated, so we cannot stop "after they rate";
- Google may not show the card more than about once a month;
- Apple shows it at most 3 times a year.

He chose a bounded schedule with that knowledge.

| Request | Needs |
|---|---|
| 1st | the 2nd confirmed share, as before |
| 2nd, 3rd | 7 days since the request before it, then a confirmed share |
| 4th, 5th, 6th | 14 days since the request before it, then a confirmed share |
| 7th, 8th, 9th | 30 days since the request before it, then a confirmed share |
| after the 9th | never again on that install |

- Each gap is measured from the previous **request**, and each request still needs its own happy moment: a confirmed
  share after the gap, with every guard above (no ad, no dialog, no native question, not the first session).
- Remote Config **`store_review_schedule_days`**, a string, default `7,7,7,14,14,14,30,30,30`: one value per request,
  in order. The first request has no request before it, so its value is no wait. Changing the string changes the
  schedule without a release; its length is the number of requests.
- Read **all or nothing**. One unreadable entry, a gap below 1 day or above 3,650, an empty list or more than 50
  entries, and the whole value is the owner's default — never a partial list, never "ask at every share".
- **`store_review_cooldown_days` is retired.** It is removed from the app, so a console key of that name does nothing.
  No released build ever read it.
- Requests made are counted on the install (`store_review_requests_made`) and sent as **`request_number`** (1–9) on
  `store_review_requested`, so the owner can see how far down the schedule people get. `share_threshold` is now 2 for
  the 1st request and 1 after it.

**4. While the sheet is up it holds the prompt screen.** It claims `SystemPrompt` as `store_review`, so no coaching
tooltip draws over it and the consent form and Apple's tracking alert cannot stack on it.
`ACoachTooltipNeverDrawsOverACoverTest` now also finds `launchReviewFlow` and `presentRatingRequest` and fails the
build if either is called from a file that does not claim.

**5. Remote Config, all read as text.** A boolean read of a key the console does not hold is `false`, and a number
read is `0`. Both are values, not absences (`RemoteSwitch.kt`).
- `store_review_enabled`: on unless it says `false`. Off, nothing is ever requested.
- `store_review_after_shares`: N, default 2, at least 1.
- `store_review_schedule_days`: the owner's schedule, below. (`store_review_cooldown_days` is retired.)

**6. Android: Play's In-App Review API, 2.0.2.** `requestReviewFlow()` then `launchReviewFlow(activity, info)`.
- 2.0.2 is the current release on Google Maven (2024-10-18). It shares `play:core-common` with `app-update` 2.1.0,
  which the app already uses.
- The card is only shown to an app Play installed. A debug build from the computer ends the flow at once and shows
  nothing. That is Play's behaviour.

**7. iOS: StoreKit's `AppStore.requestReview(in:)`,** through a Swift bridge registered in `iOSApp.swift`, the same
shape as `StoreKitBridge` and `UmpBridge`.
- The bridge method returns a plain `Bool` and takes no function-typed parameter: a Kotlin function type exported to
  Objective-C boxes its arguments (the trap written up in `RemoteConfigRepositoryImpl.ios.kt`).
- `SKStoreReviewController.requestReview(in:)` is deprecated from iOS 18, this target's minimum.
- **It never displays in TestFlight.** A TestFlight build cannot show that this works; an Xcode development build
  always displays it.

## What it costs the ads — measured from the code, not assumed

Nothing is delayed, skipped or shortened.

| Ad | Where it sits relative to the request |
|---|---|
| Share interstitial (behind the ad-or-premium dialog) | Always **before**. `onSendInterstitial`'s `onComplete` fires the share only after the ad has closed, and the request needs a confirmed share. |
| Resume app-open ad (the return from WhatsApp) | Decided at `ON_RESUME` and shown one main-loop tick later. The request needs 2 s in front, so the ad is already up. The request then waits for it to close. |
| Any full-screen ad on screen | The request waits for `AdVisibilityController.fullScreenAdShowing` to go false. It only reads that flag and never sets it, so banners never collapse for it. |
| An ad appearing while Play prepares | The screen is checked again after Play answers. If an ad is up, nothing is requested. |
| The app-open ad that closing Play's card would trigger | Suppressed as `InAppExcursion.Reason.STORE_REVIEW`. AdMob's own rule forbids an app-open ad when the user did not open the app, and closing a card we raised is not opening it. When Play shows no card, no resume comes to consume the flag, so it is **withdrawn 1.5 s after the flow ends** (`InAppExcursion.withdraw`, new, and it only lowers its own reason). Otherwise it would cost the user's next real return its ad. |

iOS needs no excursion: an iPhone's resume app-open ad requires a return from the background
(`ReturnFromBackground`), and an alert never sends the app there.

## Events

One coded event, **`store_review_requested`**, one per request, with the outcome as a parameter (AGENTS-EVENTS §1.1).
It is coded because nothing is pressed when the store answers, so no auto-captured tap can carry it. It is the
same shape as the paywall's `premium_purchase_result` (decision 0155, on the app-events docs branch, not yet on
`main`).
- It is sent when the request's end is known: on Android when Play's flow ends or fails, on iOS once the alert has
  gone.
- `trigger` (`invoice_share`), `share_count`, `share_threshold`, `request_number` (1–9).
- `outcome` is `flow_ended`, `request_failed` or `launch_failed`, and **absent on iOS**, because iOS answers nothing
  (§1.7).
- `flow_ms` on `flow_ended` only.
- `error_code` + `error` on `request_failed`: Play's `ReviewErrorCode` and its word, in its own code space (§1.15).
- `reason` on `launch_failed`: our own check, `no_screen` or `prompt_taken`.
- `exception_class` where something threw.

**What we can measure:** how many requests, on which share, and on Android how the flow ended and how long it ran.

**What nobody can measure:** whether a card was shown, and whether the user rated or with how many stars. Neither
Play nor Apple tells the app. The only place a rating appears is the Play Console and App Store Connect. A short
`flow_ms` fits a quota refusal, but that is a reading of the number, not something Play says.

## Rejected

- **Asking "Do you like Invotick?" first,** or routing only the 4–5-star answers of our own feedback dialog to the
  store. Both are forbidden: a question before the card, and review gating.
- **Showing it from, or after, `FeedbackDialog`.** Same reason.
- **A second event for the flow's end** (`store_review_flow_ended`). One request, one event, the end is a parameter
  (§1.1).
- **Recording `rated` / `shown`.** Nothing observes either (§1.14).
- **Triggering on save** (`invoice_created_success`). A saved invoice may still be throwaway data. A confirmed share
  is the G1 moment (0006).
- **Waiting on screen for a covering sheet to close.** The user is doing something; the next share is a cleaner
  moment than a sheet's closing frame.
- **Per-account memory.** The store's quota is per store account on the phone, and a rating is for the app, so the
  counters are per install, in the phone's one preferences file.

## Tests

- 13 behaviour tests on the real coordinator, on virtual time: `TheStoreIsAskedForItsRatingSheetAfterTheNthShareTest`.
- 6 order tests: `StoreReviewPolicyTest`.
- 3 Remote Config count tests: `ARemoteCountKeepsItsDefaultUnlessItSaysANumberTest`.
- The native-question guard, widened.
- **Red first:** with the rules removed, 16 of the 19 fail.
- **The schedule** (`6b680e1f`): 17 behaviour tests, 8 order tests, 4 schedule-parsing tests
  (`AMalformedReviewScheduleKeepsTheOwnersScheduleTest`). With the schedule rules removed, all 8 schedule tests fail;
  with partial parsing instead of all-or-nothing, 2 of the 4 parsing tests fail. Full suite **1490 passed, 1 skipped**
  (head `a4846d44` was 1480 + 1). iOS `compileKotlinIosSimulatorArm64` passes; no Swift changed.
- Full suite `tools/report/report.sh --unit-only`: **1466 passed, 1 skipped** (baseline 1444 + 1; +22 = 13 + 6 + 3).
- Android debug compiles; iOS `compileKotlinIosSimulatorArm64` and the Xcode Debug build for the Simulator
  (`** BUILD SUCCEEDED **`) pass. Not run on a device: Play shows no card to a build it did not install, and
  StoreKit shows nothing in TestFlight.

## Open for the owner

1. N = 2 and the schedule `7,7,7,14,14,14,30,30,30` are the defaults. Both can change from Remote Config without a
   release.
2. Estimate shares do not count today. Should they?
3. A refused moment (an ad or a sheet on screen) is not recorded. Should it be, as a parameter on this event?

## Addendum 2026-09-30 — reach mostly happy moments, from behaviour only

- **Status:** built, not released. App `invoice-kmp-app`: `feat/review-happy-moment` off `origin/VC_113_VN_149`
  (**pushed, not merged**). No schema change, no server change. Three new optional Remote Config keys. One new coded
  event.
- **Asked by:** the owner, 2026-09-30: make the store's rating request reach mostly users who are having a good
  experience, using **only behavioural signals**, fully inside Google Play's and Apple's rules.

### The line that does not move

**Choosing WHEN to request, from what the user did, is allowed. Choosing WHO to ask, by how they feel, is not.**

- Google Play's in-app review guidelines: nothing of ours before or during the card ("Do you like the app?", "Rate us
  5 stars?"). Google itself advises requesting once the user has experienced the app, at a natural moment.
- Google Play's ratings policy, and Apple's rules: steering only satisfied users to the store, and holding the
  unsatisfied back, is review gating.
- So none of the signals below is a question, a star picker, or a read of anything the user said. Nothing in the
  review path reads `FeedbackDialog` (stars → WhatsApp), and that dialog never leads to the store. Source guard:
  `TheStoreReviewPathAsksNothingTest` (three halves: the review path draws and asks nothing and never names the
  feedback dialog or its stars; the calls that raise the store's sheet exist only in the review path; the feedback
  dialog and every file that shows it never name the store's sheet, a listing or a write-a-review link).

### Rejected, on the record

- **A sentiment gate in any form:** "Do you like Invotick?" first; routing only 4–5 star answers of our feedback dialog
  to the store; showing the card after the dialog, or only when its stars were high; a star picker of our own that
  routes to the store; reading the WhatsApp feedback for tone. Each one is review gating, and each puts the app's
  listing at risk for a few better ratings. Not re-proposable without a change in the stores' rules.
- **Inferring mood from free text or from a "how was it" question of ours.** Same reason.
- **Delaying an ad or the paywall to make the moment cleaner.** Monetisation is a requirement, not a variable. The
  request waits for ads and the paywall, never the other way round; nothing of theirs moves.

### The four new refusals (each its own reason code, all pure in `StoreReviewPolicy`)

| Reason | Refuses when | Default | Remote Config key |
|---|---|---|---|
| `too_few_days` | fewer distinct days of use on this install, in the phone's own time zone, than the minimum | 2 | `store_review_min_days_of_use` (at least 1; 1 = off in effect; clamped to 30) |
| `last_exit_crash` | the previous process ended in a crash, native crash or ANR: the word `app_cold_start.prev_exit` carries, read by the same call | on | none (a fixed rule) |
| `recent_error` | an error a person saw (`ErrorReport`, the path that sends `error_shown`) was shown within the quiet time | 24 h | `store_review_error_quiet_hours` (0 = off) |
| `just_after_ad_or_paywall` | a full-screen ad, or the paywall, closed within the window | 30 s | `store_review_after_ad_seconds` (0 = off) |

The moment stays the same: right after a confirmed share (`invoice_shared_success`), once the user is back and settled
(item 5 of the brief, unchanged). All keys are read as text, so an absent key keeps its default.

**Order.** `switched_off`, `first_session`, `schedule_done`, `too_few_shares`, `gap_not_passed`, then **`too_few_days`,
`last_exit_crash`, `recent_error`**, then the screen checks `not_in_front`, `ad_on_screen`, `prompt_on_screen`,
`screen_covered`, and last **`just_after_ad_or_paywall`**. The new history checks are judged at the share and spend
nothing: the count is kept and the next share tries again. `just_after_ad_or_paywall` is judged **at the moment**, not at
the share, on purpose: an ad-gated share closes its interstitial just before the share sheet opens, so judging at the
share would refuse nearly every ad-gated share for a reason that is gone by the time the user is back from WhatsApp.

**Where each signal comes from.**
- Days of use: a set of calendar days kept in the phone's preferences, added to at the first moment in front of each
  process and at each confirmed share; the latest 30 kept, so it is bounded. A new install starts empty; no released
  build ever counted them.
- Error: `ErrorReport` (`core/common`) gains a second listener beside analytics' sink and a process-level
  `lastReportedAtMs`; the time is kept across launches, and the process's own record is read too, so an error before the
  listener registered (the splash) still counts. An error is counted only where `error_shown` is: not a cancellation,
  not one nobody saw, not the same exception twice.
- Crash: a public read of the same `PreviousProcessExit` `app_cold_start` uses. Below Android 11 there is no record, and
  on iOS there is none; unknown never refuses, because there is nothing to hold against the user.
- Ad and paywall: `AdVisibilityController` records the **edge** from showing to not showing (a failed show is not a
  close); the paywall records its own leaving the screen. Both into `RecentClosings` (`core/common`), wall-clock ms, in
  memory.

### The refusals are now an event

Decision 0176's open question 3 asked whether a refused moment should be recorded. It is now, because the brief needs
"how many requests, by refusal reason".

- **`store_review_not_requested`**, coded, one per confirmed share that ended without a request. Not
  `store_review_requested`, which stays one per request. Nothing is pressed when a refusal happens, so an auto-captured
  tap cannot carry it (AGENTS-EVENTS §1.5, 0064).
- Parameters: `reason` (the policy's own words above and the older ones, plus `no_settled_moment` when the user did not
  come back within 10 minutes), `trigger` (`invoice_share`), `share_count`, `share_threshold`, `request_number` (the
  number this request would have had), `days_of_use`. Only on the reason they explain (§1.7): `closed` (`ad` or
  `paywall`) and `since_ms` on `just_after_ad_or_paywall`; `since_ms` on `recent_error`.
- **Not sent** for `switched_off` and `schedule_done`: nothing is being decided then, and a switched-off feature must
  add nothing to the app.
- A name says what was seen, never why (§1.14): `not_requested`, with the reason a fact about the app's own state.
- Volume: at most one per confirmed share, so never above `invoice_shared_success`.

### What this costs, and what to expect

- **Fewer requests, by design.** On Android, a return from WhatsApp that earns a resume app-open ad closes that ad
  seconds before the moment, so that request is refused as `just_after_ad_or_paywall` and the next share tries again.
  How often is the first thing the event will show. If the owner finds it too costly, `store_review_after_ad_seconds`
  can be lowered or set to 0 from Remote Config with no release.
- The store's own quota still applies on top: Google shows the card roughly once a month at most, Apple at most 3 times a
  year, and neither says whether a card was shown or a rating given.
- **What this cannot claim:** the signals choose a moment, not a mood. Nothing here measures whether the user is happy.
  Whether the ratings improve is read from the stores, below, not from our events.

### How to measure after release

Requests, and refusals by reason (bounded both sides, by the release's first day; arrival time is `created_at`):

```sql
SELECT event_name,
       COALESCE(params->>'$.reason', params->>'$.outcome') AS reason_or_outcome,
       COUNT(*) AS n, COUNT(DISTINCT session_id) AS sessions
FROM analytics_events
WHERE event_name IN ('store_review_requested', 'store_review_not_requested')
  AND app_version_code >= :first_version_code
  AND created_at >= :from AND created_at < :to
GROUP BY event_name, reason_or_outcome
ORDER BY event_name, n DESC;
```

Request rate against the moments that could have asked (every confirmed share is one of the two events, plus the shares
that were still waiting):

```sql
SELECT DATE(created_at) AS day,
       SUM(event_name = 'store_review_requested') AS requested,
       SUM(event_name = 'store_review_not_requested') AS refused,
       SUM(event_name = 'store_review_not_requested' AND params->>'$.reason' = 'just_after_ad_or_paywall') AS just_after_ad_or_paywall,
       SUM(event_name = 'store_review_not_requested' AND params->>'$.reason' IN ('too_few_days','last_exit_crash','recent_error')) AS behaviour_refusals
FROM analytics_events
WHERE event_name IN ('store_review_requested', 'store_review_not_requested')
  AND app_version_code >= :first_version_code AND created_at >= :from AND created_at < :to
GROUP BY day ORDER BY day;
```

Play rating trend by version: the Reply to Reviews API (`androidpublisher v3`, `reviews.list`) returns each review's
`starRating`, `appVersionCode` and `appVersionName`, but only reviews created or changed in the **last seven days**, so a
trend needs a snapshot taken every week, keeping only the star rating and the version, never the text. The service
account of `play-upload.py` needs the "reply to reviews" permission for it. The other route is Play Console → Download
reports → Reviews, a monthly CSV in the Play bucket. Average by version from either, then compare the version with these
signals against 1.4.9 (113). The store's own quota and the small number of reviews mean a trend needs weeks and a few
hundred ratings before it says anything; a single week is noise.
