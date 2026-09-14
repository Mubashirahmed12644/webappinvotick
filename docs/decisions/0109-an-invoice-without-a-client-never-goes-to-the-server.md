# 0109 — An invoice without a client never goes to the server

**Status:** decided by the owner on 2026-09-14, in his answer to 0108's second question: the server never stores an
invoice without a client. Built for 1.4.6 on the app branch `feat/146-deleted-product-reaches-server`, together with
0108's product fix: tests `26f729d2` (3 of 4 failed first), fix `e681530c`. The branch is pushed. Not merged and not
released.

**Related:**
- 0108 (a correct refusal is a warning);
- sync agent rule 31;
- G3.

## Context

- **The drafts.** The create screen autosaves a draft before a client is picked, so a draft can sit on the phone with
  no client.
- **The app already held them back, but only in one place.** `InvoiceRepositoryImpl.invoiceIsReadyToSync` has kept such
  a draft off the queue since 07-19.
  - The orphan scan (`SyncOrphanDao.orphanInvoices`) put it back before every push.
  - The sign-in (`UserMigrationDao.enqueueInvoiceCreates`) queued every draft too.
- **The refusals.** The server refused each draft (`MISSING_REQUIRED_FIELD`, `clientId`) and then each of its lines
  ("Invoice not found for invoice item").
  - 68,744 refusals came from one 1.4.4 phone (`b424b80c`).
  - 8 drafts sit on 2 phones.
  - 172 line refusals a day paged Slack.
- **What those drafts are.** They are autosaves the user moved past. One phone (`43c73c71`) picked a business at 15:03:52,
  signed in at 15:04:07 and was refused at 15:04:12. The user then made the real invoice, with a client.

## Decided

- **One rule, in one place:** `InvoiceReadiness`. An invoice is ready once it names its client. The code that queues or
  sends one invoice uses `isReady`; the bulk queries use `HAS_CLIENT_SQL`, the same rule in SQL.
- **The orphan scan and the sign-in skip a draft with no client, and its lines.**
- **The push never sends one.** A draft, or its line, queued by an earlier build is closed quietly. It is not a failure.
- **Nothing is lost.** The save that adds the client queues the draft again, as a create, and the orphan scan then sends
  its lines. A test proves it.
- **Estimates are unchanged.** The server stores an estimate without a client (`estimates.customer_id` is nullable).

## Rejected

- **Making the client optional on the server** (0108, question 2). The owner said no: an invoice without a client is
  never saved on the server.
- **Deleting the old drafts on the phones.** They are the user's own work, and a client may still be added.
