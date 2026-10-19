# 0225 — "Rate Invotick" goes straight to the store's own sheet; the stars dialog names its scale

- **Date:** 2026-10-19
- **Status:** built, **not pushed, not merged, not released**. App `invoice-kmp-app`: `feat/154-rating-support`
  (worktree `kaam/worktrees/invoice-kmp-app-rating`, off `fix/153-sync-defects` = the 1.5.3 code), commits `c44a14cc0`,
  `52565a004`, `1c076e378`, `31a823a17`. Gradle not run by the builder. No schema change, no server change, no new
  dependency. One new Remote Config key.
- **Asked by:** the owner, 2026-10-19 — **Option A**, after the measured rating flow
  (`kaam/research/rating-flow-measured-2026-10-18.md`) and the mockups `kaam/research/support-icon-two-choices-mockup.html`
  and `kaam/research/support-icon-option-a-mockup.html` (the screen contract).
- **Amends** [0176](0176-the-stores-rating-sheet-is-requested-after-the-nth-share-and-nothing-is-asked-first.md) (the
  store's card now also has a user-pressed door, still with nothing asked first) and
  [0189](0189-rate-us-in-the-drawer.md) (the support icon no longer opens the stars dialog; the dialog's Play button
  is offered after any star, not only five).

## Why

Measured, 1.5.0–1.5.2, 19 days: the stars dialog opened at least 641 times, **533 (83 %) from the lists' support
icon**. 74 % closed without a star. Many who press a "support" icon want help, not a rating. Final answers: 5★ 109,
4★ 13, 3★ 10, 2★ 4, **1★ 28** — more ones than twos, threes and fours together, which reads as some people taking 1 for
"the best". The automatic store card was requested 21 times; **8 ended within 20 ms**, almost certainly drawing nothing.

## What was decided

1. **The lists' support icon opens "How can we help?"** — a small sheet with two equal cards, neither filled nor
   smaller, side by side while they fit and stacked when they do not.
2. **"I need help"**: the seven existing topics, an optional note, and the exact message WhatsApp will open with, shown
   before the press: `Source`, `Topics` (English), `App` (version name and code), `Phone`, `OS`, `Language`, then the
   note. No stars, no name, no e-mail, no invoice. **Open WhatsApp** opens the team's chat (the number the feedback path
   already uses) with it typed; the promise is only what is true — nothing is sent until the user sends it there, and
   no reply time is promised. Without WhatsApp: the reason, and **Copy message**.
3. **"Rate Invotick"** goes **straight to the store's own sheet** (Play's In-App Review flow), with no stars and no
   question of ours before it — the same for everyone. Because the press is the user's, the store's quota must not
   leave them with nothing: when the sheet may not have appeared, **our listing opens by the ordinary link**:
   - Play refused before any sheet, or the flow failed → listing (`error_listing`);
   - Play has no Play Store on the phone (`play_store_not_found`) → listing (`listing_opened`);
   - the flow "completed" in **under 1,500 ms** (`RateSheetResult.FAST_END_MS`) → listing (`fast_end_listing`);
   - otherwise the card ran and nothing else opens (`card_completed`).
   The press takes the process's one ask (`OneAskGate.Ask.RATE_SHEET`): the automatic card (refused as
   `rate_sheet_this_session`) and the dialog's automatic showing do not follow it. Like a door pressed, it goes even
   when another ask went first.
4. **The other doors keep the stars dialog** (drawer Feedback and Rate Us, exit dialog, saved invoice and estimate, the
   automatic showing), now with:
   - a scale under the stars, `1 = Poor` at the start and `5 = Excellent` at the end, before any tap (one template
     `%1$d = %2$s` plus five names, so the two always agree); a chosen star's **name replaces the question** in the
     title (Poor, Fair, Good, Very good, Excellent); a screen reader hears "Star 1, Poor";
   - **1–3 stars**: "Sorry to hear that." with "Tell us what went wrong" (the topics) **and an equal-size outlined
     "Rate on Google Play"**;
   - **4 stars**: Play leads, plus a small "Something to improve? Tell us";
   - **5 stars**: unchanged.
   That Play button opens **only our listing**, by an ordinary link, at any star — **never** the in-app review sheet.
   No star of ours ever leads to the store's sheet.
