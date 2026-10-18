# 0226 — Leaving the paywall without buying asks one tap: what stopped you

- **Date:** 2026-10-19
- **Status:** built, **not pushed, not merged, not released**. App `invoice-kmp-app`: `feat/155-exit-question` (worktree
  `kaam/worktrees/invoice-kmp-app-exitq`, off `feat/154-rating-support`, which is off the 1.5.3 code). Gradle not run
  by the builder. No schema change, no server change, no new dependency. Two new Remote Config keys, one new coded
  event, 15 new strings.
- **Asked by:** the owner, 2026-10-19: *"apply it so we learn why the paywall churn is so high"*, on the mockup
  `kaam/research/paywall-exit-question-mockup.html` (the screen contract), accepting the mockup's default for every
  "owner to confirm" item.
- **Reads with:** [0155](0155-the-paywall-names-its-door-and-each-continue-names-its-result.md) (the door, and
  `premium_purchase_result`), [0176](0176-the-stores-rating-sheet-is-requested-after-the-nth-share-and-nothing-is-asked-first.md)
  and [0189](0189-rate-us-in-the-drawer.md) (`OneAskPerProcess`), [0225](0225-rate-invotick-goes-straight-to-the-stores-own-sheet.md).

## Why

Measured, Android, the 30 days to 2026-10-19 (`kaam/research/premium-buyers-and-growth-2026-10-19.md`): **1,783**
phones saw the paywall; **145 (8 %)** pressed Continue, so 92 % never did. On 1.4.9+, Continue gave **119** store
results: the user closed Google's sheet **106 times (89 %)**; **4** were real purchases. Nothing says why. Google only
says "closed".

## What was decided

1. **Two questions, one strip.**
   - **"What stopped you?"** (`question=exit`) after the paywall was closed by ×, swipe, back or a tap outside it,
     without buying. The paywall closes first, as it always did; about **0.6 s** after the user is back on their own
     screen, the strip rises.
   - **"What happened?"** (`question=sheet_closed`) after the store's own purchase sheet was closed by the user
     (`premium_purchase_result.outcome=user_cancelled`), back on the paywall, **1.2 s** after the app is in front. The
     paywall makes room under its content and scrolls just far enough for Continue to stay 12 dp above the strip.
2. **Answers, one tap, no typing.** Exit: Too expensive · I do not need it right now · I am not sure what I get · Free is
   enough for me · I had a payment problem · Something else. Sheet: The price was not what I expected · I picked the
   wrong plan · I could not pay (no card or method) · I was only looking · Something else. The order is shuffled once
   per phone (a seed kept on the phone) and stays the same; "Something else" is always last. Plus **Skip** (always in
   view, 48 × 48 dp) and swipe down = Skip.
3. **The strip** sits where a Snackbar sits: above the screen's own bottom bar (tab bar, Save, Share, a banner), which
   now registers its top edge (`BottomActions`), so it never covers Save, Share, Continue or an ad. No scrim; every
   touch outside it reaches the screen. Outline chips (≥ 48 dp, no fixed text heights, two equal columns, one at a large
   font), a 3 dp timer line, at most 45 % of the window with the answers scrolling inside, title and Skip pinned. **No
   filled element.** RTL mirrors. After an answer: a tick and "Thanks, noted." for 1.2 s, then down.
4. **It leaves by itself** after 8 s (12 s above font scale 1.3), never while a finger is on it, and has **no timer at
   all with a screen reader on**; it announces itself as "Quick question". Reduced motion: no slide.
5. **Who and when — never:**
   - in the install's first session (`open_count` 1, or not counted yet);
   - twice in 30 days on a phone (`exit_question_gap_days`; answered, skipped and timed out all count);
   - twice in one paywall visit (either question; one memory for both);
   - to anyone premium, or who bought or restored in that visit;
   - within 60 s of a full-screen ad closing or an error the user saw — and that visit is not tried again;
   - in a process in which the rating dialog, the store's card, the user's "Rate Invotick" or **the consent form** has
     gone; and once it has gone, the automatic card and the dialog's automatic showing do not follow it
     (`OneAskGate.Ask.EXIT_QUESTION`; doors the user presses still open);
   - "What happened?" after any other store result (failed, pending, already owned, launch failed, no result, our own
     refusal): each has its own message;
   - over a dialog, a sheet, an ad or a native question: it waits up to 10 s, then gives up;
   - once the user has left the screen the paywall opened over.
6. **The memory is on the phone**, `exit_question_last_ms` in DataStore, not on the account (96.6 % are guests). It is
   written as the strip is shown, so it can never show twice; if it cannot be written, nothing shows. An `interrupted`
   strip (the user moved on, the app left, another sheet opened, the paywall closed under it) writes back what was there.
7. **Kill switch** `exit_question_enabled` (text, off only on `false`, default on). The event is coded, so the analytics
   denylist cannot stop it; this is its only switch.
