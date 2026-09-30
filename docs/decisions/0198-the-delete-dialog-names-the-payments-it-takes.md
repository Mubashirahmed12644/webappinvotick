# 0198 — The delete dialog names the payments it takes

- **Date:** 2026-09-30
- **Decided by:** the owner — the approved mock "Option A" (`kaam/research/delete-with-payments-2026-09-30/index.html`),
  and for the create screen's leave dialog, *"Discard par bhi yahi"*.
- **Built:** app `feat/delete-dialog-names-payments` @ `67998f78b`, off `release/1.5.1` (`55efcd98c`). Not merged, not
  released. **Schema:** none. **Backend / panel:** nothing — two parameters on events that already exist.
- **Gate** (`--rerun-tasks`, every XML incl. `__TEST-*`): Android 2408 (+21), jvm 130, iOS-sim 178, 0 failures (a first run hit the known iOS-sim XML-write flake in `core:analytics`, "Should have reached EOF…"; re-run with `--no-daemon`, green). `xcodebuild` Debug: **BUILD SUCCEEDED**. Red without the change: 15 of the 21 new tests
  (the six that stay green guard what must not change: the old wording and the old event ids).

## What happened

Since 1.5.1 an invoice's delete also deletes the payments recorded on it alone (decision
[0195](0195-a-deleted-invoice-takes-its-own-payments.md)). The dialog still said only "Yes, Delete Invoice": money
the client had paid left the client's record and the Paid total without a word (G3). The mock's count: of 1,287
invoice deletes, 112 had a payment on them.

The dialog also existed twice — the saved invoice's More → Delete and the list's delete — with slightly different
colours, so any fix would land in one and leave the other.

## Decided

1. **One dialog**, `feature/invoice/presentation/delete/DeleteInvoiceDialog.kt`, used by the saved invoice and by the
   list (several selected, and one row). The two old copies are gone. Each call site passes its own event ids
   (`DeleteInvoiceDialogIds.SavedInvoice` / `.InvoiceList`), which are exactly the ids it always sent
   (AGENTS-EVENTS §1.8), so no history splits.
2. **No payment: the dialog is what it was**, word for word ("Are you absolutely sure? …", "Yes, Delete Invoice").
3. **With payments**, in the same dialog, one tap:
   - the strip: "This invoice and its payments will be permanently deleted";
   - where "Are you absolutely sure?" stood, **"Payments on this invoice"**, set like an invoice's totals: Invoice
     total; each payment going, in bold, "Received" with its date · method; a rule, then **Balance due** in the app's
     own form — `Rs(1,500.00)` when paid in advance (decision 0192), with "Rs1,500.00 paid in advance" under it;
   - one sentence: "Rs2,158.00 received, the Rs1,500.00 advance included, will also leave your client’s record and
     your Paid total." (without an advance: "Rs5,000.00 received will also leave …");
   - the red button: **"Yes, Delete Invoice and Payments"**.
   The advance stays on its own invoice; nothing is carried to another one (owner, 2026-09-30).
4. **A share of a receipt spread over several invoices** (the Payments screen writes one payment per invoice) gets a
   note — "This Rs1,200.00 is one part of a Rs3,000.00 payment you spread over 3 invoices. Only this part is deleted —
   INV-0040, INV-0043 keep theirs." — **only when certain**: the same client, created within 2 seconds, the same
   reference and note, and another invoice that is still there (or one payment linked to several invoices, which the
   delete also leaves). Otherwise it is shown as an ordinary payment, which is also true. The receipt's total counts
   the shares still on live invoices.
5. **Several invoices from the list**: one row per invoice that has payments — "INV-0042 · Hamza Traders", "Received
   12 Sep 2026" (or "2 payments received"), the amount **in that invoice's currency**. No total: two currencies are
   never added. Then "INV-0037 has no payment." and, when currencies differ, "Different currencies are listed, never
   added together." The strip and button say "All 3 invoices and their payments …", "Yes, Delete All and Payments".
