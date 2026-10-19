# 0227 — The second invoice is one press away, and an unpaid one is remembered only when the person asks

- **Date:** 2026-10-19
- **Status:** built, **not pushed, not merged, not released**. App `invoice-kmp-app`: `feat/156-second-invoice` (worktree
  `kaam/worktrees/invoice-kmp-app-second`, off `ios/1.0.2-34` = the 1.5.3 code with the iOS fixes), seven commits, one
  per step, each droppable from the end. Gradle not run by the builder. No Room schema change, no server change, no new
  dependency. Four new Remote Config keys, five new coded events, new parameters on two existing events, 21 interface
  strings in 16 language folders and 4 runtime-catalogue sentences.
- **Asked by:** the owner, 2026-10-19: *"apply this mockup"*, on `kaam/research/second-invoice-nudges-mockup.html` (the
  screen contract), taking the mockup's own choice on every "owner to confirm" item. The test design (one 20 % control for
  all three nudges, code default 20) is the owner's, decision [0228](0228-owner-decisions-2026-10-19-panel-round-one-g1-pdf-and-the-test-groups.md) §2.
- **Reads with:** [0006](0006-g1-real-invoice-metric.md) (what a real invoice is), 0176
  (the store's card after the Nth confirmed share; `OneAskPerProcess`), [0226](0226-leaving-the-paywall-asks-one-tap-what-stopped-you.md)
  (the shape of an ask: one memory on the phone, the 60 s rule after an ad), [0228](0228-owner-decisions-2026-10-19-panel-round-one-g1-pdf-and-the-test-groups.md).

## Why (the measurement, `kaam/research/second-invoice-2026-10-19.md`)

Android 1.4.9+, 1,485 first-invoice devices, read 2026-10-19:

- A second invoice within **24 h 10.7 %**, **7 days 14.2 %**, 14 days 14.3 %; 30 days 15.4 % on older builds. 72 % of the
  second invoices of the first week happen on day one.
- **63 % (609 of 966) never open the app again** within 7 days of the first-invoice visit. Nothing brings them back: no
  reminder and no notification reaches anyone today (the old Due soon / Overdue code is commented out, and the backend
  sends no push about invoices or coming back).
- After a confirmed share, 443 of 604 come straight back to **the same invoice** through their own link and leave: the
  saved screen has **no next step**. "Duplicate" does not exist: a `DuplicateClicked` handler answered "coming soon", and
  nothing sent it.
- Second attempts fail mostly at the **empty form** (91 of 208), not at the ad dialog: Save → created is 85.6 % on a
  second attempt. **The ad dialog is not the blocker**, and nothing here touches it.

## What was decided

### The copy engine (A and B use it)

"Copy invoice as new" opens a **new, unsaved** invoice on the create screen. Nothing is written until the person presses
Save, through the same path, the same Save gate and ad dialog, and the same numbering as any new invoice.

| Copied | Never copied (G3) |
|:--|:--|
| business; client; every line (name, description, quantity, price, the line's tax and discount); the invoice's discount, tax and shipping | the invoice number: the create screen deals the next free one, through its existing duplicate guard |
| the currency the invoice is locked to (or its client's, for an invoice older than the stored currency) | the dates: issued today |
| notes, terms, payment method | every payment, so no PAID stamp; and the user's stamp itself (it can say PAID) |
| template, colour, logo, signature (template and presentation, the stamp taken out of it) | status (sent, viewed, approved, rejected), send date, share link and token |
| the days from issue to due (14 days on the source → today + 14; never below 0) | reminders, drafts, the PO number |

An invoice with no client or no line (or one deleted, or with no business) cannot be copied: a typed refusal
(`source_missing`, `no_business`, `no_client_or_items`, `db_error`). The copy never touches the person's autosaved draft:
it is not loaded, not overwritten, not cleared; Discard throws away only the copy. Above the form: **"Copied from
INV-0001. Check the amounts."** until the first change to a line.

### A. "Next step" on the saved invoice, after the first confirmed share

"Next step / Same client again? / We copy the client and items. You edit the amounts. / **Make another invoice**", over
the bottom edge of the preview, never resizing it; every touch outside it reaches the preview. Its layout is chosen by
measured room before it is drawn: the whole card up to 45 % of the preview, title and button up to 55 %, button and close
up to 62 %, else not shown. Outlined, nothing filled; a 48 dp close read as "Dismiss"; a 200 ms rise, none with reduced
motion; announced politely.

Shown only after a confirmed share of this invoice (`invoice_shared_success` without `purpose`), once per invoice, only
on the phone's first saved invoice, only with a client and a line, never over the day-3 reminder card, never in the
minute after a full-screen ad (and not tried again), a busy screen waited out for 10 s. **The first session is allowed**
(66 % of first shares happen in it). Its memory is the phone's, written before it is drawn.

### B. "Repeat" on the invoice list

An outlined **Repeat** row with a copy icon inside the **newest saved invoice's** card, and a Repeat icon in the top bar
when **exactly one** invoice is selected. Never on a draft, never without a client, never for several at once. The word
is the owner's ("Repeat", with the copy icon so it does not read as "recurring"); 0228 lists it as still open. A screen
reader hears "Repeat invoice INV-0005 for GIFTAT ENGINEERING (PVT) LTD". A failure says "We could not copy this invoice.
Please try again." through `error_shown`.

### C. The unpaid-invoice reminder, opt-in, Android

1. **Asked once on a phone**, on the invoice list, after a confirmed share of an unpaid invoice: "Get a reminder if an
   invoice is still unpaid after 3 days?" — **Remind me** (outlined) / **No thanks** (text). It is the process's one ask
   (`OneAskGate.Ask.REMINDER_OPT_IN`); never over the guest-merge strip, never while selecting.
2. **The notification permission is asked only on Remind me**, only on Android 13+ when needed. A refusal is never asked
   again: one honest line, "Reminders will show here. Phone notifications are blocked for Invotick.", with Open Settings.
3. **Nothing is scheduled before Remind me.** After it, every confirmed share of an unpaid invoice gets one reminder:
   **10:00 on day 3**, or on the due date when that is later (a net-30 invoice is not chased on day 3).
4. **The notification names nothing:** "Unpaid invoice / An invoice is still unpaid. Send a reminder?", on its own
   channel `unpaid_invoice_reminders` ("Unpaid invoice reminders"). One a day at most.
5. **Its tap opens that invoice** with the "Still unpaid?" card (Reminder / Still unpaid? / Send your client a polite
   reminder with the invoice link. You choose where it goes. / **Send reminder** / Stop these reminders). Send reminder
   makes the invoice's share link now (so an edited invoice sends its new link) and opens the share sheet with the polite
   message (the number, the business and the link, never the amount); **only the person sends it**. That share is
   `invoice_shared_success` with **`purpose=reminder`**: not a G1 share, not counted for the store's card, it does not
   move the invoice to Sent and does not start a Next step card.
6. **A reminder ends silently** when the invoice is paid in any part (a part-paid invoice is not "unpaid"), deleted or no
   longer on the phone: checked at its hour and whenever the list opens. No hook was added to the payment code.
7. **Notifications off, or today's one used:** the reminder shows inside the app, as a strip on the list: "INV-0001 is
   still unpaid." with Send reminder.
8. **Stop these reminders** ends every reminder on the phone. Android's own channel switch works too.
9. Reminders are **free**: no ad, no paywall. The old `PAYMENT_REMINDER` name ("Watch a short ad to set a payment
   reminder") and the old Due soon / Overdue code are untouched.

### The test (decision 0228 §2)

One **bundle**: a phone is dealt its arm once, the first time a nudge asks, from a stable FNV-1a bucket of its device id
(salt `nudges_holdout_v1`; a random bucket for a phone without a usable id), against Remote Config
**`nudges_holdout_percent`** (text). Under the share it is the control: none of the three nudges (the copy engine stays,
with no door). **The code's default is 20, not 0**: about a quarter of new phones decide before the first fetch lands, and
with 0 every one of them would fall into the treatment (the tour test's own leak). The arm is kept for ever on the phone;
one `nudges_assigned` says so. Each nudge keeps its own kill switch.

### Kill switches (text; off only on `false`; default on; saved after every fetch on both platforms)

`next_step_card_enabled`, `repeat_action_enabled`, `unpaid_reminder_enabled` (off: no strip, no new reminder, scheduled
ones silent), and the test's `nudges_holdout_percent`. The events are coded, so the analytics denylist cannot stop them:
these switches are their only off.

## Rejected

- **Reviving the old reminder code** (the commented-out picker, `ScheduleRemindersUseCase`, Due soon / Overdue): its
  notification text is "Invoice INV-0042 for GIFTAT ENGINEERING — USD 7,614.00", on a lock screen; and it would schedule
  without the person asking. C uses none of it and leaves it as it was; if it is ever revived it must say nothing of the
  invoice too.
- **A notification that names the client, the number or the amount**: anyone may read a lock screen.
- **Copy only in the saved screen's More menu**: "0 % use" was a button that did not exist; hiding the new one behind More
  repeats that. More keeps no Repeat for now (a later, separate choice).
- **Copying payments, the number or the status**: a copy that arrives PAID, under the same number, or "Sent", is the
  exact trust failure G3 forbids. The number comes from the create screen's own numbering and guard.
- **Reminders behind an ad or Premium**: no reminder gate runs today; putting one there is a monetisation question for
  the owner, with evidence, never a default here.
- **A reminder for everyone, without asking**: nothing is scheduled without "Remind me".
- **Repeat on every card**: about 49 dp more per card; the list loses its density for one action.
- **Shrinking the preview to fit the card**: the document would jump; the card lies over it instead.
- **A code default of 0 for the test**: see "The test".

## Events (AGENTS-EVENTS §1.39)

| Event (coded, new) | One row per | Parameters |
|:--|:--|:--|
| `next_step_card` | card shown, when its life ends | `entry=first_share`, `outcome` pressed\|dismissed\|left, `layout` full\|title\|button, `shown_ms` |
| `repeat_action` | press of Repeat | `entry` list_latest\|list_selection, `outcome` opened\|failed, `reason` (failed only) |
| `reminder_opt_in` | question shown, when it ends | `entry=list_strip`, `outcome` on\|declined\|left, `permission` (after Remind me), `shown_ms` |
| `unpaid_reminder` | reminder, when it leaves the person's hands | `entry` notification\|list_strip (absent when unanswered), `outcome` shared\|dismissed\|stopped\|unanswered, `delivery` notification\|in_app\|none, `days_since_share` |
| `nudges_assigned` | phone, once | `arm` on\|off, `bucket`, `bucket_source`, `holdout_percent`, `percent_source` |

On existing events: `invoice_created_success.origin` (new\|repeat), and on a repeat `repeat_entry` and
`amounts_changed` (a yes/no, never an amount); `invoice_shared_success.purpose=reminder` on a reminder's share only.
`store_review_not_requested.reason` and `rate_us_not_shown.reason` gain `reminder_opt_in_this_session`.

## The number, its denominator, the expectation, the guardrails (measurement rule of 2026-10-19)

- **The number:** of the phones whose **first** `invoice_created_success` falls in the window, the share with a **second**
  `invoice_created_success` within **7 days**, read **per arm** (`nudges_assigned.arm`). Denominator: first-invoice
  creators with a full 7-day window, assigned, our own test phones out (§3.15). 0228 reads it on all first-invoice
  creators (~270 a week; about 9 weeks to see +4 points), with the first sharers (~125 a week) as the second view.
- **Read beside it:** the share of second invoices with `origin=repeat` in the `on` arm; `amounts_changed`;
  `next_step_card` pressed / shown; `repeat_action` opened / failed; `reminder_opt_in` on / shown and its `permission`;
  `unpaid_reminder` shared / ended.
- **Expectation:** the `on` arm's 7-day second-invoice rate is above the control's (base ≈ 14 %).
- **Guardrails (a breach stops the nudge and goes to the owner):** no duplicate invoice numbers (`ci_save_validation_failed`
  `field=invoice_number` no higher in `on` than in `off`; target 0); `repeat_action` failed and `error_shown`
  `subject=invoice` rates; the first-invoice confirmed-share rate no lower in `on`; ad impressions and revenue per phone
  read in both arms (no gate changed); `reminder_opt_in.permission=asked_denied` and `unpaid_reminder` `stopped`; crash and
  ANR per arm.

## Honest limits

- **C cannot prove a payment**: the app only sees payments the person records. It is read as opt-ins, notifications,
  Send reminder presses and shares, beside the headline.
- **A bundle cannot say which nudge worked** (0228 chose it knowingly).
- **"Unpaid" means no payment recorded**: some invoices paid in cash and never recorded will still be reminded.
- **The question's wording says "after 3 days"**; a net-30 invoice is reminded on its due date, and the channel's
  description says "3 days after you share". Both strings are the approved mockup's; flagged for the owner.
- **Android only for C**: iOS local notifications fire without running our code, so "still unpaid, not stopped, one a
  day, switch on" cannot be checked at their hour; doing it needs payment and delete hooks and a tap route in the iOS app
  delegate. iOS gets A and B; the opt-in is never offered on iOS (no alarm is bound there).
- **A notification in a process started by WorkManager may read English** until the interface language is loaded (the
  same as every notification the app builds outside a screen).
- **One phone, one memory**: another phone or a reinstall may be asked again; a reminder rings only on the phone that
  scheduled it. A reminder for another account's invoice (account switched since) ends silently as "not on the phone".
- **Several reminders due the same day:** one notification opens its invoice; the others show on the list as the app's
  own strip, oldest first (the mockup's "list with the oldest's strip" for the tap itself is not built).
- **The panel, the synthetic data set, the data-travel test and the Health Centre silence check** (items 3–6 of the
  measurement rule) are **not built**: this was the app's half. Open below.

## Changed from the mockup, and why

- The four runtime-catalogue ids carry their hash (`rt_unpaid_invoice_351b02db`, …): the catalogue's guard requires
  `RuntimeText.keyOf` the English.
- `nudges_assigned` names its share's source `percent_source` (remote\|missing\|invalid), the name and values the tour
  test already uses, not `source=remote|default` (§1.15), and adds `bucket` and `bucket_source`.
- `repeat_action.reason` adds `no_business` (an invoice with no business has nothing to be written under); every word says
  what was seen.
- `amounts_changed` is also true when a line was added or removed, not only when a price or quantity moved.
- Shipping is copied with the discount and tax lines (leaving it out would change the total silently).
- The strings went in with the step that draws them, not in a seventh commit, so a late step can be dropped cleanly.

## Open

1. **Admin panel**: the per-arm card (expectation against result, n everywhere, "not enough data" below the threshold),
   the guardrails, a Health Centre check that each of the five events arrives (0 rows = "no data yet"), and the synthetic
   data-travel test. Backend and panel work, not built here.
2. **The word "Repeat"** against "Copy as new" (0228, still open).
3. **iOS for C**, as above.
4. **Translations** were written by the builder, not native speakers.

## How to measure after release

```sql
-- arms
SELECT params->>'$.arm' AS arm, COUNT(DISTINCT app_instance_id) AS phones
FROM analytics_events
WHERE event_name = 'nudges_assigned' AND created_at >= :from AND created_at < :to
GROUP BY arm;

-- each nudge's own row, by outcome
SELECT event_name, params->>'$.outcome' AS outcome, COUNT(*) AS n, COUNT(DISTINCT app_instance_id) AS phones
FROM analytics_events
WHERE event_name IN ('next_step_card', 'repeat_action', 'reminder_opt_in', 'unpaid_reminder')
  AND app_version_code >= :first_version_code AND created_at >= :from AND created_at < :to
GROUP BY event_name, outcome ORDER BY event_name, n DESC;
```

The headline joins each phone's first and second `invoice_created_success` to its arm, within 7 days of the first, only
for phones whose 7 days have passed. Read `origin`, and `purpose` on shares, before counting anything as G1.

## Not verified

Gradle was not run by the builder; no device run. Not seen on a phone: the card's measured layouts at 360 × 640 and font
1.5, TalkBack, the permission dialog's answers (the `blocked` reading is a refusal that came back within 300 ms), the
WorkManager job at 10:00, the notification's tap from a killed process, and the reminder's message in WhatsApp in Arabic.
