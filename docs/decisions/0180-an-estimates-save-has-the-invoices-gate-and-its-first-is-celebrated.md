# 0180 — An estimate's Save has the invoice's gate, and its first is celebrated

**Date:** 2026-09-28 · **Owner's request, same day** · **App:** `invoice-kmp-app`
`feat/estimate-save-gate-and-celebration`, off `VC_113_VN_149` (`572004ac`); not merged, not released.

## What the owner asked
When an estimate is created and saved, it gets the two things an invoice gets: the Save gate (the "Watch a short ad
or go Premium" dialog) and the congratulation screen (the green tick). The estimate had neither.

## Decision
- **The same components, not new ones.** `AdOrPremiumDialog` and the celebration overlay (now
  `FirstDocumentCelebrationOverlay`) are reused. Only the noun changes: "Send your Estimate", "You created your first
  estimate."
- **The gate is where the invoice's is:** at the Save press, before the save, in create and edit mode. Premium never
  sees it. The ad behind it is the invoice's interstitial (same unit, same config, same premium, consent and Play
  checks).
- **Its own kill switch:** Remote Config `estimate_save_gate_enabled`, a String read as text. Absent, blank or
  unreadable reads **on**; only `false`/`0`/`off`/`no` turn it off. The invoice's `saved_invoice_inter_enbale` is
  untouched, so either gate can be switched off alone.
- **A dismissal keeps the work, as on the invoice** (0032). Create mode: a DRAFT row is written and the screen stays.
  Edit mode: nothing is written; the edits stay on screen. Either way the screen says so, and `ad_dialog_dismissed`
  is sent once, by the view model, with `outcome`. Every later write of that estimate (a second dismissal, "Save
  draft", the final Save) **updates** the kept row (`EstimateGateDraftKeeper`). It never inserts it again, because
  `insertEstimate` is REPLACE and replacing an estimate cascades the delete to its lines. "Discard" deletes the kept
  row. After a process death the restored screen takes the row back.
- **The celebration is said once**, for the first finished estimate on the phone (0149's rule, from the phone's own
  rows: `EstimateDao.hasFinishedEstimate`, a query, no schema change). After it, the flow goes where the invoice's
  goes, to the estimate's own saved screen.
- **Events: no new name.** `document` = `invoice|estimate` on the dialog's four events; `placement=estimate_save` on
  the estimate's interstitial; `entry=estimate_save_ad_dialog` on the paywall; `estimated_success.is_first_estimate`.
  The detail is in `AGENTS.md` §5b.

## Rejected
- **A second dialog or an `estimate_*` event family.** One action on another document is the same action (§1.1,
  §1.17). A twin would split every gate count in two.
- **Reading the switch with `getBoolean`.** Firebase answers `false` for a missing key, which would have turned the
  gate off on every phone until the key was created.
- **Sharing the invoice's switch.** The owner could not then measure or stop one gate without the other.
- **Celebrating every estimate.** 0149 was written because the invoice did exactly that.

## Known limits
- An estimate has no account-level "first" flag the way invoices have `user_state.hasCreatedFirstInvoice`. A new
  phone whose old estimates have not come down yet celebrates once more.
- An interstitial loaded earlier (a load that finished after its own timeout) is shown from the cache with the
  placement it was loaded under. `ad_request_id` still joins the chain.
- Like the invoice, the gate comes before validation: an incomplete estimate meets the dialog first, then the missing
  field.
