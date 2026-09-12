# 0066 — Leaving the app from the invoice screen, with no tap recorded, is a named stop on rung 3

- **Date:** 2026-09-12
- **Status:** built at the lead's direction on 2026-09-12, after the lead's own denylist check. The
  lead relayed it as the answer to question 1 of the user-journey report; the owner's own word is not
  recorded in this session. On `invotick-apis` `feat/journey-left-on-item-form`, not pushed.
  **Amends 0063**, which had left this case to the owner.
- **Decision:** Rung 3 gains the stop reason **`left_on_invoice_screen`** when the device's last
  background (`lastLeaveScreen`, 0063) was stamped `create_inv_scr` and none of the generic rules
  matched: no exit, back press, exit dialog or tap was recorded. It sits after `process_died` and
  before `unknown`. Rung 3 only, and only under the spelling background events carry.

## Why

In the week to 2026-09-12 (release, 24 h), rung 3 held 111 of the 151 `unknown` devices. Where they
last left the app from:

| screen | devices |
|---|---:|
| `create_inv_scr` | **81** |
| `splash_scr` | 27 |
| `dashboard` | 2 |
| no screen | 1 |

On that window `unknown` goes 151 → 140 with 0063 → **59** with this.

## The caveat, measured

This is the reason 0063 left it to the owner. `taps` counts auto-captured `tap:` rows, and the send
policy decides which of those ship.

- **The lead's check, 2026-09-12:** 23 keys are denied. The only create-invoice ones are the
  ad/premium dialog's: `tap:create_inv_scr:AdOrPremiumDialog.loading_ad_2`, plus `dismiss_1`,
  `go_premium_3` and `loading_ad_2` under `create_invoice_screen`. The screen's own form taps are sent.
- **So** a device in this bucket sent no tap from the form. It may have touched the ad/premium dialog,
  whose taps are invisible. The panel says *"koi tap record nahi hua"*, never "tap nahi kiya".
- **Measured:** of the 81, **0** sent any of that dialog's coded events (`watch_ad_click`,
  `ad_dialog_dismissed`, `ad_dailog_premium_click`, a `screen_view` of `ad_dialog_shown`) or any
  `create_inv_saved_click`, and **0** sent any `tap:` row. The query was calibrated: the same 81 ids
  return 81 devices and 4,532 events without the filter.

## Rejected

- **The rule on rungs 2 and 4–6.** The invoice screen is not where those devices stopped. A rung gets a
  place only once its unknowns are measured.
- **Matching `create_invoice_screen` too.** That is the spelling of auto-tap ids. No background event
  carried it in the 14 days to 2026-09-12.
- **`left_untouched`, or any name that says nothing was touched.** The evidence cannot support it,
  and 0030 removed exactly that name.
- **Sending the dialog's taps again, to close the caveat.** That is a send-policy decision and would
  change what the dialog's counts read. It is not taken here.

## Consequences

- Panel labels for `left_on_item_form` and `left_on_invoice_screen`: admin-panel `4e7a4ae`.
- If the dialog's taps are ever sent again, this bucket narrows: a device that touched the dialog moves
  to `tapped_around`.
- Tests: `JourneyStopReasonsTest`, 3 new.
  - The rule failed first: `expected left_on_invoice_screen but was unknown`.
  - A tap, a back press or an exit still outranks the place.
  - The rule applies on rung 3 only, and only under `create_inv_scr`.
