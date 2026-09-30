# 0189 — Rate Us: one feedback dialog, five stars opens our Play Store page (Android only)

- **Date:** 2026-09-30
- **Status:** built, not merged. App `invoice-kmp-app`: `feat/rate-us-drawer` @ `53bc9285`, off
  `feat/review-happy-moment` @ `33771bb4` (0176's addendum); the automatic showing on `feat/rate-us-auto` @ `75864199`,
  off `feat/rate-us-drawer`. **Pushed, not merged, not released.** No schema change, no server change, no new
  dependency. Three Remote Config keys (the automatic showing's, below).
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

## Addendum 2026-09-30 — the automatic showing, approved and built

**The owner's go.** In the main session on 2026-09-30 he was asked, in Roman Urdu, whether the dialog should also
appear by itself: after a successful invoice share, at most once per 30 days, up to 3 times per phone, never again
after five stars, never together with Google's card, and with a Remote Config off switch. The question told him the
risk: the app asking for stars itself and sending only five-star users to Play is the riskiest end of this grey area.
He chose **"Haan, banao (band switch ke saath)"** — yes, build it, with the off switch.

**As built (`feat/rate-us-auto` @ `75864199`, Android only):**
- **The same dialog.** No second sheet: one host at the app root (`RateUsAutoHost`) opens `FeedbackDialog` with
  `trigger=auto` and the drawer's tap ids. A note goes to the team's WhatsApp like every door's.
- **When.** After a confirmed invoice share, once the app has been in front for 5 s (the store card waits 2 s, so when
  both are due the card goes first and the dialog stands down), and again judged on screen: no full-screen ad, no
  native prompt, nothing drawn over the screens, no ad or paywall closed in the last `store_review_after_ad_seconds`.
- **Schedule** (`RateUsPromptPolicy`, in this order): `rate_us_auto_enabled` off → never · five stars from **any
  door** → never again (`rated_five_at`, this install) · `rate_us_max_auto_shows` reached (default **3**) · the first
  session · fewer than `rate_us_gap_days` (default **30**) since the last showing · fewer than **2× the gap** since
  one to four stars · the store card's own refusals (days of use, a crash last time, an error in the quiet hours) ·
  the store's card already went in this process · then the screen checks. A showing is counted when shown, so closing
  it unanswered uses one up.
- **One ask per process, both ways** (`OneAskPerProcess`, core/common): opening the dialog from any door takes it, so
  Google's card never follows our dialog; the automatic showing never follows the card. A door the user presses still
  opens after the card — only the automatic showing is refused.
- **Off switch.** `rate_us_auto_enabled` (text; only `false` switches it off; absent = on). `rate_us_gap_days` (≥ 1)
  and `rate_us_max_auto_shows` (0 = never) are read as text too. **iOS is hard off** whatever the console says, and
  nothing starts it there (Apple 5.6.1).
- **Never the In-App Review API.** Five stars still opens only our Play listing, through `FeedbackRating.openStore`.

**Events.** `rate_us_not_shown` (coded, at most one per share: `reason`, `trigger=invoice_share`, `auto_shows`,
`days_of_use`), silent for `switched_off`, `rated_five`, `cap_reached`. The showing's own taps are the dialog's
existing ids with `trigger=auto`; star taps now carry `trigger` too. The store card's `store_review_not_requested`
gains `reason=rate_us_dialog_this_session`. AGENTS-EVENTS §1.31.

**Rejected.** A second "Rate your experience" sheet (the earlier draft): one dialog for every door is the owner's own
rule. A `rate_us_shown` / `rate_us_submitted` name: the dialog's ids already carry it (§1.1, §1.8). Counting a
showing only when answered: a dismissal would then never use up the cap, and a user who always closes it would be
asked on every share after the gap.

**The guard, three more rules** (`TheStoreReviewPathAsksNothingTest`): the `rateus` package names nothing of the
store card's path (the In-App Review API, `StoreReviewLauncher`, the review package — `MyApplication` hands in the
card's record of use); it names no listing and opens nothing (the store is reached only through the dialog's five-star
rule); `RateUsAuto.start` is called only from `androidMain`. A real probe file turned the guard red with 4 failures,
and green again once removed.

**Verified.** Full gate `testDebugUnitTest --continue --rerun-tasks`: **2165 tests, 0 failures, 0 errors** (from
2118: +14 `RateUsPromptPolicyTest`, +22 `TheRatingDialogShowsItselfAfterAShareTest` on virtual time, +3
`OneAskPerProcessTest`, +4 store-card tests for the one ask, +1 `StoreReviewPolicyTest`, +3 guard).
`:composeApp:compileKotlinIosSimulatorArm64` green. Not tried on a device.

## Not built

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
