# 0195 — A deleted invoice takes its own payments with it

- **Date:** 2026-09-30
- **Decided by:** the owner (*"Invoice mite to us ki payments bhi mitein"*)
- **Built:** app `release/1.5.1-integration` (1.5.1). No backend change.

## What happened

A payment added on a new invoice, then the Save gate dismissed — the app writes a draft with the payment, so work is
not lost — then "Discard Everything": the invoice was deleted, the payment stayed live. The client's ledger and the
dashboard kept counting money received on an invoice that no longer existed (G3).

Until now (sync rule 23, 2026-09-13) an invoice's delete took its lines and deliberately left payments alone, held
for the Payments-screen review.

## Decision

When an invoice is deleted on the phone, in the same local transaction as the invoice and its lines:

1. every live link between it and a payment (`invoice_payments`) is soft-deleted, and
2. every live payment recorded on it **alone** is soft-deleted,

each with its DELETE queued, so they sync as deletes.

A payment that is also linked to another invoice (the Payments screen allocates one receipt across invoices) is **not**
deleted: only this invoice's link goes.

## Rejected

- **Delete every linked payment**, shared or not — would erase the other invoices' share of a real receipt.
- **Keep payments, delete only links** — the payment would stay in the client's ledger and the dashboard total with
  no invoice, which is the defect itself.
- **Repair existing rows / a server cascade for old builds** — not asked for; existing data is left alone. Old builds'
  deletes still leave payments live.

## Guards

`ADeletedInvoiceTakesItsOwnPaymentsTest` (own payments and links go; a shared payment keeps its other link; ledger,
dashboard and balances exclude them; discard after the gate leaves no live payment; the push sends each delete; a
refused queue row undoes it all), `ADeletedDocumentTakesItsLinesTest`.
