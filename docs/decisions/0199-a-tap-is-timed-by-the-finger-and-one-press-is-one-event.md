# 0199 — A tap is timed by the finger, and one press is one event

- **Date:** 2026-09-30
- **Status:** built, **not merged**. App: branch `fix/tap-gate-uses-touch-time` off `origin/release/1.5.1`
  (`55efcd98c`). Docs: this branch. No schema change, no backend change in this decision (the backend follow-ups are
  listed below and are not built).
- **Follows:** [0024](0024-a-double-tap-is-stopped-at-the-button-not-counted-later.md) (the gate),
  [0037](0037-the-ui-layer-owns-the-press.md) (the UI layer owns the press), AGENTS-EVENTS §1.9a and §1.11.
- **Evidence:** the Pixel run of 2026-09-30 (`kaam/research/pixel-checks-2026-09-30/events-filtered.txt`), and
  `analytics_events`, release builds, the 30 days to 2026-09-30 12:00 UTC, our own phones and accounts excluded
  (memory `internal-test-accounts-and-devices`).

## 1. The gate compares when the finger lifted

**What the Pixel showed.** Two taps 100–150 ms apart on "Receive Payment" (the saved invoice's More menu) sent
`more_receive_payment_click` twice, 493–536 ms apart, 3 times in 3 tries. The dashboard's Create Invoice button sent
`db_create_invoice_fab_click` twice, 807 ms apart, the second under the screen the first had opened
(`create_inv_scr`). The sheet and the screen opened once; the count doubled.

**Why.** The first tap's work took the main thread for about 530 ms (`Choreographer: Skipped 64 frames`; 34 + 77 on
the dashboard). The second tap waited behind it. `TapGate` stamped a tap when its click was *handled*, so the second
tap looked 530 ms old and passed the 400 ms window. On a button whose first press is that slow, the **action** could
run twice, not only the event.

**Decided.**
- `TapGate.accept` takes the pointer event's own time (`PointerInputChange.uptimeMillis`, the platform's stamp, set
  when the finger lifted). Two taps that both have one are compared on it.
- The clock stays the fallback, and only for a tap with no finger behind it (TalkBack, a keyboard), or when the
  previous accepted tap had none. The two are different clocks; only like is compared with like.
- The time is read by a non-consuming `pointerInput` on the control: written on the event's Initial pass, cleared on
  its Final pass. A click inside a pointer event reads that event's time; one outside any reads nothing.
- `guardedTrackedClick` / `trackedOnClick` return a `GuardedClick` (`onClick` + `touchTime`), not a lambda, so a call
  site that hands on only the lambda does not compile. The 400 ms window itself is unchanged.
- The action and the event are gated together, as before (0024): a suppressed tap runs nothing and records nothing.

**Verified.** `ABusyFirstTapDoesNotLetTheSecondThroughTest` (Compose, desktop runtime): the first press sleeps 600 ms,
the second touch is 120 ms after it. A tracked clickable, a tracked button, the dashboard FAB and a menu row (its own
popup window) each act once and record once. Red without the fix, 4 of 6 (`expected 1 but was 2`); green with it.

## 2. Every press passes the gate

The sweep found **118 controls** whose click never reached the gate: no double-tap guard and no tap. The largest group
is the list screens' rows, where a raw `toggleable` chained after the tracked clickable took every tap:
`list_ClientListScreen.client_item_4` has **0 rows ever**, so picking a client or an item from the list was unguarded
and unrecorded. Also every Material menu row in the list screens and the drawer, the multi-select checkboxes, the
invoice, estimate and ledger cards, filter chips, the bottom bar, four FABs, received-invoice Approve / Decline, the
landing "Get started" and the onboarding Continue buttons.

They go through the gate now, each under a fixed `<File>.<what>` id (never a translated label). **These are new
auto-captured names** from this build (send-unless-denied, AGENTS-EVENTS §1.5a). `EveryPressPassesTheGateTest` fails
on any new control written the old way: red on the code before the sweep (118 findings), green after.

## 3. One press, one event

The rule is §1.11: the button's own tap owns the press, and a coded `trackClick` from the same handler goes. The
survivor is **the name with the history**, and the coded call's parameters move onto it.

| Press | Kept, from the button | Rows (30 d) | Stops | Rows (30 d) |
|:--|:--|--:|:--|--:|
| Invoice Save | `create_inv_saved_click` | 7,167 | `invoice_action_bar_secondary` | 602 |
| Estimate Save | `create_est_saved_click` | 151 | `esitmated_save_click` | 151 |
| Discard dialog ✕ | `discard_dialog_closed` + `source` | 746 | `…DiscardChangesDialog.close_1` | 747 |
| Discard dialog Discard | `discard_confirmed` + `source` | 832 | `create_inv_discard_click` | 831 |
| Discard dialog Keep editing | `discard_cancelled` + `source` | 214 | `…keep_editing_4` | 214 |
| Invoice Save as draft | `Draft_click` + `source` | 496 | `…discard_changes_dialog_2`, `Saved_clicked` | 493, 496 |
| Ad gate Watch ad | `watch_ad_click` + its parameters | 3,679 | `AdOrPremiumDialog.loading_ad_2` | 967 |
| Ad gate Premium | `ad_dailog_premium_click` (sic) + `document` | 518 | `AdOrPremiumDialog.go_premium_3` | 517 |
| Guest-merge strip ✕ | `guest_merge_notice_dismissed` | 71 | `GuestMergeNoticeStrip.dismiss_1` | 71 |
| Estimate Convert to invoice | `estimate_converted_to_invoice` | 14 | `dropdown Convert to Invoice` | 14 |
| Paywall cards | `p_no_ads_click`, `p_clean_pdf_click`, `p_own_footer_click` | 41, 27, 2 | `…hero_feature_card_4/_clean_pdf_5/_own_footer_6` | 20, 27, 2 |
| Business form details toggle | `business_form.toggle_details` | 173 | `BusinessFormScreen.business_form_content_1` | 173 |
| Business form category field | `business_form.select_category` | 207 | `TextFiedl.invotick_clickable_text_field_2` (that field only) | — |