6. **The create screen's leave dialog** ("Discard Everything"): when the draft kept at the Save gate has payments
   written, the same block sits under the dialog's own question, and the button reads **"Discard Invoice and
   Payments"**. A payment only on screen, never written, is in no record and is not listed. The estimate's leave dialog
   is unchanged.
7. **The dialog opens once it knows.** The payments are read from the phone's tables when the dialog is asked for (a
   local read) and the dialog waits for it, so the red button is never shown under the wrong name. A failed read shows
   the old dialog; the delete itself is unchanged.
8. **Analytics — a parameter, not an event** (AGENTS-EVENTS §1.1): the existing confirm events carry
   `had_payments` (`true|false`) and, only when `true`, `advance` (`true|false`) — absent means not applicable (§1.7):
   - `delete_inv_success` (saved invoice, auto tap),
   - `tap:dashboard:components_DeleteInvoiceDialog.yes_delete_if_invoicecount_1_2` (list, auto tap),
   - `discard_confirmed` (coded) with `source=create_invoice`; other sources send neither key.
   `TrackedButton` gained `analyticsParams`, as `TrackedIconButton` already had.
9. **Layout** (LAYOUT_RULES): at a large font everything above the buttons scrolls with a faint shade, and the two
   buttons stay on screen; a figure is never cut or broken — it moves under its label when both do not fit, and
   shrinks only if it alone is wider than the dialog; figures read left to right in Arabic and Persian.
10. **Colours:** the one dialog takes the saved invoice's copy — `surfaceContainer` plate and a solid error disc, the
    same as the leave dialog beside it. The list's copy had `surfaceContainerHigh` and a washed disc, so the list's
    two light pictures moved: `dashboard/delete-dialog-light.png` and `delete_invoice_dialog/one-light.png` (accepted; nothing else moved — the leave dialog without payments is pixel for pixel the same).
11. **Words:** 19 new strings (5 of them counted forms) in English and all 16 other interface languages, Arabic and
    Persian with isolated figures. The saved invoice's duplicate title string went; both use the list's (identical in
    every language). "Permanently" is untouched — a separate question.

## Rejected

- **Option B, a second dialog after "Yes, Delete Invoice"** — one more tap on every such delete, the second red
  dialog gets pressed unread, and its Cancel is ambiguous (was the invoice deleted or not?). There is no third way
  (keeping the payments) for it to offer.
- **Adding amounts across invoices** in a multi-delete — two currencies are never summed.
- **Listing a payment that is only on the create screen** on Discard — it is in no record, so "will also leave your
  client's record" would be false.
- **Recognising a spread receipt by amount or by day** — only the same moment for the same client is certain.
- **A new event** (e.g. `invoice_deleted_with_payments`) — the confirm press already exists; the fact is a parameter.

## Screenshots

`kaam/research/delete-with-payments-2026-09-30/built/` — light and dark, the advance, instalments, a spread share,
several invoices, the leave dialog, German at font 1.5, Arabic.

## Guards

`TheDeleteDialogNamesThePaymentsItTakesTest` (the read: no payment, advance in brackets, instalments oldest first,
no method, deleted rows, a spread share and three near-misses, several currencies),
`TheSavedInvoiceDeleteDialogNamesItsPaymentsTest` (the saved invoice, after Receive Payment),
`TheLeaveDialogNamesThePaymentsDiscardTakesTest` (kept at the gate vs only on screen),
`OneDeleteDialogNamesThePaymentsTest` (the drawn dialog: both screens' ids, the old words, the new words, the press's
parameters). Dark gate: 0 dark defects, 126 light baselines (5 new pictures of this dialog).

**Screenshot note:** the screen-drawing harness does not load the runtime word table, so the method reads "Cash" in the German and Arabic pictures; on a phone it reads "Bar" / "نقدًا" (the table has all nine method names).
