# 0012 — A draft is resumed, not negotiated

**Date:** 2026-07-31
**Status:** Accepted and built (invoice + estimate), verified on device
**Affects:** `CreateInvoiceViewModel`, `CreateEstimateViewModel`, `InvoiceScreen`, `EstimateScreen`,
`DocumentDialogs.kt` · supersedes the business-only exception noted in [0011](0011-discard-dialog-only-for-documents.md)

## What was there

Reopening the app with a saved draft raised a modal: *"Continue Editing? — You have an invoice draft
in progress"*, with **Continue Editing** and **Create New Invoice**.

It was undismissable — `onDismissRequest = { }`, `dismissOnBackPress = false`,
`dismissOnClickOutside = false`. The user could not look at the screen before answering.

## Decision

**Remove it on both turns — first invoice and every one after.** A draft is restored silently.
Starting fresh stays available through Back → *Discard Everything*, which already exists and already
states its consequence.

The shared `DocumentContinueEditingDialog` is deleted; estimates were using the same component and
get the same treatment.

## Why

**It asks a question it has already answered.** The draft is auto-saved. By the time the dialog
appears the app has decided to restore — the modal asks permission to be where it already is.
Continuing is not a decision, it is the default.

**Its safe-looking option was the destructive one, and it said the opposite.** The dialog's own text
read *"Your draft will be preserved either way"* and *"Creating a new invoice will save your current
draft"*. `createNewInvoice()` calls `clearOngoingInvoice()`, which writes null over the draft. So the
one screen whose entire job was protecting the user's work promised to keep it and deleted it. That
is a G3 failure of the worst kind — not losing data by accident, but losing it immediately after
saying you would not. With **96.6% of users on guest accounts**, nothing lost here is recoverable
from a server.

**On the first invoice there is no second thing to want.** The user has never made an invoice; the
only possible intent is to continue. A blocking question there is pure friction at the exact point
the funnel already bleeds (G1). This was half-recognised already — [0011](0011-discard-dialog-only-for-documents.md)
and the code carried an exception for business-only drafts, on the reasoning that a business is a
prerequisite rather than progress. That reasoning generalises: **none** of the draft is a decision
the user needs to ratify.

**On later turns it taxes everyone to serve a minority.** Someone reopening the app is overwhelmingly
likely to be finishing what they started — that is what a draft *is*. Blocking all of them to catch
the few who wanted a different invoice is the wrong trade, especially when those few already have a
deliberate, discoverable route.

## Rejected

- **Keep it only for returning users.** The dialog is not more truthful on the second turn, and the
  argument for it there is "how else do I start fresh" — which Back → Discard answers.
- **Keep it and fix the wording.** Honest wording on a modal that should not exist. It would still
  cost every returning user a decision before they can see their own screen.
- **Keep it and make it dismissable.** Dismiss to what? Either outcome is one of the two buttons, so
  the modal is a coin toss with extra steps.
- **Recency rule — auto-resume a fresh draft, ask about a stale one.** The most defensible reason to
  ever ask: a draft from three weeks ago probably is not what the user wants, and silently loading it
  could itself read as a bug. Rejected *for now* as unnecessary complexity on top of a removal, but
  it is the right shape if resuming stale drafts turns out to confuse people. Worth revisiting with
  data rather than assumption.

## Follow-up worth doing

A non-blocking replacement for discoverability: a dismissible strip on the create screen —
*"Continuing your draft · Start fresh"* — so the escape is visible without being a toll. Not built;
it is an addition, and the removal stands on its own.

## What was found on the way

`loadInvoiceFromPreferences` (and the estimate twin) launched its own coroutine, so
`initializeInvoiceData`'s `invokeOnCompletion` cleared `isLoading` while the restore was still
running. The flag said *ready* over a screen with no business, no client and no items. That is what
made the onboarding spotlight congratulate users for last session's work (fixed in `d0b62b7f`), but
it was never only the onboarding's problem — **any** reader of that flag was being told the wrong
thing. Both are suspending and genuinely awaited now.

## Verified on device

| Case | Result |
|---|---|
| Business only, reopen | no dialog, lands on **Add Client** |
| Business + client, reopen | no dialog, lands on **Add Items**, draft intact |
| Back from a restored draft | *Leave Invoice Creation?* → Discard Everything / Save as Draft / Keep Editing |
