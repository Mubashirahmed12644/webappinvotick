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
