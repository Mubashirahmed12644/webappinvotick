# 0014 — A business and a client are not work worth a dialog

**Date:** 2026-08-04
**Status:** Accepted and built (invoice create), compiles and installs; not yet driven on a device
**Affects:** `CreateInvoiceViewModel.onBackClicked` / `hasDocumentContent`
· extends [0011](0011-discard-dialog-only-for-documents.md), relies on [0012](0012-no-continue-editing-dialog-on-entry.md)

## What was there

Backing out of invoice creation raised *Leave Invoice Creation?* — Discard Everything / Save as Draft
/ Keep Editing — whenever `hasChangesFromInitial()` was true. Selecting a business made that true.
So a user who picked a business, picked a client, and then pressed back got a three-option modal.

## Decision

**The dialog needs document content: at least one item, a payment, a discount, a tax, or a shipping
cost.** A business and a client alone leave silently.

## Why

**Neither is created here.** Both are existing records being *selected*. Backing out destroys
nothing — the business and the client stay in their own tables, reachable from everywhere else. The
only thing at stake is which two were picked.

**And that is already preserved.** [0012](0012-no-continue-editing-dialog-on-entry.md) made the draft
restore silently on re-entry, so the selection comes back on its own. The dialog was asking
permission to protect something already protected.

**At the worst possible point.** This is the create-invoice funnel, whose measured leaks are exactly
here. A modal costs every user a decision to protect a two-tap selection that cannot be lost.

**An item is the line.** Before it the user has said who this is from and to — a starting position.
After it there are amounts, and amounts are what people mind losing.

This is [0011](0011-discard-dialog-only-for-documents.md)'s rule — *a discard dialog belongs to
documents, not to two-field forms* — applied one step further out. That decision drew the line
around forms; this draws it around a document with nothing in it yet.

## The cost, stated

The dialog is also the only place **Discard Everything** lives. Someone who leaves with a business
and client selected will find them filled in next time, with no offer to clear them.

Accepted, because for most users that is the better default rather than a loss: the same business,
usually the same client, and changing either is one tap. If it turns out people routinely want a
different client than last time, the answer is a *clear* affordance on the field — not a modal on
the way out.

## Rejected

- **Keep the dialog, drop "Discard Everything".** Two options instead of three is still a stop, and
  the remaining ones are "leave" and "don't leave", which the back button already expresses.
- **Show it only for returning users.** The selection is no more valuable the second time.
- **Count a client but not a business.** Neither is created here; the distinction has no basis.
- **Count any edited field at all, including the invoice number.** The number is generated, not
  authored — treating a default the user never touched as work would put the modal back for
  practically everyone.

## Not yet verified on a device

Compiles and installs. Two cases to walk: business + client then back (must leave silently, and the
selection must still be there on re-entry), and one item then back (dialog must appear).