5. **Kill switch** `rate_sheet_direct_enabled` (read as text, off only on `false`, default on): off, the support icon
   opens the stars dialog as before, and no "Rate Invotick" press exists.

## Rejected

- **Option B — our stars first, then the store's sheet for every star level.** The store's sheet would follow a
  question of ours. Google Play's in-app review guidelines forbid asking anything before or while the card is shown,
  including "how was your experience?". Equal treatment of every star does not make the question disappear.
- **The store's sheet only for 4–5 stars.** Review gating: choosing who meets the store by how they feel. Against
  Play's ratings policy and Apple's rules alike.
- **A delayed store sheet for 5-star answerers** (minutes, or the next session). The delay changes nothing: the
  selection is still by the answer, so it is still gating, and 0176's guard exists to stop it.
- **The store's sheet for 5 stars only.** The narrowest form of the same gating; it would also have needed the owner's
  explicit acceptance of the risk, and Option A makes it unnecessary.
- **Keeping the Play button for 5 stars only on the other doors** (0189's grey area). Offering the listing only to
  five-star answers steers the happy ones to the store; Option A offers it after every star, equally sized after 1–3.

## Events (AGENTS-EVENTS §1.37)

- **`support_help_whatsapp`**, coded, one per press of Open WhatsApp or Copy message: `trigger`, `feedback_topics`
  (codes, the dialog's own name for them), `has_note`, `outcome` (`whatsapp_opened|unavailable|copied`). Never the
  note's words; the phone and version are the gateway's own stamps.
- **`rate_sheet_result`**, coded, one per press of Rate Invotick: `trigger`, `outcome`
  (`card_completed|fast_end_listing|error_listing|listing_opened|listing_unavailable`), `elapsed_ms` (press to the
  store's answer or our refusal); on a failure only, `error_code` + `error` (Play's own words), `reason` (our check:
  `prompt_taken`, `no_screen`) and `exception_class`. No stars: there are none on this path.
- **Taps** (auto-captured): `support_sheet_help_card`, `support_sheet_rate_card`, `support_sheet_back`,
  `support_sheet_close` (`method`, `had_input`); the sheet's own `screen_view` `support_sheet`; the topics reuse
  `feedback_topic`. In the stars dialog: `feedback_tell_what_went_wrong` and `feedback_something_to_improve`
  (`stars`, `trigger`); the close's `step` gains `help_or_store`.
- `store_review_not_requested.reason` gains `rate_sheet_this_session`.

⚠️ **`outcome=play_store` may carry 1–4 stars from this build.** Until now every one of them was five stars (89 of
89). A query or panel that reads `play_store` as "five stars" must read `stars` instead.

## Open — owner to confirm

1. **4 stars** leads with Play plus the small link (the mockup's proposal). One constant flips it to the 1–3 screen:
   `FeedbackRating.FOUR_STARS_LEAD_WITH_STORE`.
2. **The 1,500 ms threshold** (`RateSheetResult.FAST_END_MS`): an estimate between the 20 ms quota refusals and the
   seconds a card a person read runs. A very fast cancel can open the listing by mistake. Tune after a device test.
3. **"Couldn't open the store."** — the sentence when even the listing fails (counted as `error_shown`).
4. ~~**iOS:** no Rate card.~~ **Decided 2026-10-19 — see the addendum below: iOS shows the Rate card.** Apple asks that its rating prompt is not raised from a button, and 0189's guard keeps every
   store link off iOS, so the support icon on an iPhone opens the help directly (`SupportHelp.rateCardShown`). The App
   Store listing exists since 2026-10-15 (id6757918977); a direct link there is a new decision.
5. **"Copy message"** when WhatsApp is missing — built, as the mockup proposed.
6. **3 stars' line**: "Sorry to hear that." may read oddly beside "3 = Good"; the mockup's alternative is "Thanks for
   telling us." One string.

## The guard

`TheStoreReviewPathAsksNothingTest` keeps rules 1–3 and gains rule 4: the press's code (`StoreSheetOnPress`) lives in
the review path, so it reads nothing the user said and draws nothing; the feedback flow reaches it only through
`RateSheet`, bound once per platform (Android, and iOS since the addendum below); nothing that shows our stars names `RateSheet`. Each rule has a probe that
breaks it. The listing is still opened in one file, `FeedbackRating.kt`.

## How to measure after release

```sql
SELECT event_name, params->>'$.outcome' AS outcome, COUNT(*) AS n, COUNT(DISTINCT app_instance_id) AS devices
FROM analytics_events
WHERE event_name IN ('rate_sheet_result', 'support_help_whatsapp')
  AND app_version_code >= :first_version_code
  AND created_at >= :from AND created_at < :to
GROUP BY event_name, outcome ORDER BY event_name, n DESC;
```

`fast_end_listing` against `card_completed` is the threshold's own check; `elapsed_ms` on both shows where the line
should sit. Whether anyone actually rated is still not measurable: neither store says.

## Not verified

Gradle was not run by the builder; no device run. Play's card shows only in a build installed from Play (internal
testing), so the `card_completed` branch needs that track to be seen at all.

## Addendum 2026-10-19 — iOS: the Rate card is shown

- **Asked by:** the owner, after seeing iOS TestFlight 1.0.2 build 33, where the lists' support icon opened "I need
  help" directly. The iOS exception (open point 4) was a build shortcut marked "owner to confirm" in the mockup; he does
  not accept it. **One sheet, "How can we help?", two equal cards, on both platforms.**
- **What iOS does:** "Rate Invotick" opens the **App Store's own "write a review" page** for our app, by Apple's link
  for a button the user pressed: `https://apps.apple.com/app/id6757918977?action=write-review` (the https form, the
  app's existing App Store page `getPlatformShareUrl()` plus `action=write-review`). No stars and no question of ours
  before it, as on Android. The press takes the process's one ask (`OneAskGate.Ask.RATE_SHEET`), so the automatic
  StoreKit request (`IosStoreReview`, untouched) does not follow it in that process.
- **Why not StoreKit's request (`SKStoreReviewController`):** Apple shows it at most three times a year per user and
  says nothing about whether it appeared, so a button the user pressed could do nothing, silently. The write-review page
  always opens where the App Store is.
- **Event:** the same `rate_sheet_result`. On iOS only `listing_opened` (the page opened) and `listing_unavailable` (it
  could not; the sheet says "Couldn't open the store.", counted as `error_shown`). No new outcome name. Split by platform
  before reading `listing_opened` (AGENTS-EVENTS §1.37).
- **Code** (`invoice-kmp-app`, branch `ios/1.0.2-34`, worktree `kaam/worktrees/invoice-kmp-app-ios34`, for iOS 1.0.2
  build 34): `StorePageOnPress` + `AppStorePage` (commonMain review path), `openAppStoreWriteReview` (iosMain), bound in
  `IosPlatformModule`.
- **Guard:** `TheStoreReviewPathAsksNothingTest` rule 4 is now *bound once per platform* (one `androidMain`, one
  `iosMain`, none in shared code); rule 2 allows exactly two store-link files (`PlayStoreListing` and
  `StorePageOnPress.kt`); iOS still binds no `StoreListing`, so the stars dialog keeps no store step on an iPhone.
- **Rejected:** keeping the iPhone without a Rate card (the owner's decision above); StoreKit's request on the press
  (capped, silent); the `itms-apps://` form (the app already uses the https page, which the App Store app answers as a
  universal link).
- **Not verified:** Gradle not run by the builder; no device run. TestFlight can show whether the page opens.
