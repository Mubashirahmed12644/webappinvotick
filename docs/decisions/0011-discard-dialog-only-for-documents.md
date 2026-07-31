# 0011 — A discard dialog belongs to documents, not to small forms

**Date:** 2026-07-28
**Status:** Accepted, not yet built
**Affects:** business, client, item, merchant sheets · invoice + estimate screens · `feature/*`

## What is there today

Closing any form with unsaved text raises the same dialog: *"Discard Changes? … This Action Cannot
Be Undone. All your unsaved changes will be permanently lost."* It appears on a two-field business
sheet and on a fully built invoice alike.

It is implemented **six times**. `CreateBusinessScreen.kt`, `CreateClientScreen.kt`,
`CreateMerchantScreen.kt`, and three separate files each called `DiscardChangesDialog.kt` under
`feature/document/invoice`, `feature/customer` and `feature/company`. They look identical on screen
and are not identical in code: the invoice one offers **Save Draft**, the others do not.

That difference is the whole decision.

## Decision

**Small entity forms — business, client, item, merchant — lose the dialog entirely.**

- The cross closes the sheet, no question asked.
- What was typed **stays in the sheet's own state**, so reopening it within the same invoice restores
  the draft.
- **Nothing is written to the database** until Save is pressed.

**Invoice and Estimate keep the dialog.** They hold real accumulated work — business, client, items,
totals — and they have a genuine third option in Save Draft. A question is fair where there are three
real answers.

## Why

**A confirmation is for an action that is destructive and irreversible.** Losing two typed fields is
neither, once the draft is retained. Telling somebody their work will be "permanently lost" on a
two-field sheet makes the app feel more dangerous than it is, and the modern default — Gmail, Notion,
Linear, and Material's own guidance — is to keep the draft or offer Undo rather than to interrupt.

**It works directly against G1.** The business form is where the funnel already loses about 55%. The
create-invoice screen is a three-step wizard whose first step is Add Business; anything that adds a
scary interruption there is friction placed exactly where activation is decided.

**Draft-retention is not the same as saving the entity, and the difference matters for G3.** The
tempting shortcut — "just keep the data" — read as "commit it" would put a half-typed business into
the user's business list, and from there onto an invoice. A record the user never chose to create is
its own trust failure, in the opposite direction from losing one. So the draft lives in the sheet's
state, and only Save creates a row.

**96.6% of users are guests**, so nothing lost is recoverable from a server. That argues for keeping
the draft — and against pretending a dismissal is dangerous when we could simply not lose it.

## What this replaces

An earlier plan (started, then stashed) was to merge all six dialogs into one shared component with an
optional `onSaveDraft`. That was wrong, and the attempt showed why: the first working version silently
removed Save Draft from the invoice dialog, because it had been built from a copy that never had one.

The six are not one component used six ways. They are **two different interactions** that grew to look
alike. Forcing them together loses the thing that actually distinguishes them.

## Rejected

- **Keep the dialog and personalise its copy** (*"Discard this business?"*). Better wording on an
  interruption that should not exist. It also still costs a decision on a two-field form.
- **Dismiss and discard silently.** Simplest, and the one real trust risk here: a guest loses typing
  with nothing to recover it from.
- **Discard with an Undo snackbar.** Material's preferred shape, and awkward from a bottom sheet whose
  parent is a wizard step — the undo target disappears as the flow moves on.
- **Merge all six into one dialog.** Above.

## What it changes for measurement

`discard_dialog_shown` and its outcomes stop being meaningful for the four small forms, since the
dialog will not exist there. The question worth asking becomes the mirror of `*_form_saved`:

```
entity_sheet_dismissed   target · had_content · fields_filled · ms_on_form
```

— how many people open the business sheet, type something, and leave without creating anything. That
is the ~55% drop stated as a number rather than inferred from an absence.

Add `reopened_with_draft` alongside it. **Whether draft-retention confuses people is not known and
should not be assumed**: someone reopening a sheet and finding old text may be relieved or may be
puzzled. Two events answer it in a few days.

## Order of work

1. `entity_sheet_dismissed` on all four sheets, dialog untouched — establishes the baseline first.
2. Draft-retention in the sheets' state.
3. Remove the dialog from the four; delete the now-unused copies.
4. Fold the remaining invoice/estimate implementations into one, keeping Save Draft.
5. Device pass per form, at 1.0 and 1.5 font scale.

Steps 1 and 2 are independent and reversible. Step 3 is the user-visible change and should not ship
before step 1 has produced numbers to compare against.
