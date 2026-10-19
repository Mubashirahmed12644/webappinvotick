# 0228: The owner's decisions of 2026-10-19: panel round one, PDF in G1, the nudge test, what we read from Play and AdMob

Decided in chat on 2026-10-19, one question at a time, each answered with a single tap.

## Decisions
1. **Panel "Release Impact", round one is built only from data we already hold, with no new database table.** The first
   section is 1.5.3 against 1.5.2 during the 20% staged rollout. The Play vitals table (crash and ANR by version) is a
   later step and needs the owner's word because it adds a table.
   *Rejected:* adding the Play vitals table in round one (more time, a schema change, more risk).
2. **The 1.5.4 second-invoice nudges (next-step card, Repeat, unpaid reminder) run behind one 20% control group**
   (`nudges_holdout_percent`, code default 20, a Remote Config text key) and are read on every first-invoice creator
   (about 270 a week, about 9 weeks to see +4 points), not only on those who shared (about 125 a week, about 19 weeks).
   One bundle test: it will not say which of the three worked.
   *Rejected:* card A alone first (cleaner but each of B and C then needs its own 2 to 4 months); no control group
   (then the effect cannot be measured, only "associated").
3. **PDF download is counted towards G1 as its own line, "PDF sent"** (it was not counted at all: 41% of first-invoice
   creators download a PDF; G1 reads 10.0% without it and 11.6% with it, 7-day cohort, 2026-10-19 report).
   Decision 0006 (a real invoice = a confirmed share or a payment) gains this line; a confirmed share and a payment keep
   their own lines, and every report shows the three apart so the old definition stays readable.
   *Rejected:* leaving PDF out (a person who sends the PDF by hand has made a real invoice).
4. **Play ratings:** the owner grants the service account `play-uploader` the read-only permission "View app information
   and download bulk reports" and gives the Console developer id; until then the rating figures are read by hand from the
   Play Console Ratings screen.
   *Rejected:* screenshots as the standing method (manual, slow).
5. **Ad revenue is first read from our own events (`ad_impression_value`).** AdMob's read-only permission is a later
   cross-check, not a start condition.
6. **The 16 old TestFlight builds outside 1.0.1 and 1.0.2 were expired** (1.4, 1.4.4, 1.4.5, 1.4.6, 1.4.7, 1.4.9; the older
   1.0 and 1.3 builds had expired already). It cannot be undone. Builds 25 to 32 of 1.0.1 and 33, 34 of 1.0.2 stay.
7. **How the assistant asks:** one decision at a time, as a bottom-sheet question with single-tap options, the plain
   explanation written first (memory `no-popup-questions`, reversed 2026-10-19).

## Still open (asked one at a time, in this order)
Banner refresh on the paywall after Continue; the word "Repeat" or "Copy as new"; Android 1.5.3 from 20% to 99% after
24 to 48 hours of clean vitals; submitting iOS 1.0.2 for App Store review; whether to keep the old server's expiry on
2026-10-22 (not renewed).
