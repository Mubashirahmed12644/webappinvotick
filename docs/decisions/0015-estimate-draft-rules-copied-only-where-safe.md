# 0015 — Estimate draft rules follow the invoice's, but only four of five

**Date:** 2026-08-05
**Status:** accepted (one part shipped, four parts deliberately not)
**Touches:** `invoice-kmp-app` — `CreateEstimateViewModel`, `CreateInvoiceViewModel`, `Estimate` model

## The question

Estimates and invoices are the same screen wearing different words, and they were asked to behave
the same way when a user backs out with work on screen. The question put was narrow and correct:
*are the invoice's save-as-draft rules safe to copy onto estimates as they stand?*

Four of them are not, and each is a different kind of not.

## What was compared

The back button, the discard dialog it raises, and the "Save as Draft" inside that dialog. The
dialog itself (`DiscardChangesDialog`) is already shared — every difference lives in the two view
models.

| | Invoice | Estimate | Copied? |
|---|---|---|---|
| A. When the dialog appears | `hasChanges && hasDocumentContent()` | any `hasChanges` | **yes** |
| B. Draft-save with no business | navigates back silently | error, stays put | no |
| C. Currency written onto the row | `currency = state.currency?.code` | field does not exist | no |
| D. Analytics on draft-save and back-press | four events | none | no |
| E. Onboarding flag on draft-save | not set | set | no |

## A — shipped

`hasDocumentContent()` is a business, a client, **and** at least one item. This is
[0011](0011-discard-dialog-only-for-documents.md) and [0014](0014-discard-dialog-needs-document-content.md)
applied to the other document type; the reasoning transfers whole. One term dropped: the invoice also
counts a typed `clientName` because it has a pending-client path, and the estimate screen has none.

## B — not copied, because the sentence it rests on is not true here

The invoice returns silently when there is no business, and its comment explains why: *the template is
already saved via auto-save*. For invoices that holds — `saveOnGoingInvoice` has a path that persists
without a business as long as a client is pending.

`saveOnGoingEstimate` has no such path. It returns early on a null business and saves nothing. Copying
the invoice's silence would mean the user taps a button, sees no error, is taken back, and their work
is gone. That is the G3 failure the rest of this project spends its time avoiding — and the current
error message, clumsy as it is, at least tells the truth.

Left open, and worth its own pass: the shared dialog relabels that button **"Save Template"** when
there is no business, so on the estimate screen a button offering to save a template answers that a
business is required. Both halves are wrong; fixing the label without fixing the storage would only
hide it.

## C — not copied, because there is nothing to copy into

`Estimate` has no `currency` field. Not unset — absent from the domain model, and so from the table.
This is the same defect as `memory/currency-not-stored-on-invoice.md` records for invoices, one repo
deeper, and it needs a Room migration rather than a line in a view model. Adding the assignment alone
would not compile, which is the only reason it was noticed at all.

## D — not copied, because the names would have to be invented

The invoice fires `Draft_click`, `Saved_clicked` and `Create_Invoice_Backpress_click`, and sets an
exit scenario. `CreateEstimateViewModel` injects neither `AnalyticsUseCases` nor `ExitTracker`, so
this is a DI change plus a set of event names that do not exist in the vocabulary yet. Copying the
invoice's names onto estimates would file estimate abandonment under an invoice event, which is worse
than no data. Proposed separately, with names, not smuggled in under "same as invoice".

## E — not copied, because it is unclear which side is wrong

Estimate's draft-save sets `setHasSeenInvoiceSpotlight(true)`; invoice's draft-save does not. So
saving an estimate draft retires the create-screen tour, and saving an invoice draft does not.
One of the two is wrong and it is not obvious which — retiring a tour after someone has produced a
document is defensible. Reported rather than changed, because a silent guess here changes what a new
user sees on their first day.

The first-run screens are not affected either way: the invoice list reads
`userAccount.hasCreatedFirstInvoice`, and the estimate list reads its own emptiness.

## Rejected

- **Copy all five and let the device find the problems.** B loses user data on a path with no
  warning, and C does not compile.
- **Fix the "Save Template" label on the estimate side only.** Makes the button honest about a
  capability that still is not there.
