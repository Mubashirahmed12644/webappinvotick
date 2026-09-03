# 0032 — Dismissing the Save gate keeps the invoice as a draft

**Date:** 2026-09-04 · **Status:** decided, being implemented on `VC_93_VN_142`

## Context
Every non-premium Save opens `AdOrPremiumDialog` (RC `saved_invoice_inter_enable`). Its `onDismiss`
only hid the dialog; the save intent never fired. Over 30 days on 1.4.2, 52 of 197 saves were lost;
29 of them were exactly this dismissal, and of 43 users who lost a save only 6 ever created an invoice
later. A finished invoice, one tap from done, was thrown away by the X — a trust (G3) defect.

## Decision
- **The gate stays exactly where it is** — same dialog, same choices, same RC flag. Creating the invoice
  still goes through it.
- **Dismissing it saves the document as a draft** through the existing draft path, idempotently, and
  says so ("Draft mein mehfooz — Save dobara dabayein"). Edit mode keeps the edited state likewise.
- The existing `ad_dialog_dismissed` event gains `outcome` (`draft_saved` | `draft_failed`); no new event.

## Rejected
- Create the invoice on dismiss — removes the gate; a monetisation change the owner did not make.
- Leave it and add a warning dialog — a second dialog on top of the first, and the work still lost on
  back/scrim.

## Consequences
Drafts will rise; the Draft list must stay easy to find. Measure: lost saves after release, and how
many draft-saved documents are completed later.
