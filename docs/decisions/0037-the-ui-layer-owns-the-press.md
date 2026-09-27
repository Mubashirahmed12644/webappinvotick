# 0037 — The UI layer owns the press; the coded twin goes

- **Date:** 2026-09-05
- **Status:** decided, in app branch `VC_95_VN_143` (1.4.3)
- **Decision:** When one press produces both an auto-captured UI event (`analyticsId` /
  `navigationAnalyticsId`) and an `analytics.trackClick` in the view model, **keep the auto one and
  delete the coded one.** Where the two had different names, the auto name survives.
- **Why:** The tap carries the screen and can be switched off from the panel in one click with no
  release; a coded call can only be stopped by shipping one. The Health Centre's `DuplicatePressCheck`
  returned **16 pairs in six hours** and the counts were unarguable — `create_inv_discard_click` 44,
  `discard_confirmed` 44, `Discard_click` 44 for one finger. Nine were this shape and were removed.

## What it cost, measured, not assumed

- **Parameters do not move by themselves.** `business_saved_click` carried `optional_fields_filled`
  and `has_logo`; `add_item_success` carried `has_description`, `has_discount`, `has_tax`. Those were
  the only things in the app separating real data from the minimum that clears validation — the G1
  question. They are now **gone**, and putting them back means parameters on the surviving event
  (`AGENTS-EVENTS.md` §1.1), never a second event.
- **The tap does not see every route.** `saved_inv_back_click` also covered the **system back
  gesture** (the `BackHandler` dispatches the same intent); from 1.4.3 that route is unrecorded.
  `DB_create_Invoice_click` covered **every** dashboard create press while its survivor
  `db_create_first_inv_click` covers only the first-invoice empty state.
- **A survivor that fires on the press counts failures as successes.** `business_form_saved` and
  `add_item_added` fire before validation: ~4% and ~10% of those rows added nothing.

## Rejected

- **Keeping the coded one** (its parameters are richer). Rejected by the owner: the identity belongs
  to the layer that can be governed from the panel. The parameters are to be re-added there.
- **Deleting both sides of a pair.** Would have emptied journey steps 5, 6 and 7.
- **Renaming the old names out of the backend queries.** Rejected: `analytics_events` keeps whatever
  was sent at the time, so every step lists the old spellings alongside the new (§1.8).
- **Treating all 16 pairs as one problem.** Four were not duplicates — a press that opens a
  permission dialog, a sheet or a share chooser is two facts. The **check** was narrowed, not the app.

## Consequences

- Counts for these actions **halve** at the 1.4.3 boundary and that is the fix landing, not
  behaviour. The doubling was present on versionCode 91, 92 and 94 alike — as old as the data.
- `add_item_click` → `add_item_added` is a **rename**, so its history splits; step 7 of
  `findFirstInvoiceJourney` lists `add_item_added`, `add_item_success` and `Item_added` together.
- Still open: `Item_added` (a third event on the item press), the client pair (`client_form_saved` /
  `client_add_success` — removing both would empty step 6), and `invoice_screen_close` +
  `Create_Invoice_Backpress_click`, which is the only named source of the `back_pressed` stop reason.

## Addendum 2026-09-26 — the owner answers the three open questions

Surfaced by the Health Centre's "One press, two events" card. In the owner's words:

1. **`Item_added`: "Nateeja-event banao."** It becomes the item's **result** event. It fires only once a line is saved
   onto a document — after the item form's save succeeded, never on the press and never on a save that failed — from
   every place a line is added: create and edit invoice, create and edit estimate (they share the item form). One save,
   one row. Parameters, booleans only, so the G1 question lost in 1.4.3 is answerable again: `has_price` (above
   zero), `quantity_changed` (not the default 1), `has_description`, `has_discount`, `has_tax`, `has_category`,
   `has_unit`, and `source` (`create_invoice|edit_invoice|create_estimate|edit_estimate`). No name, amount or text.
   The press stays `add_item_added`; press + result is allowed, the shape of `payment_added` (0174). Measured before:
   `add_item_added` beside `Item_added` 215 times in 24 h, from the create screen only.
2. **The client pair: "Dono rakho, alag cheezein hain."** `client_form_saved` = the client was saved (it carries
   `optional_fields_filled`); `client_add_success` = a client was put on the invoice, and picking an existing client
   sends only this one. No app change. The Health Centre's check lists the form's Save/Update tap + either, and
   `add_item_added` (or the older `add_item_click`) + `Item_added`, as press + result — keyed on the pair, so the
   same result beside any other tap is still reported.
3. **Leaving the invoice screen: "Aik event, sab maloomat us me."** `invoice_screen_close` stays;
   `Create_Invoice_Backpress_click` is no longer sent. Its `has_changes`, `item_count`, `has_client`, `has_business`
   and `ms_on_screen` move onto `invoice_screen_close` on all three leave routes of the create screen (the ✕ reads them
   at the tap — AGENTS-EVENTS §1.25). `has_changes` stays its own parameter because it is not `had_input`: a user
   leaving with three lines and no client is `had_input=false, has_changes=true`.

**What the old event covered, counted before deleting (§1.11.2).** It fired in the view model's back handler, which
the ✕ and the system back both reach. In the 24 h to 2026-09-27, 459 of its 463 rows paired with an
`invoice_screen_close` inside 50 ms: **297 `back_press`, 162 `close_button`**, all on `create_inv_scr`. So the
backend's `back_pressed` stop reason (`JOURNEY_AGGREGATES.backPressed`, which the journey, the comparison and
`device_journey_hour` all read) keeps reading `Create_Invoice_Backpress_click` — rows keep the name they were sent with —
and also reads `invoice_screen_close` with `method` **`back_press` or `close_button`** on `create_inv_scr`. Reading
`back_press` alone would have dropped 35 % of the signal at the release. The two are combined with `GREATEST`, so an old
build that sends both for one press counts it once.

### Rejected

- **`Item_added` fired from the item form's view model** (one place instead of four). It cannot see which document the
  line is going onto, so `source` would have been absent on every row.
- **`has_quantity` / `has_price` as "present".** The form requires a name, a price and a quantity, so presence is
  always true; above zero and not-the-default are what say something.
- **Reading only `method=back_press`** for the stop reason — see above.
- **Removing either client event.** Removing both would empty journey step 6; they are two different facts.

### Consequences

- From 1.4.9 `Item_added` counts rise: edit-invoice and estimate lines are counted for the first time. Split by
  `source`; rows up to 1.4.8 have none and are create-invoice only.
- Journey step 7 already lists `Item_added`. An estimate line now also sends it, as the Add press `add_item_added`
  already did, so the rung's meaning does not change.
- `Create_Invoice_Backpress_click` stops at 1.4.9; the "One press, two events" card keeps reporting it against old
  builds until they fade, which is correct — on those builds it is a real double.
- The daily journey-table check (0142) may correct a handful of historical devices once, where a close event arrived
  with no old twin (4 of 463 a day).