8. **The paywall's × is 48 dp to touch** (it was the 26 dp disc); the drawn disc did not move or change. A separate commit.

## Rejected

- **Free text** ("tell us why"): a typed sentence can carry a name or a number, which never goes in an event; and a
  keyboard is a second step nobody leaving a paywall wants. "Something else" says only that; that is accepted.
- **A modal before leaving** (the × asks first, then closes): it stands between the user and their own screen, and on
  the Save and Share gates it is one more step before their invoice. The paywall must close when it is closed.
- **Asking at every exit**: 2,742 visits by 1,783 phones; asking each one is nagging, and one person's fifth answer is
  not five people. Once in 30 days per phone.
- **Asking inside the ad dialog** ("watch an ad or go Premium"): that dialog gates Save and Share; a question there is
  friction on the user's own invoice and touches a monetisation surface. Never.
- **A survey only after a purchase**: it asks the 4 who bought, not the 1,779 who did not; it answers the wrong question.

## Events (AGENTS-EVENTS §1.38)

One coded **`paywall_exit_reason`** per strip shown: `question` (`exit|sheet_closed`), `outcome`
(`answered|skipped|timed_out|interrupted`), `reason` (only on `answered`), `entry` (0155's door, when known), `plan`
(the visit's last Continue, `premium_purchase_result.plan`, when one was pressed), `position` (the chosen chip's place,
1 first, only on `answered`), `shown_ms` (steps of 100 ms). Never any text. The chips and Skip have no tap of their own.
Every strip shown leaves exactly one row, so "shown" and "answered" come from one event; only a strip during which the
process died leaves none. `store_review_not_requested.reason` and `rate_us_not_shown.reason` gain
`exit_question_this_session`.

## Honest limits

- **Answers are hints, not proof.** "Too expensive" is the easiest answer: nothing to type, no fault of one's own. Never
  cut a price on it alone; read it beside net revenue per paywall viewer (the monetisation rule: gain and cost).
- **The response rate is unknown** until the first week. Both ends can lean: only people who pass the rules are asked
  (no first session, nobody right after an ad), and only people who answer, answer.
- **The first session is excluded, and that is half of Continue.** 57 % of the phones that pressed Continue (82 of 145)
  did so on their very first open; "What happened?" will never reach them. The owner chose `open_count` 1 knowing it.
- **"What happened?" may be rarer still**: a resume ad after the store's sheet (seen on one buyer, twice) starts the
  60 s rule. How often is not measured.
- **Small numbers.** About 100 people a month close the store's sheet; a fraction will answer; per country, fewer.
  Pakistan and India are 58 % of viewers, so the total is mostly their voice: read it per country.
- **One phone, one vote in 30 days**: this counts people, not visits.
- **"Something else" tells nothing**, on purpose. Above 25 % of answers, the choices need changing.
- **Position matters**: the order is per phone, and `position` shows whether the first place gained.

## Changed from the mockup, and why

- **Consent form joins the rule from one side only.** The mockup said it should be in the gate. The question now stays
  out of a process in which the consent form was shown (`SystemPromptScreen.hasHeld`, a read-only record). The consent
  form itself is never refused by the gate: it is a legal question, not an ask.
- **"interrupted" also covers a touch outside the strip and another sheet opening over it**, as the mockup's list
  screen describes; and the paywall closing under "What happened?".
- **The refusal words are new and only logged**; only shown strips send a row, as the mockup's table says.
- **A tap on the paywall's scrim counts as leaving by hand**, like × and back: it is the user's own close.
- **The order seed** is a second DataStore key (`exit_question_order_seed`), beside `exit_question_last_ms`.

## Open

1. **Admin panel**: a "Why not bought" card under Revenue/Billing (answers × door, answers × country, "hints, not
   proof" on top, no percent under 30 answers) and a Health Centre check that the event arrives (0 rows = "no data
   yet"). Backend and panel work, not built here.
2. **No help for "I had a payment problem"** (owner accepted). A WhatsApp line later is a new decision.
3. **iOS**: the same strip after StoreKit's `user_cancelled`. No iPhone has bought yet, so expect few rows.
4. **Translations** were written by the builder, not a native speaker.

## How to measure after release

```sql
SELECT params->>'$.question' AS question, params->>'$.outcome' AS outcome, params->>'$.reason' AS reason,
       COUNT(*) AS strips, COUNT(DISTINCT app_instance_id) AS phones
FROM analytics_events
WHERE event_name = 'paywall_exit_reason'
  AND app_version_code >= :first_version_code
  AND created_at >= :from AND created_at < :to
GROUP BY question, outcome, reason ORDER BY question, strips DESC;
```

Always read `reason` with `question`; read `entry` and country beside it.

## Not verified

Gradle was not run by the builder; no device run. Not seen on a phone: the strip's placement over each screen's bottom
bar, the paywall's scroll keeping Continue above "What happened?", TalkBack and VoiceOver announcements, and the store's
real `user_cancelled` on Play and the App Store.
