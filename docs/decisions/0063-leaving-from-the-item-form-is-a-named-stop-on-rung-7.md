# 0063 — Leaving the app from the item form is a named stop on rung 7

- **Date:** 2026-09-12
- **Status:** decided (owner, 2026-09-12, on the user-journey agent's recommendation); built on
  `invotick-apis` `feat/journey-left-on-item-form`, not pushed. Query-time: no app release.
- **Decision:** The first-invoice journey's signals query gains `lastLeaveScreen`: the screen stamped on
  the device's last `app_paused` / `app_background` in the range, ordered by `event_timestamp`. Rung 7
  gains the stop reason **`left_on_item_form`**, when that screen is `item_form_scr` and no action rule
  matched. It sits after `process_died` and before `unknown`.

## Why

2026-09-05 → 09-12, release builds, `withinMinutes=1440`: 1,735 first-time devices, 356 made an
invoice, 1,379 did not. **151 of the 1,379 were `unknown`**: rung 1: 12, rung 2: 5, rung 3: 111,
rung 7: 23.

Where the 23 rung-7 unknowns last left the app from:

| screen | devices |
|---|---:|
| `item_form_scr` | **11** |
| `create_inv_scr` | 3 |
| `add_payment_scr` | 2 |
| six other screens, one each | 6 |
| `splash_scr` | 1 |

The example was 798756a3: it added an item, and six seconds later went to the background from the item
form, with no Save. The new SQL was run read-only on production for 2026-09-12 and returns
`item_form_scr` for that device.

## Rejected

- **The last event before the exit as the reason.** 0030 rejected it: a symptom, unreadable at scale.
- **A `left_on_<screen>` rule for every rung.** On rung 3, 81 of the 111 unknowns last left from
  `create_inv_scr`. There, "left from the invoice screen" would name most of the step and could hide
  the tap evidence the send policy governs (AGENTS-EVENTS §1.5a). That one is the owner's decision.
- **Ordering by `created_at`.** It is arrival time: one flush gives a whole batch one timestamp.
- **A default getter on `JourneySignalsAgg`.** Spring may run an interface's default method instead of
  reading the column, and this one would always return null. The property is abstract.
- **A new app event.** Every fact needed is already on the background events.

## Consequences

- The name says where, never why (§1.14).
- On that window, rung-7 `unknown` should fall from 23 to 12.
- Until the admin panel adds a Roman Urdu label to `REASON_LABELS`, the panel shows the key raw.
- Tests: `JourneyStopReasonsTest` (the rule, its place in the order, rung 7 only) and
  `FirstInvoiceJourneyIsCountedPerDeviceTest` (read off the two background events, by
  `event_timestamp`, never `created_at`).
