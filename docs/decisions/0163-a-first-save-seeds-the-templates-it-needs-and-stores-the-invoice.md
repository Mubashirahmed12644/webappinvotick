# 0163 — A first Save seeds the templates it needs, and stores the invoice

**Date:** 2026-10-10 · **Status:** built and tested on `fix/151-save-heals-missing-default-template` (commit `38c9b4942`), **not released** — 1.5.1 only on the owner's word

## Context
The owner saw it on his own Pixel: Save → "Watch a Short Ad" → close the ad → the form stays, nothing is stored.
Reproduced on that phone with logcat (release 1.5.0, 2026-10-10 01:00–01:12 PKT): the ad shows and closes, `completeOnce`
→ `onComplete` → the create runs, and the insert fails with `SQLiteConstraintException: FOREIGN KEY constraint failed`
(`error_shown action=save subject=invoice exception_class=SQLException`). The business and client ids on the invoice
matched the server's rows, so the missing parent was the template.

Cause: every invoice and estimate names the default template (`…0001-000000000001`), a row each account's file seeds.
Seeding starts from the splash (only when an owner session exists at that moment) and from a change of account, and
`VersionedDataInitializer` treats the file as seeded when the **unit types** exist — the templates are the last thing
written. A file with unit types and no templates was therefore never seeded again. On the owner's Pixel, force-stopping
and reopening the app printed "Migrating data from version 0 to 1", seeded 10 templates, and the same Save then returned
"Invoice Created".

Size (read-only, 14 days to 2026-10-10): 17 `error_shown` SQLException/invoice events on 6 phones, 5 of them real users (11
events), every one a guest on its first business/client/invoice; against 2,778 Save presses on 1.5.0 (1,194 phones) —
about 0.4 %. These are first invoices, so each is a G1 loss. Counts start 2026-09-30 when the event began to carry the
exception.

## Decision
1. `VersionedDataInitializer.initialize` checks the default template on its own (deleted or not) and, when it is absent,
   seeds headers, backgrounds and templates (all insert-or-ignore, so nothing present is touched).
2. `CreateInvoice` and `CreateEstimate` seed and write **once more** when the first write is refused for a missing parent
   row (`healingMissingDefaults`). Any other failure, and a second refusal, are rethrown untouched.

## Rejected
- Seeding on every create — an extra write path on every Save for a fault that hits 0.4 %.
- Only fixing the splash — the failure also arrives through a switch of account and a half-finished seed.
- Showing the person an explanation — nothing they can do; the Save should simply work.

## Not done / open
- The other `error_shown` save failures are different faults: `payment_method` IllegalArgumentException (96 events / 55
  phones) and `tax` (45 / 13) — not looked at here.
- 16 more events are `InvoiceNumberTaken` (7 events, 3 phones).
- No event records that a repair happened; the fix prints one line to the log only.
- Why the splash seed was missed on those first-launch guests (an owner session not yet there when the splash left) is
  not proven; the fix does not depend on it.
