# 0108 — A correct refusal is a warning, and a fault stays an error

**Status:** decided by the owner on 2026-09-14. His words: "Issue notification bhaijny ka nhi, issue any waly issues ko
fix krna hy; jo fixing ky kabil nhi unko silent kr sakty ho." Then: "ager issue invoice ky template missing ka hy to
usko pura kro, ye ainda harkat naa ho."
- **Built:** backend `fix/a-correct-refusal-is-not-an-error`. Tests `8b931b7` came first (2 of 4 failed), then the fix
  `df6f6a1`. Full suite 1047/1047. Not deployed.

**Related:**
- sync agent rules 3, 13 and 30;
- 0059 (a delete of a record the server does not hold);
- 0080 (a record the database refuses is refused alone);
- 0053 (a guest's work joins in one step);
- G3.

## Context

- **The alert.** Grafana's "SyncV2 Hard Failure" (`invotick-sync-failure`) pages Slack on one ERROR line containing
  SYNC. It fired 79 times in 48 hours.
- **The lines behind it.** In the 24 hours to 2026-09-14 17:23 UTC, 8,358 lines matched. Read from Loki, per class:

  | Class | Lines | Cause |
  |:--|--:|:--|
  | A line's product is not on the server | 7,095 | One account (`563374d0`, 1.4.5), 89 products, 514 lines in 7 days. |
  | A line's invoice is not on the server | 252 | 31 invoices in 7 days. 22 have since arrived; 9 remain (below). |
  | Stale copy ("older than server state", "not applied: the server already holds a newer version") | 380+ | The conflict contract answering correctly. |
  | An invoice's template is not on the server | 151 | 4 invoices in 7 days. All 4 are on the server now, with every line. |
  | The database refused a client name | 8 | One client, 291 characters, all before names were widened at 23:03 UTC on 09-13. It arrived at 23:08. |
  | Other: a stamp's business, a reference another account owns, a missing timestamp | ~470 | Smaller classes. |

## Decided

- **A copy older than the server's is refused at WARN.** The answer, `STALE_CONFLICT`, is unchanged. So is the filed
  failure, and the line keeps its id and reason.
  - This covers 26 create and update catches in the 13 groups that still logged every refusal at ERROR.
- **Every other refusal keeps its ERROR line.** A missing reference is a record that cannot arrive. It keeps paging until
  its cause is fixed. A test holds this: a line whose invoice the server does not hold still writes its ERROR line.

## The template chain (the owner's second message)

- **Stuck today: 0.** In 7 days, 4 invoices from 3 accounts were refused for a template the server did not hold. All 4
  are now on the server with all their lines:
  - `5ca70565` (4 lines) arrived at 01:16 UTC on 09-14;
  - `d7831bf6` (10 lines) arrived at 15:03 UTC on 09-14;
  - `389ec22b` and `8d77a40f` arrived on 09-08.
- **Why it happened.** Each phone sent an invoice before its template. The server refused the invoice, the phone's repair
  re-sent the template (`MissingReferenceRepair`, `templateId` → template), and the invoice then landed.
  - For `93c0aa01` this took 2 seconds.
  - For `46e70cdc` it took 6.5 hours. That phone's queue had been blocked since 09-11 by a product name over 255
    characters. The block was lifted by 0080 (09-13 20:26 UTC) and by the 1,000-character names (09-13 23:03 UTC).
    `93c0aa01` had been blocked the same way since 07-01.
  - The server's logs cannot show why that one template waited 6.5 hours on the phone.
- **Why it does not recur.** A push is no longer refused whole for one record (0080). The phone re-sends a missing
  template on the first refusal. 1.4.6 also re-sends every never-synced template before each push (T5).

## Open, each waiting on a decision

- **A product deleted on the phone before it reached the server.** This is the largest class: 7,095 lines a day from one
  account. It needs an app change in 1.4.6.
  - `ProductDao.getProductById` skips deleted rows. So the push closes such a product's CREATE as "local row missing"
    (539 reports from that phone), and the product is never sent. The invoice lines that name it are refused for ever.
  - The repair cannot help: the server names the line's product `inventoryItemId`, and the app's map knows only
    `productId`. It also lacks `customerId` and `categoryId`.
  - The fix: send a never-synced deleted product as a deleted row instead of closing it, and add the three names to the
    map. The same lookup skips deleted templates and payment instructions.
  - 3 phones reported it (`563374d0`, `518505c4`, `55d73777`). Recovery: once `563374d0` runs 1.4.6, its next push
    re-sends the 89 products and the 514 lines land. No server change is needed.
- **Invoices without a client from 1.4.4 phones.** 8 invoices on 2 phones (`40722914`: 7, 68,695 attempts since 09-05;
  `75e74364`: 1), plus 32 lines.
  - `invoices.client_id` is NOT NULL and no stored invoice lacks a client, so the server cannot hold them.
  - Holding them needs a migration first, and a review of every reader that assumes a client.
- **One invoice whose payment instruction another account owns** (`f8ad0847`, `bed76f4d`, 4 lines). This is the 0053
  family, and its repair is R1's.

## Rejected

- **Moving missing-reference refusals to WARN as well.** Most of them are records that will never arrive; muting them
  would hide real data loss.
- **The server storing a line without its product.** The phone's line holds `productId` NOT NULL. Sending it back empty
  would bring class P back (sync rule 14).
- **A placeholder template or product made by the server.** The server does not know their contents, so it would be
  inventing data.
