# 0206 — A payment method with no fields names itself on the document

- **Date:** 2026-10-05
- **Status:** built, not merged, not released. App `fix/invoice-cash-method-name` (off `origin/release/1.5.1` `4ffe740c7`).
  **Web: no change, no bundle rebuild.**
- **The report:** since the payment-method fix (Cash saves with no fields), an invoice whose payment method is Cash with
  empty Notes showed nothing for it. The "payment instructions" block, heading included, was missing.
- **Root cause:** the document's payment text is `PaymentInstruction.fieldsToString()`, which lists only the stored
  fields. Cash's only field is Notes (optional), so the text was empty, `InvoiceSnapshot.toggles["payment"]` was
  false (`!paymentInstructions.isNullOrBlank()`), and `InvoiceDocument` / `SummaryLeftFitted` draw the block only
  when that text exists. The method's own name was never part of the text for any method.
- **Where the fix lives (evidence):**
  - The snapshot mapper (`buildInvoiceSnapshot`) receives the body as a finished `String?`; it never sees the method,
    so it cannot say the name. The renderer (`InvoiceDocument.tsx`) treats the body as opaque text. Neither is the
    place.
  - The text is made in exactly six places (`InvoiceScreen`, `PreviewInvoiceViewModel`, `SaveInvoiceViewModel`,
    `EstimateScreen`, `EstimatePreviewViewModel`, `EstimateSaveViewModel`), all through `fieldsToString()`. So the one
    function is the source, and it feeds the native renderer, the offline HTML bundle, the online HTML and the share
    link's frozen snapshot alike. **Offline == online holds by construction; no web branch is needed.**
- **Decision:**
  - New `PaymentInstruction.documentBody()`: the fields as before, one per line; when there are none, the sentence
    **"Payment method: <name>"**. The old fields-only function is private, so no caller can bring the empty block back.
  - A field the person cleared (key present, value blank) no longer prints as `notes:`; it counts as no field.
  - The sentence and the name are looked up with `RuntimeText` (the app's own catalogue for words said outside a
    screen): 16 interface languages (English plus 15 translated, `id` and Android's `in` alias identical). The stored
    code is spoken as the catalogue already spells it (`MOBILE_WALLET` → "Mobile Wallet"). The share page's translate
    route then carries the body to the receiver's language like any other body.
  - Estimates take the same text (same function, same block).
- **Not touched (owner hold, `payment-form-review-postponed`):** the payments form, payment allocation, the Payments
  screen. This is only how the invoice *displays* the method.
- **Rejected:**
  - Adding the method name to *every* method's body ("Payment method: Bank Transfer" above the bank lines): changes
    every existing invoice with fields, and nobody asked. Only the empty case is fixed.
  - A new label in the web's invoice-label table plus a new snapshot field and a renderer branch: right in a
    document-language world, but it needs a web branch, a bundle rebuild and a table regeneration for one line, and
    the body is the seller's own text (decision 0185 lists payment-method codes as stored data that is not
    re-translated).
  - Showing a block with only the heading "Payment Instructions" and nothing under it: a heading over nothing.
- **Proof:** `APaymentMethodWithNoFieldsNamesItselfTest` (6, domain): red first on the old behaviour (4 of 6 fail), green
  after. `ACashMethodNamesItselfInEveryLanguageTest` (2, composeApp) reads the real catalogue for every language and
  fails by language name if the sentence or the word for Cash is missing (calibrated: deleting the Thai line turns it
  red).
- **Known, left alone:** the stored field keys print as raw codes (`bank_name: …`, `account_no: …`). That is how every
  payment body has always read; it belongs to the payment-form review.
