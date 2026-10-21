# 0232 — How the panel proves the signup invitation worked (the measurement rules, decided before the code)

**Date:** 2026-10-22 · **Owner:** the owner ("jo qaide hain jo panel par prove karaingy ke jo hum chahtay thay wo mila ya nahi, wo bhi decide karke implement kar do") · **Follows:** 0231 (the design), 0228 (definition of done), 0229 (four goals)
**Registry id:** 157 · **App branch:** `feat/157-signup-at-exit` · **Panel section:** "Signup at exit"

## 1. The question, in one sentence

Among guests who have shown they keep coming back, does the invitation at app exit (with the Account safety line) make more of them create or join a real account within 14 days, without costing us the first real invoice, ad money, premium, a stay in the app, or an install?

## 2. Who is counted (the denominator)

- A **phone** (device id), a guest at the time, on build 1.5.5 or later, **eligible** from the first moment it is earned: a confirmed share, or 3 or more invoices, or a premium purchase, or use on 3 or more distinct days. Not on the first exit of an install. Our own phones and test devices left out and counted.
- **Arms (random, by phone):** `invited` and `holdout`. The holdout gets today's plain exit dialog and no safety dot. Default holdout 20 percent (`signup_invite_holdout_percent`; the code default is 20, never 0, so a missing key never leaks into the control).
- **Paying guests** (premium held by a guest account) are outside the holdout, always invited, and shown on their own descriptive line, never in the verdict (4 of 7 payers today).
- The arm is written once per phone by the coded event `signup_invite_assigned`; a phone never changes arm.

## 3. The primary number

**Signed up within 14 days of becoming eligible**: share of eligible phones that then register or sign in to a real account (`register_success` or `login_success`, Google or email). Counted once per phone, on or after the eligible time, window closed at day 14 (only phones whose 14 days have passed are in the number). Rows: also day 1 and day 7 as reading dates.

- **Baseline** (production 2026-10-22): about 150 registrations a month against about 5,000 weekly active guests; the holdout arm measures its own organic rate, nothing is assumed.
- **Declared expectation:** the invited arm reaches at least +3 percentage points over the holdout (for example 3 to 6 percent) in 14 days. Planned n for that: about 750 eligible phones in the holdout and about 3,000 invited at 80/20 (80 percent power, 5 percent two-sided). The panel prints the weeks still needed at the current intake.
- **Verdict:** Better when the 95 percent interval of the difference is wholly above 0 and each arm has at least 200 phones and 10 sign-ups; Worse when wholly below 0 or any guardrail below breaches; No clear difference when the interval crosses 0 with enough n; Not enough data below the minimum (never green, never red). Newcombe score interval, as the A/B Tests page.

## 4. The steps (mechanism), invited arm only

Eligible and exit dialog shown with the invitation -> Google or email pressed -> sign-in finished -> guest work joined the account (`guest_data_merged`). Plus: Stay pressed, Exit pressed, cancelled, error, and by safety level (At risk, Better, Safe). Cap compliance row: invitations beyond 1 in 3 exits or 3 a week must be 0.

## 5. Guardrails (each a row with n; a breach turns the whole section to Worse and names the switch)

| Family | Row | Breach when the whole 95 percent interval is beyond |
|:--|:--|:--|
| Stay in the app | exit confirmed share of exit dialogs (`app_exit_confirmed` against `app_exit_cancelled`), Stay is now an outline button | -3 pp (a drop in people who exit as before is read as annoyance) |
| G1 | invoices created in the 14 days after eligibility, per phone, and phones with a confirmed share | -5 percent relative |
| Money | ad revenue per phone-day (all formats, `ad_impression_value`) | -3 percent relative (the owner's rule) |
| Money | premium: paywall views and net purchase per phone | -3 percent relative; fewer than 10 buyers per arm: never red |
| Install | phones active then gone within 14 days (proxy, until Play uninstalls are readable) | +2 pp |
| Trust | merge failures (`guest_data_merged` failed or sign-in errors) after the invitation | any increase over zero is Worse; target 0 |
| Health | crash and ANR (Play, by version) and `error_shown` per 1,000 phones | +50 percent relative errors; Play +0.10 pp |

Counter-metric always shown: sign-ups that never opened the app again in 7 days (an invited sign-up that is not a user).
The four goals of 0229 are rows in the section: engagement (active days), uninstall proxy, return day 7 and day 30 (signed-up against not signed-up, descriptive only), LTV per phone-day with buyers beside it.

## 6. Events (coded, since a screen is shown without a press; `AGENTS-EVENTS.md` rules apply: one action, one event, parameters not new names)

- `signup_invite_assigned` once per phone: `arm`, `reason` (share, invoices, premium, days), `level` at assignment.
- `signup_invite_shown`: `surface` (exit or sheet), `level` (at_risk, better, safe), `reason`, `exits_since_last`, `shown_this_week`.
- `signup_invite_result`: `surface`, `action` (google, email, stay, exit, dismiss), `outcome` (done, cancelled, error), `error_class` on error.
- `top_bar_icon_shown`: `icon` (cloud), `state` (dot, syncing, offline, failed, done), once per state per session (for taps per 100 showings).
- The existing `register_success`, `login_success`, `guest_data_merged`, `app_exit_dialog_shown`, `app_exit_confirmed`, `app_exit_cancelled`, `sync_status_icon` stay as they are.

## 7. Switches (Remote Config, code defaults chosen to be safe)

`signup_exit_invite_enabled` (true), `signup_invite_holdout_percent` (20), `account_safety_line_enabled` (true), `top_bar_cloud_icon_standing_enabled` (true), `signup_invite_cap_exits` (3), `signup_invite_cap_per_week` (3). A breach names `signup_exit_invite_enabled` = false. Protective flips may be done at once and reported; any other change is the owner's word.

## 8. Read dates and the recommendation

Read dates: 24 h, day 7, day 14 (the primary), day 30 (retention). Between them only numbers, no verdict. Recommendation only at a read date: KEEP, ITERATE (primary up but a goal row down), ROLL BACK (any guardrail breach), WAIT (thin). Never a recommendation to remove an ad or paywall.

## 9. Silence and data-travel (rule 10, not optional)

- Health Centre `feature-events-arriving` also watches the four events (24 h, 200 active phones on build 1.5.5; the rare ones, `signup_invite_result` with action google, are judged over 7 days; zero rows with phones present is yellow 48 h then red, never green).
- Synthetic data with a known answer goes through the real road on a throwaway backend (0141): invited 6 of 200, holdout 2 of 100 -> known interval; a breach case (exit confirmed drops 5 pp); a thin case; a paying guest outside the holdout; a phone assigned twice; our own phone; cap violation; a build 1.5.4 phone (not counted). The test must be able to fail.

## 10. What is out of this decision

Free cloud limits, top-bar removals (a 14-day measurement first), the copy fixes (made in the same release, no measurement needed), and the release itself (only on the owner's word).