**Three presses keep their outcome event, and their button goes silent** (guarded, not recorded), because the outcome
is reached by routes the button cannot see (§1.11 caveat 2) and already says which route:

| Press | The one row | Why not the tap |
|:--|:--|:--|
| Ad gate ✕ | `ad_dialog_dismissed`, `method=close_button` (+ `outcome` on the create/edit screen) | back/outside send it too; `outcome` is known only after the draft write. `dismiss_1` 2,064 = `close_button` 2,061 |
| Exit dialog Stay | `app_exit_cancelled`, **new `method`** | back, outside and Sign in send it too (4,050 against 1,101 Stay taps) |
| Exit dialog Exit | `app_exit_confirmed`, **new `method`** | the auto-exit after feedback sends it too; it is also the one event flushed before the process ends |

`method` values: `exit_button`, `after_feedback`, `stay_button`, `back_or_outside`, `sign_in`. Absent on rows before
this build.

**Left as they are, deliberately:**
- **The client pair and the item pair** — the owner's decision in 0037's addendum ("Dono rakho", "Nateeja-event
  banao"): press + result, not twins.
- **A press and what it opened** — `saved_inv_send_invoice` + `share_bottom_sheet_open`, the estimate's send +
  `estimate_share_sheet_opened`, any press + a permission prompt. Two facts (the Health Centre's `isByDesign`).
- **`invoice_created_success` + `create_inv_completed_scr`** (2,880 / 2,879, 1 ms apart). One outcome, two coded names,
  not a press. **Open question for the owner**: `create_inv_completed_scr` is read by nothing in the backend or the
  panel; remove it?
- **The discard press on the invoice screen still sends `invoice_screen_close` with `method=discard_confirmed`** beside
  `discard_confirmed`: the owner's rule for that screen (0037 addendum 3, "Aik event, sab maloomat us me") is one event
  for leaving it. **Open question**: should that `method` go, now that `discard_confirmed` carries the press?

**Verified.** `OnePressArrivesUnderOneNameTest` (source floor): no name on both channels, the coded twins gone, each
survivor on its button, the retired ids unsent, the exit outcomes carry `method`. Red with the production files put back
to `release/1.5.1` (4 of 5), green now. The phone-level proof is the Health Centre's "One press, two events" card on the
build that ships this.

## Backend and panel follow-ups (not built)

- **`ScreenMapBuilder`**: `gatePremium` reads `tap:create_inv_scr:AdOrPremiumDialog.go_premium_3` → also
  `ad_dailog_premium_click`; `gateDismiss` reads `…AdOrPremiumDialog.dismiss_1` → also `ad_dialog_dismissed` with
  `method=close_button`; `screenOf` maps the dialog's names to `ad_dialog_shown` → add `ad_dailog_premium_click`.
  `CODED_TAPS` still matches (`create_inv_saved_click`, `watch_ad_click` now arrive with `auto=true`, which `isTap`
  already accepts).
- **No journey query changes.** `saveClicked`, `watchAdClicked`, `discarded`, `draftClicked`, `exitConfirmed`,
  `adDialogDismissed` all read the surviving names. Old rows keep their names (§1.8).
- **Panel `navmap.data.ts`** is generated per release: regenerate for 1.5.1 (the dialog, paywall and business-form
  control keys changed).
- **Denylist**: `invoice_action_bar_secondary` and the `AdOrPremiumDialog.*` rows become dead. `create_inv_saved_click`,
  `watch_ad_click` and `ad_dailog_premium_click` are now switchable from the panel; **never deny them** — they are the
  funnel's Save and the ad trade's two choices.

## Rejected

- **Counting around the doubles in the backend.** 0024: the duplicate action stays, and on a slow Save that is two
  documents.
- **A longer window (e.g. 800 ms).** It would also eat deliberate second taps on a phone that is not busy, and it would
  still fail on a first frame longer than the window. The finger's time is exact at any delay.
- **Timing from the first frame after the press** (reject any tap that arrives before the user could see the first one
  act). Closer to the intent of the rule, but asynchronous and not what the owner asked for; the input time is the
  platform's own fact.
- **A root-level touch observer** instead of one per control. Dialogs, menus and sheets are windows of their own, and
  a root observer never sees their events; the proven "Receive Payment" row is in one.
- **Keeping the coded twin where it is the older name** (0037's rejected option). The name survives; it moves to the
  button.

## Consequences

- Counts for the eighteen presses **halve** on 1.5.1 and later. That is the fix landing, not behaviour; split by
  `app_version_code` across the boundary.
- `create_inv_saved_click` and `watch_ad_click` now carry the screen the button was on, not the gateway's lagging one.
- New tap names arrive from list rows, menus, cards and the bottom bar.
