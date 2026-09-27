# 0176 — The store's rating sheet is requested after the Nth confirmed share, and nothing is asked first

- **Date:** 2026-09-27
- **Status:** built, not merged, not released. App `invoice-kmp-app`, branch `feat/store-review-after-share` @ `d90a7908` off
  `VC_113_VN_149` @ `796216ec`. No schema change, no server change. One new dependency on Android
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

**3. Never:** on the install's first launch; within the cooldown (default 90 days) of the last request; when Remote
Config says off. The store then applies its own quota and may show nothing — we only request.

**4. While the sheet is up it holds the prompt screen.** It claims `SystemPrompt` as `store_review`, so no coaching
tooltip draws over it and the consent form and Apple's tracking alert cannot stack on it.
`ACoachTooltipNeverDrawsOverACoverTest` now also finds `launchReviewFlow` and `presentRatingRequest` and fails the
build if either is called from a file that does not claim.

**5. Remote Config, all read as text.** A boolean read of a key the console does not hold is `false`, and a number
read is `0`. Both are values, not absences (`RemoteSwitch.kt`).
- `store_review_enabled`: on unless it says `false`. Off, nothing is ever requested.
- `store_review_after_shares`: N, default 2, at least 1.
- `store_review_cooldown_days`: default 90, at least 0.

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
- `trigger` (`invoice_share`), `share_count`, `share_threshold`.
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
- Full suite `tools/report/report.sh --unit-only`: **1466 passed, 1 skipped** (baseline 1444 + 1; +22 = 13 + 6 + 3).
- Android debug compiles; iOS `compileKotlinIosSimulatorArm64` and the Xcode Debug build for the Simulator
  (`** BUILD SUCCEEDED **`) pass. Not run on a device: Play shows no card to a build it did not install, and
  StoreKit shows nothing in TestFlight.

## Open for the owner

1. N = 2 and 90 days are the defaults. Both can change from Remote Config without a release.
2. Estimate shares do not count today. Should they?
3. A refused moment (an ad or a sheet on screen) is not recorded. Should it be, as a parameter on this event?
