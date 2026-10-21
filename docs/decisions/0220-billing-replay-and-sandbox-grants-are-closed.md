# 0220 — Billing: a refund cannot be replayed away, and a Sandbox purchase grants no production premium

- **Date:** 2026-10-15
- **Status:** built by the billing agent on the owner's order to fix the 2026-10-15 security audit's billing findings;
  **not deployed**. Gradle not run by the agent (the lead runs it). No migration, no app change, no release.
- **Tier 1** (money / trust). Security audit 2026-10-15 (`kaam/research/security-audit-2026-10-15.md`), findings
  **A1, A2, A4, A5, A6, A7**. A3 (the notification secret in Caddy's log) was batch 1 (0217) and is not touched here.
- **Related:** 0041 (the account's premium on every device), 0047 (Play's word decides premium on a phone), 0048 / 0070
  (a refusal is final only when the store gives it), 0112 (App Store purchases), 0139 / 0140 (Play's notifications and
  the daily check), 0143 (a purchase follows the phone's newest account), 0156 (test purchases are named by the store),
  0217 (batch 1).
- **Code:** backend branch `fix/billing-security-2026-10-15` (worktree `kaam/worktrees/invotick-apis-billsec`), on top
  of `integ/kisht2-2026-10-15`. One commit per finding: `abb9017` A2, `9e7c62b` A1, `d62bda9` A4, `7754249` A6,
  `5be117a` A7.

## The rule every change here keeps

**Whoever paid stays premium on every phone they use.** Nothing in this decision can answer a paying customer with a
refusal: every new "no" is either the store's own refund, or "could not ask" (503 / `UNVERIFIED`), which every build
reads as unknown and on which the buyer's phone keeps the store's word (rules 1, 3, 10). Tests that pin it: a new
purchase, a renewal, a restore on a new phone, the first customer's own row, a long-standing iPhone buyer's cached
receipt, ten launches of a three-purchase phone.

## A2 — a refund stays a refund (`abb9017`)

**Found.** `EntitlementService.bind()` wrote the store's live word over a `REFUNDED` or `REVOKED` grant on every road
— the holder's purchase report, a restore, a move — and cleared the refund's record. Google's subscription record has
no refunded state and a one-time product reads "purchased" after its refund, so the same token reported again
re-activated a refunded Play purchase, and a restore with `moveConsent=true` could carry it to another account,
landing `ACTIVE`.

**Decided.** A refunded or revoked grant (the two statuses `write()` already never overwrote with a live word) is
reopened **only by a charge made after it ended**: the verified charge time (a lifetime's purchase time; an App Store
transaction's `purchaseDate`; a subscription's latest order's `createTime` from the Orders API) later than `revokedAt`.
- A lifetime's one charge, and any receipt from before the refund, are older: they never reopen it.
- A renewal Google (or Apple) charged after the refund does: that customer is paying again.
- When the charge's time cannot be read, it stays ended; the buyer's own phone keeps the store's word, and asks again
  next launch.
- Nothing is bound, moved or logged; the answer is what we hold (`premium=false`). The app reads that as a refusal
  that takes back only a grant never confirmed (0070).
- A restore of a refunded purchase from another account answers `BELONGS_TO_ANOTHER_ACCOUNT` and moves nothing.

Guard: `ARefundStaysARefundTest`.

## A1 — an old App Store receipt does not undo Apple's refund (`9e7c62b`)

**Found.** An App Store receipt is verified at the moment Apple signed it, so a receipt kept from before a refund
verifies for ever and carries no revocation. Posted again, `bind()` wrote `ACTIVE` over `REFUNDED`.

**Decided.**
1. The replay itself is closed by A2's rule: the old receipt's `purchaseDate` is older than the refund.
2. Apple's `REFUND` / `REVOKE` notification records **Apple's own `revocationDate`** as `revokedAt` (never later than
   now), so a genuine resubscription made after the refund — same original transaction id, newer `purchaseDate` —
   still reopens the grant however late the message arrived.
3. A purchase report or restore that **carries Apple's signed revocation** is written onto the grant, not only refused.
   Only for the transaction we hold as current: a refund of an earlier renewal must not end a period paid for since.
   `registerPurchase` keeps that write (`noRollbackFor = InvalidPurchaseException`; nothing else is written before the
   refusal).
4. When the App Store Server API key is set and a receipt is **more than 24 hours old**, Apple is asked now and its
   answer decides (a refund, or a renewal since). Apple busy or refusing our key: the signature's word stands.

Guard: `AnOldAppleReceiptDoesNotUndoARefundTest`.

## A4 — a Sandbox purchase grants no production premium (`d62bda9`)

**Found.** `apple.allow-sandbox` is on (App Review buys in Sandbox against our production server), and a Sandbox
purchase was taken exactly as a paid one: a free Sandbox or TestFlight **lifetime** became permanent premium on every
device of that account, Android and web included.

**How iOS is reviewed (why Sandbox cannot simply be refused).** The app is on the App Store since 2026-10-15. App Review
and TestFlight buy in Apple's Sandbox, against the production server; a paywall that answers "purchase failed" is a
Guideline 2.1 rejection. On the iPhone, StoreKit's word decides premium (rule 10): when our server answers 503 /
`UNVERIFIED`, `AppStoreBillingRepository` reports the purchase as a success and the phone is premium (checked in the
app's code, `PremiumGrant.Outcome.UNANSWERED`). Only a 400 `NOT_VALID` would tell the reviewer it failed.

**Decided.**
- **New setting `apple.sandbox-accounts`** (`APPLE_SANDBOX_ACCOUNTS`): Invotick user ids or e-mails, comma-separated,
  allowed to hold **account** premium from a Sandbox purchase. **Empty by default, so production grants nobody.**
- A Sandbox purchase from anyone else is **"could not ask"**, never a refusal: nothing is bound or written, and the
  iPhone stays premium on StoreKit's word. App Review sees its purchase work; no other device gets premium from it.
- **Every Sandbox grant is time-limited, never a lifetime:** its own date or `apple.sandbox-grant-hours` (24) from now,
  whichever is sooner — on the signed transaction, on Apple's server answer and on a notification. Asked again, it
  rolls on while Apple still stands behind it.
- `APPLE_ALLOW_SANDBOX=false` is now "could not ask" too (it was a definitive refusal, which would have failed review).

Guard: `AppleSandboxGrantsTest`; `AppleSignedTransactionTest`'s Sandbox-off case now expects could-not-ask.

## A6 — the phone's strings reach Google as data (`7754249`)

**Found.** The client's purchase token (and an order id) were spliced into Google's androidpublisher URL as text, so
a `/`, `..`, `?` or `#` asked Google about another resource of ours under our key. A subscription was stored under the
product the phone named.

**Decided.** Every part of Google's address is one encoded path segment, built as a `URI` (no double encoding); a real
token's characters (letters, digits, `.` `-` `_`) are unchanged. `.` and `..` are refused as no token, as a blank one
is. A subscription's answer carries Google's own `lineItems[].productId`, so a **new** purchase is kept under the
product Google sold (existing rows are untouched). A lifetime's product was already one of
`GOOGLE_PLAY_LIFETIME_PRODUCTS`. Guard: `GoogleIsAskedAboutExactlyThisPurchaseTest`.

## A7 — purchase and restore are bounded (`5be117a`)

**Found.** `/v1/billing/purchase` and `/restore` ask the store first and had no bound; any guest could spend the Play
API quota every buyer shares. Every call read the key file and fetched a new OAuth token; Google's requests had no
timeout.

**Decided.** 60 store-asking calls per account and 300 per address per 10 minutes (`billing.calls.*`), in memory. Over
budget answers exactly as "the store could not be asked" (503 / `UNVERIFIED` for a purchase report, `UNVERIFIED` for a
restore): never a refusal. A real phone sends two calls per launch per purchase. Google's requests block at most 15 s,
then could-not-ask. The service-account credentials are read once and refreshed by Google's library. Guard:
`StoreChecksAreBoundedTest`.

## A5 — purchase tokens are bearer (no code change)

A store purchase token works for whoever presents it, and a move (0143) depends on what the client sends. Each fix the
audit suggested was weighed and **rejected, because each takes premium from real buyers or adds nothing**:
- **Answer `premium=false` to a non-holder's purchase report.** On a reinstall the phone's new guest is a non-holder
  until the restore settles; the app reads `premium=false` as a refusal and takes back the unconfirmed grant — the
  first customer's risk #1 back again. The holder's view keeps the phone premium, as 0143 decided.
- **Compare the store's account binding (`obfuscatedAccountId` / `appAccountToken`) with the caller.** It names the
  account that was open when the purchase was made — usually a guest — so every legitimate sign-in move would fail.
- **Require an existing `linked_device` row before a move.** The auth filter writes that row on the caller's own first
  call, so it proves nothing.
What bounds it today: no answer to an app carries a token (`EntitlementView`, `RestoreResult` and `PurchaseRefusal`
have none; admin routes are ADMIN-only), a move needs the store's word in the same call, three moves a year, and A7's
budget. Not checked here: whether any log line prints a token.

## Rejected

- **Refuse an App Store receipt older than 24 h when Apple cannot be asked** (the audit's suggestion). StoreKit hands a
  long-standing buyer's iPhone its cached receipt on every launch; refusing it would take premium from people who paid.
  Closed instead by A2's rule plus asking Apple when the key is set.
- **Refuse Sandbox in production.** Fails App Review (2.1).
- **Allow-list only, with Sandbox grants as before.** A tester's free lifetime would still be permanent; capped instead.
- **Reopen a refund on the store's live word** (as before). Not evidence: Google cannot show a refund on a subscription.
- **Store which order was refunded** (a migration) to compare renewal counters. The charge time against `revokedAt`
  answers the same question with no schema change.
- **A charset whitelist on Play tokens.** Google documents none; a refused real token leaves a buyer's other devices
  without premium. Encoding closes the injection.
- **Answer over budget with 429.** Builds up to 1.4.5 read any non-503 error as Google's refusal; 503 is unknown on
  every build.

## What did not change

Every purchase that is neither refunded/revoked nor bought in Sandbox (production was not queried for this; see the
owner's question 2), Play's
notifications re-verified with Google (they may still write Google's status over a refund; Google sends one only on an
event on its side, never on a client's word), the admin defer, the daily check, Apple's `REFUND_REVERSED`, the
`test_purchase` label (0156), revenue (0182).

## What remains

1. **A3's other half, now more important.** A forged Play "voided" message (it needs the RTDN secret, which 0217 moved
   to a header) still writes `REFUNDED` with no re-check against Google. Until today the buyer's next launch undid a
   wrong refund through `bind()`; after A2 it does not. Next: apply a voided message only when Google's Voided
   Purchases list confirms it, or move the push to Google-signed (OIDC) authentication.
2. **Grants written from Sandbox before this deploy** stay as they are (owner question 2).
3. **A1 without the App Store Connect key** relies on Apple's refund notification reaching us; with the key set, an old
   receipt is checked with Apple directly (owner question 3).
4. A Play subscription refunded **without** revoking access stays non-premium on other devices until Google charges it
   again (the buying phone keeps Play's word). Same as `write()` already did; owner question 4.

## For the owner

1. **`APPLE_SANDBOX_ACCOUNTS`:** leave empty (App Review and TestFlight still work on the iPhone itself), or list our own
   test accounts (e.g. the `play testing` demo account, qatester935) so they see premium on Android/web too, a day at a
   time?
2. **Sandbox grants already written:** leave them, or end them? Read-only count first:
   `SELECT HEX(e.user_id), pi.product_id, e.status, e.expires_at FROM entitlement e JOIN purchase_identity pi ON
   pi.id = e.purchase_identity_id WHERE pi.provider = 'APPLE_APP_STORE' AND pi.test_purchase = TRUE;`
3. **App Store Connect In-App Purchase key** (`APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` in app.env): is it
   set on the new server? Without it Apple's refunds reach us only by notification.
4. **A refund given without revoking access** (Play Console "refund" with "revoke" unticked): should it keep premium on
   the account's other devices? Today it does not, until the next renewal charge.
