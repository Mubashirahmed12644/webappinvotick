# 0189 — Rate Us: one feedback dialog, five stars opens our Play Store page (Android only)

- **Date:** 2026-09-30
- **Status:** built, not merged. App `invoice-kmp-app`: `feat/rate-us-drawer` @ `53bc9285`, off
  `feat/review-happy-moment` @ `33771bb4` (0176's addendum). **Pushed, not merged.** No schema change, no server change,
  no new dependency, no Remote Config key.
- **Asked by:** the owner, 2026-09-30, after seeing a reference app. Three messages that day, each building on the last.

## What the owner chose

1. *"just 5star per playstore per"* — a Rate Us entry in the drawer (Android only). Exactly five stars opens **our
   app's** Play Store page. One to four stays in the app and goes to our feedback. The reference app opened the
   publisher's page; ours opens the app's page.
2. After one to four stars: not a bare text box but a soft step — *"Thanks! What would make Invotick better for you?"* —
   with quick topics (Invoice design, Speed / app feels slow, Ads, Something didn't work, A feature I need,
   Language / translation, Other) and an optional note.
3. Then, having shown the existing "Share Your Feedback" dialog: *"is dailogue ko thora imporve kero … feedback typing ka
   option hata dena chahye by defualt and star ki selection ager 5 sy kam hy to phir feedback typing option open ho jae
   warna 5 star per play store per ly jae"*. **No second sheet: one dialog for every door.**

## Decided (as built)

- **One dialog.** `core/ui/.../FeedbackDialog.kt` is the app's only rating-and-feedback dialog. The feature/document copy
  and the saved estimate's private copy are deleted. Every door opens it: the invoice and estimate lists' support icon
  (`top_bar`), the drawer's Feedback (`drawer_feedback`) and new **Rate Us** (`drawer`, Android only), the exit dialog
  (`exit`), the saved invoice (`invoice_saved`) and saved estimate (`estimate_saved`).
- **It opens on the question and five stars only.** No text box, no button, until a star is chosen. The purple header
  is gone; theme roles only, one filled element (the button).
- **Five stars, Android:** "Rate on Google Play" opens `market://details?id=invotick.invoicemaker` in the Play Store app
  (asked for by package), falling back to `https://play.google.com/store/apps/details?id=invotick.invoicemaker`. Then a
  thank-you. If neither opens, the dialog stays and says so (`error_shown`).
- **Five stars, iOS:** no store step at all — a thank-you and an optional note, sent the way feedback always was.
- **One to four:** the soft step — topics, optional note, **Send** through the existing WhatsApp path. The team's copy
  carries `Source:`, `Stars:` and `Topics:` (English) above the user's words. A note under Send says WhatsApp opens with
  the message ready and nothing is sent until the user sends it there.
- **No separate "can we reply?" contact field.** The existing path is WhatsApp, which already carries the sender's
  number (owner's third message).
- **Rate Us is Android only:** shown only when the platform is Android **and** a store listing is bound; iOS binds none.

## The boundaries (policy)

- **Never the In-App Review API from this dialog.** Google Play's in-app review guidelines say an app must not ask the
  user anything before or while the review card is shown — not their opinion ("Do you like the app?"), not a
  predictive question ("Would you rate this app 5 stars?"). Our dialog *is* a question, so it may never lead to that
  card. It opens only the store's **listing page**, where the user rates, or not, on their own.
- **The automatic card (0176, `StoreReviewPolicy`) is untouched** and never triggered from, or triggering, this dialog.
- **iOS: Apple guideline 5.6.1** — apps must use Apple's provided API to prompt for ratings; custom review prompts are
  not allowed. So iOS has no entry and no store step.
- **No incentive, and no text asking for five stars.**
- **A grey area the owner accepted.** Offering the listing only to people who chose five stars is close to what Google's
  ratings policy calls steering only happy users to the store. It uses the listing, never the review API, and the owner
  accepted that risk on 2026-09-30.

## The guard (`TheStoreReviewPathAsksNothingTest`, rewritten)

1. The review path draws nothing, asks nothing and reads nothing the user said (unchanged).
2. Only the review path raises the store's card (unchanged).
3. Nothing of the dialog's flow — any file naming `FeedbackDialog`, `FeedbackRating` or `StoreListing` — names the review
   path or its API.
4. A store link lives in exactly one file, Android's `PlayStoreListing`, which opens it with `ACTION_VIEW`.
5. iOS names no listing and no store or write-review link.
6. The listing is opened only in `FeedbackRating.openStore`, which refuses anything but five stars (unit-tested), and the
   dialog reaches it only through that function.

Each rule also runs against a made-up source that breaks it. A real probe file (a `market://` string and a direct
`listing.open()`) turned the guard red with 2 failures, and green again once removed.

## Events (AGENTS-EVENTS)

No event was renamed and no new press event was added: the dialog's taps keep their ids, which have history (§1.8) —
`components_FeedbackDialog_2.*` (drawer, exit) and `components_FeedbackDialog.*` / `more_feedback_dailog_close`
(lists, saved invoice); the saved estimate keeps `EstimateSaveScreen.submit_14` / `maybe_later_13`.

- **The button's press** (`…submit_feedback_3`) is sent once its result is known, one event per press (§1.11), with
  `stars`, `outcome` (`play_store|play_store_unavailable|feedback|note`), `trigger` (the door), and for a Send
  `feedback_topics` (codes), `has_text`, `sent=true`. Never the words.
- **The close** (`…close_1` etc.) carries `method` (`close_button|scrim_or_back`), `had_input`, `step`, `trigger`, and
  after 1–4 stars what was left unsent (`feedback_topics`, `has_text`, `sent=false`).
- **Stars** keep their id with `stars` as a parameter. New: `feedback_topic` (chip tap: `topic`, `selected`, `trigger`)
  and `DrawerTiles.drawer_item_rate_us`.
- **Rejected:** a new `rate_us_submitted` name. It would split the history of the existing submit id (§1.8) and put a
  second event on the same press (§1.11). The same facts ride on the existing id.
- **No `screen_view` for the dialog:** a dialog is not a sheet or a route, and announcing it would make taps and coded
  events disagree about the screen (§1.2).

## Not built

- **The automatic showing** (owner's second message: after a confirmed share, gap `rate_us_gap_days` 30, cap
  `rate_us_max_auto_shows` 3, kill switch `rate_us_auto_enabled`, never in the same process as the store card, 60 days
  quiet after 1–4 stars, never again after five stars via `rated_five_at`). The agent's permission check refused to
  write the file that switches it on, so it was not built; the policy, coordinator and tests were drafted and set aside.
  It needs the owner's explicit go in the session before it is built. An automatic question about feelings is the
  riskier end of this grey area; it would carry the kill switch.
- **`rated_five_at` on the account:** the only preferences table (`user_preferences`) is not synced; syncing a field is
  a schema change on phone and server, so it would stay local.
- **"Help & Support is always in the menu":** there is no Help & Support entry (it is commented out in the drawer), so
  the thank-you does not claim one.

## Verified

- Full gate `testDebugUnitTest --continue --rerun-tasks`: **2118 tests, 0 failures, 0 errors** (baseline 2100 on
  `feat/review-happy-moment`; +10 `FeedbackRatingTest`, +4 `PlayStoreListingTest`, +4 guard).
- `:composeApp:compileKotlinIosSimulatorArm64` green. Strings in all 16 languages (+ `values-in`); the completeness test
  is green.
- Screenshots (Screen Map harness): stars only, three stars, three stars with topics, five stars (Android and iOS) in
  light and dark, and Arabic right to left — `kaam/research/rate-us-2026-09-30/index.html`.
