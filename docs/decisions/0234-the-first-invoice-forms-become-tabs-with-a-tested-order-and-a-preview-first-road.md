# 0234 — The first-invoice forms become tabs with a tested order, and a preview-first road after Create invoice

**Date:** 2026-10-22 · **Owner:** the owner, on the mockup `kaam/research/first-forms-mockup.html` ("hamara decided flow ... isko apply kerky emulator per install kero, main khud test keronga") · **Registry id:** 160 · **App branch:** `feat/160-first-invoice-forms` (base `release/1.5.5`)
**Tier:** 1/2 for the new write road (business, client, item written by one press; no rule changed), 3 for the config switches. No ad, paywall, sign-up or Save gate is touched.

## Why (production counts, new Android phones, first 24 h; mockup "Jahan log rukte hain")

Opened 100 % · past splash 82 % · invoice screen 81 % · business form started 65 % · business saved 54 % · client saved 46 % · line item added 41 % · invoice created 18 % · confirmed share 8 % (Algeria 3.7 %, elsewhere about 10 %). About 2,400 new phones a week, flat for 7 weeks. The form steps (81 -> 41) lose 40 points; item added -> invoice created loses 23, the part around Save (0233 tests the Save gate separately).

## Decided

1. **Tabs instead of three sheets (forms switch).** On a new phone's first create screen, one screen with three tabs, one thing per tab: item (name and price, with the currency the invoice will really carry shown as symbol and code, quantity 1), business (name), client (name). "Later" with three dashed marks for what stays optional. "Next" until every other tab is filled, then "Create invoice". The order of asking comes from the arm; the order of writing never changes: business, client under it, then the item (saved to the catalogue, as the item sheet does) whose line goes on the draft. Then today's create screen, with all three on it. The four required fields are the four today's forms require; nothing is prefilled; no field is removed or added.
2. **Arms:** `control` (today's sheets), `order_a` = item, business, client; `order_b` = business, item, client; `order_c` = business, client, item. Tested one order at a time against control, in the order A, then C, then B (the mockup's simultaneous 20/15/15 split is replaced by this sequence; see Rejected).
3. **Preview-first road (post switch, independent of the forms switch).** `today` | `preview_first`. On `preview_first`, the first time the invoice on a new phone's first create screen becomes complete (after "Create invoice" on the tabs, or after the third sheet in control), the whole invoice's preview sheet opens by itself with three controls: **Save** (the one filled button, where the form's Save is), **Add item** (tonal, where Preview is), **Edit** (closes onto today's form). Nothing is written until Save; Save runs the create screen's own Save press, so the Save gate (ad-or-premium dialog, or its 0233 move) is exactly the form's. Add item closes the sheet, opens today's product list/form, and the preview comes back with the new line and total. A dismissed dialog's "Saved as a draft..." line and a failed write's error line show inside the sheet. The sheet closes before the first-invoice Congratulations. Saved screen, signature/stamp, share and dashboard are unchanged (frames J5-J8).
4. **Who:** a phone with no invoice ever saved (0233's `PhoneInvoiceHistory`) and, for the tabs, no business. Dealt once per phone, stored phone-wide (`first_forms_arm`, `first_invoice_post_arm`), never re-dealt; a phone that is not new is sealed out with no row. The tabs show only on a fresh create screen (no draft, no copy, no estimate conversion).
5. **Switches (Remote Config, all text; the code defaults change nothing):**
   - `first_forms_order` = `control` | `A` | `B` | `C`. **Code default `control`:** nobody is dealt, nothing is written or said.
   - `first_forms_flow_percent` = share of new phones that get the named order (code default 50; read only when an order is named).
   - `first_invoice_post_arm` = `today` | `preview_first`. **Code default `today`.**
   - `first_invoice_post_percent` = share that gets `preview_first` (code default 50).
   - FNV-1a bucket of the device id, salts `first_forms_v1` and `first_invoice_post_v1` (not 0233's, not the tour's).
   - **Kill switch:** setting `first_forms_order` back to `control` (or `first_invoice_post_arm` to `today`) returns every dealt phone that has not finished its first invoice to today's screen; the stored arm stays.
6. **Debug only:** a debug build can force either switch with a launch extra (`first_forms_order`, `first_invoice_post_arm`; `clear` removes it). Read only behind the build's own `FLAG_DEBUGGABLE`; never stored as an arm, never stamped, never in an assignment row.

## Events (AGENTS-EVENTS: one action one event, parameters on it, absent = unknown)

- `first_forms_assigned` (coded, once per phone): `arm` (`control|order_a|order_b|order_c`), `order` (`item,business,client`… or `sheets`), `order_ok`, `bucket`, `bucket_source`, `flow_percent`, `percent_source`.
- `first_invoice_post_assigned` (coded, once per phone): `arm` (`today|preview_first`), `arm_ok`, `bucket`, `bucket_source`, `post_percent`, `percent_source`.
- `screen_view` per tab shown: `first_forms_tab_item` | `first_forms_tab_business` | `first_forms_tab_client`, with `order` and `step` (1-3).
- `first_forms_close` (one close id, X and back): `method` (`close_button|back_press`), `had_input`, `tab`, `order`, `fields_filled` (0-4).
- `first_forms_completed` (coded, once per successful Create invoice): `arm`, `order`, `ms_in_forms` (absent when the first tab's showing was not seen), `revisits`.
- Taps: `first_forms_button`, `first_forms_strip_<tab>`, `first_forms_chip_<tab>`.
  - **`first_forms_button`** says what the press did (addendum below): `tab`, `button` (`next|create`, the word shown), `method` (`button|keyboard`), `outcome` (`refused|next_tab|create`) and, **only on `refused`**, `field` (`name|price`, the field whose "Add a name" / "Add a price" line appeared). `create` is the writes starting; their end is `first_forms_completed`, or `error_shown` when one failed.
- `screen_view` `first_invoice_preview` per opening of the preview-first sheet: `trigger` (`auto|after_add_item|manual`), `ms_since_complete` (only on `auto`: from the Create invoice press, or from the moment the invoice became complete in control).
- Taps `preview_sheet_save`, `preview_sheet_add_item`, `preview_sheet_edit`. The funnel counts `create_inv_saved_click` and `preview_sheet_save` as one "Save pressed" step.
- **`first_invoice_preview_close`** (auto channel, the sheet's one close row, decision 0023's shape): the preview-first sheet left with no button. `method` = `swipe` (the sheet dragged down by a finger, or the invoice pulled down past its top) | `scrim_or_back` (a tap outside, or back; Material gives both to one callback, as on every sheet). `trigger` (this opening's: `auto|after_add_item|manual`), `shown_ms` (time up, steps of 100 ms). Edit is **not** this row: it is a choice on the road, like Add item and Save, and keeps its own tap. "Left the sheet without saving" = `preview_sheet_edit` + this row + `preview_sheet_add_item` (each a different act). Today's own preview sheet (no controls) is unchanged and sends no close row.
- `forms_arm` and `post_arm` stamped by the gateway on every event of a phone that has an arm (so on `invoice_created_success`, `invoice_shared_success` and every `screen_view`), the shape of `overlay_variant`. Absent = no arm; never read as control/today.
- Existing result events still fire on the tabs road: `client_add_success` and `Item_added` (source `create_invoice`). `business_form_saved` / `client_form_saved` do not (no sheet is opened): read the in-arm steps from the tab screens and `first_forms_completed`.
- **Typing on the tabs: the sheets' own proxies, not a new event** (addendum below). The first non-blank keystroke in a field, **once per field per visit of its tab**: business name -> `business_form_text_typed`, client name -> `client_form_text_add`, item name **and** price -> `item_form_text_add`. Coded, as on the sheets. Parameters on the tabs road only: `entry=first_forms_tab`, `field` (`name|price`), `order`, `step`. A field that already held text when the visit began (a kept draft, a tab come back to) is not counted again: the sheets' rule.
- **A failed write at Create invoice** is `error_shown` (`action=save`, `subject` = `business|client|item`, the gateway's `screen` = the tab it opened), sent by `ShownError.save` for the line drawn under the field. Nothing new was needed.
- **A tap no control took on a tab** (the "Later" marks, the headline, the "x 1") is `dead_tap` with `screen` = the tab (`first_forms_tab_*`) and `scroll_bucket` from the tab's own scroll. The marks open nothing (decided: "Later" is a hint, not a button).

### Addendum 2026-10-22 (owner: "tmam points per event lagany hain, user ki har harkat note kerni hy")

The parent's four emulator runs found seven silent places on the road. Each is now a row, and only one (AGENTS-EVENTS §1.1, §1.11):

| Action | Before | After |
|:--|:--|:--|
| First keystroke in item name, price, business name, client name | nothing | `item_form_text_add` / `business_form_text_typed` / `client_form_text_add`, `entry=first_forms_tab`, `field`, `order`, `step` |
| Next / Create invoice refused (empty name, no price) | `first_forms_button` {tab, button}: refusal invisible | same row + `outcome=refused`, `field=name|price` |
| Keyboard Done on the last field (presses Next / Create) | **nothing** (the button's tap cannot see it) | `first_forms_button` with `method=keyboard`, same parameters |
| System back on a tab | `first_forms_close` `method=back_press` (wired, not run on the emulator) | unchanged; held by a guard (the tabs' handler is composed after the invoice screen's, so back is never also `invoice_screen_close`) |
| Preview sheet swiped down / tapped outside / back / invoice pulled down | nothing | `first_invoice_preview_close` `method=swipe|scrim_or_back`, `trigger`, `shown_ms` |
| Tap on a "Later" mark or any non-control on a tab | `dead_tap` filed under `create_invoice_screen` (the screen under the tabs) | `dead_tap` under `first_forms_tab_*`, with the tab's scroll |
| Write fails at Create invoice | `error_shown` already | unchanged (checked) |

**Why the proxies' names, not one new `first_forms_text_typed`** (the alternative): "started typing the business name" is one fact whether a sheet or a tab asked for it; a second name would split every funnel that reads "business form started" across two spellings (§1.1, §1.15, and 1.37: "a second name for one fact would split every query that reads both paths"). The road is a parameter, `entry`, the client form's existing door parameter (0161). The cost, written down: on the tabs road `item_form_text_add` can arrive twice per form (name and price). Compare with the sheet on `field=name` (or `field` absent); count devices, not rows, across roads.

**Why `outcome` on `first_forms_button` and not `ci_save_validation_failed`'s own event**: the refusal is what the press did, known from the same rule and the same input the press reads (`FirstFormsTabs.press`), so it is a parameter on the press (§1.1). A coded refusal event beside the tap would be one press, two rows (§1.11).

**Assignments**: `first_forms_assigned` and `first_invoice_post_assigned` are sent once per phone on a real deal (five opens, one row each: `TheFirstFormsSwitchesAreDealtOnceTest`) and never under a debug force; `forms_arm` / `post_arm` ride on every coded event, every auto tap and every screen view (`TheFirstFormsArmsRideOnEveryEventTest`, iosTest, the gateway is common code).

**Guards**: `EveryActionOnTheFirstInvoiceRoadLeavesOneRowTest` (every control has its own id, every Done reports, every keystroke passes the one place that says it, the preview's gesture closes report, Edit is never also the close row, no coded twin of a tap), `TheTabsSayEveryKeystrokeAndEveryPressTest`, `ThePreviewSheetSaysHowItWasLeftTest`, `DeadTapTest` (a layer over the shell names itself and gives the shell back).

**Not covered, on purpose**: a back press or Done during "Creating..." (well under a second) does nothing and says nothing, as the disabled button; a strip or chip tap during it is still its tap. A share chooser or the Save gate's dialog keep their own events.

## How the panel reads it (Nateeja kaise padha jaye)

- **The ONE number (G1):** new phones with a confirmed share (not a reminder) or a payment within 24 h of first open, per `first_forms_assigned` arm (each order against control); invoice created in 24 h beside it, 7-day read as the reading date. Same for `first_invoice_post_assigned` (`preview_first` vs `today`), read cross-tab with the forms arms and with 0233's `gate_arm`.
- **Denominator:** phones dealt an arm within 24 h of first open, release builds, our own phones removed.
- **Declared expectation:** confirmed share or invoice created 18 % -> 22 % (+4 pp) per variant against control. Power: about 1,600 phones per arm (95 % / 80 %), about 2,100 when three comparisons are read together. At 2,400 new phones a week and 50 % in the order: about 1.3 weeks per arm for one order at a time; the post switch the same.
- **In-arm steps only:** tab-by-tab drop is read inside its own arm; across arms only the end results are compared. Orders are compared with each other only once two or more beat control. Arms are compared within the same first-open week.
- **Guardrails (a breach names the switch):** G1 confirmed share must not fall (-2 pp); ad money per new phone over 7 days and fill (per format, `ad_impression_value`), save-gate dialogs shown and their choices (0233's `position`); paywall views and buyers via the dialog's premium door (never red under 10 buyers); uninstall proxy (no return d2-7, -2 pp); time from first open to invoice created (median, +20 %); time from Create invoice to the preview on screen (`ms_since_complete`, p50 under 1.5 s); `error_shown` per 1,000 phones (+50 %); crash/ANR (Play).
- **Limits written down:** the banner on the create screen is not composed while the tabs cover it (an opaque screen over a banner); compare `invoice_screen` banner impressions per new phone in both arms. Events after the tabs carry the last tab as their `screen` until the next screen view (rule 1.42: the screen underneath is not announced again).

## Rejected

- A sign-up ask, sign-in prompt, or any question or new dialog anywhere in the invoice-making path (forms, invoice screen, near Save). The "why did you stop?" one-tap question stays an idea for its own decision, outside this path.
- Removing, delaying or moving any ad, the paywall or the Save gate to lift the funnel (the gate's own test is 0233).
- "Client later" (an invoice without a client): changes `validateFields`, a Tier 1 document rule, and such an invoice cannot be shared.
- Sample or placeholder values in any field.
- Asking for the currency on the item tab (rejected in 0007): it is shown, never asked.
- Running A, B and C at once at 20/15/15 (the mockup's first plan): replaced by one order at a time against control, A then C then B, as decided with the owner; B is the first to drop if traffic is thin.
- Opening the item form directly from Add item on the preview (mockup question 1): today's product list stays, so only the preview is the difference.
- Fixing the design screen's back arrow that skips the Saved screen (mockup question 2): a separate small fix, not in this test.
