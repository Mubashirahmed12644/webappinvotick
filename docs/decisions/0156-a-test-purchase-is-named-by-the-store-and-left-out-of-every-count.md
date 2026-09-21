# 0156 — A test purchase is named by the store, and every premium count leaves it out

**Date:** 2026-09-22
**Status:** **Built, not deployed.** Backend `migration/purchase-test-flag` (`bd0fed5`), then `feat/purchase-test-flag`
(`1ee5384`) on top of it; 1,422/1,422. Panel `feat/purchase-test-flag` (`114ad5f`). The backfill has **not** been run.
**Tier 1** (billing rows), additive. Owned by the billing agent (0051); rule 15 in `.claude/agents/billing.md`.
**Related:** 0047, 0048, 0112 (Apple), 0140 (the daily check), 0143.

## The owner's words

> 2026-09-22: the server must tell real purchases from Play test (license-tester) purchases **by Google's own signal**,
> so every premium count separates real from test by itself.

## What the data says (production, read-only, 2026-09-22)

- 11 purchases, 11 grants. 3 are real buyers, each granted for more than 24 h: AU annual (2026-09-10), MV monthly
  (2026-09-19), ET annual (2026-09-20). The other 8 are ours: test subscriptions that lapsed 4 to 34 minutes after
  purchase. One of them (`GPA.3379-…-01622`) still reads `ACTIVE` with a date already passed.
- 3 of the 8 were kept before tokens were (27 Aug), so asking Google about them needs their order first.
- Test phones are known today only by `app_instance_id`, which changes on every reinstall.

## What Google and Apple say

- `purchases.subscriptionsv2`: `testPurchase` — "Only present if this subscription purchase is a test purchase." An
  object with no fields; its presence is the signal.
- `purchases.products` (the lifetime): **has no `testPurchase`.** It has `purchaseType`, set only outside the standard
  flow: 0 = a license-testing account, 1 = a promo code, 2 = a rewarded ad. Only 0 is a test; a promo code is a real
  person's free purchase.
- Apple signs `environment`: `Sandbox` (TestFlight, App Review, sandbox testers) or `Production`.

## What was decided

1. **One nullable column, `purchase_identity.test_purchase`.** TRUE = the store said test; FALSE = the store answered
   without it; NULL = not asked since the column existed. It lives on the purchase because it is a fact about the
   purchase, which never changes hands; the grant can.
2. **Kept wherever an answer already arrives, no extra call:** register, restore, a device's check, a Play
   notification, the daily check, the admin defer's re-read, Apple's check and notification. "Could not ask" leaves it.
   The daily check keeps it in its dry run as well: it is a label, and the dry run still writes no grant.
3. **It never decides premium.** No grant, date, restore answer or move reads it. Test purchases work exactly as before.
4. **Counts leave TRUE out by default; NULL counts as real**, so a real buyer never drops out of a count before the
   store has been asked. Covered: the billing-health summary (every count and list), the `billing-integrity` card, the
   `retired-plan-renewals` card. `includeTest=true` on the summary puts them back. The summary and the card say how
   many live test purchases were left out and how many purchases are unlabelled.
   Not filtered, on purpose: "premium without payment" (a tester's premium has a purchase behind it), the
   notification cards' "purchases ever" (tests do get notifications), the log labels of premium users.
5. **Backfill once, dry first:** `POST /v2/admin/billing/purchases/test-flag` (ADMIN). Dry by default: it asks the store
   about every purchase still NULL and lists order, product, grant dates, minutes between grant and date, and what the
   store said. `{"apply": true}` writes that one column. The apply is the owner's word.
6. **Migration first, alone**, then the code (`ddl-auto=validate`: the code needs the column; the running jar ignores
   it).

## Rejected

- **A list of test phones** (`app_instance_id`, device ids): changes on every reinstall, and it is our guess, not
  Google's word.
- **"Lapsed in under 24 hours" as the rule:** true of every row today, but a real buyer refunded in an hour would
  vanish from the counts, and a tester's annual test plan would not.
- **Putting the flag on `entitlement`:** the grant moves between accounts (0143); the purchase does not.
- **Asking Google again just to label:** every place already holds Google's answer.
- **Reading `testPurchase` on the one-time product answer:** Google does not send it there; `purchaseType = 0` is the
  documented signal.
- **Counting NULL as test, or hiding NULL:** before the backfill that would take the three real buyers out of every
  count.
- **Hiding test purchases from the app or the server's answers:** the owner asked for counts, and a tester must keep
  seeing what a buyer sees.
- **Running the backfill's apply now:** a write on customer billing rows; the owner decides after the dry run.

## Deploy order

1. `migration/purchase-test-flag` to `stage` (column only; nothing reads it).
2. `feat/purchase-test-flag` to `stage`.
3. The backfill's dry run, shown to the owner; the apply on his word.
4. The panel branch, after the backend (an older backend is read as before).

## Open

- The backfill's apply (the owner's).
- A test subscription more than about 60 days past its end may no longer be known to Google; such a row stays NULL
  and counts as real. None today (the oldest is 26 days).
