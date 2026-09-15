# 0112 — An iPhone buys premium through the App Store, by Android's rules

- **Date:** 2026-09-15
- **Status:** decided by the owner's instruction for the first App Store submission (*"kia premium abhi nhi bana
  sakty ager haan to wo bana do"*); built by the billing agent on two branches, red first. Not merged, not
  deployed, not released. The App Store Connect products, agreements and key are the owner's.
- **Decision:** An iPhone buys, restores and keeps premium through StoreKit 2 by the same rules as Android, and
  the server verifies each App Store purchase from Apple's own signature into the same entitlement tables.
- **Goals:** G3 (trust), monetisation.
- **Related:** [0041](0041-premium-is-a-date-on-the-device-refreshed-daily.md),
  [0047](0047-plays-answer-decides-premium-on-a-device.md), [0048](0048-the-paywall-says-what-google-charges.md),
  [0070](0070-a-confirmed-grant-stays-confirmed-and-only-a-refusal-the-server-names-is-googles.md),
  [0107](0107-the-premium-screen-promises-only-what-the-app-does.md).

## Context

- iOS ran `NoOpBillingRepository`. It had no products, so the paywall's button stayed on "Checking plans…"
  for ever (`PremiumPaywallSheet.kt:883`). The ad-or-premium dialog's Premium button led there.
- App Review rejects both a paywall that never loads (Guideline 2.1) and a purchase that is not an App Store
  in-app purchase (3.1.1). Apple also requires a way to restore purchases.
- The server already had what an App Store purchase needs:
  - `purchase_identity.provider` allows `APPLE_APP_STORE`;
  - `RefundWindows` already has Apple's 14 days (0041).

  What it lacked was a way to check Apple's word.

## Decision

1. **The same rules on both platforms.** The iPhone's rules live in shared Kotlin, `AppStoreBillingRepository`
   (`core/premium` commonMain), and use `PremiumGrant`, the code Android uses. Only the StoreKit calls are Swift.
   - **The App Store decides premium on the iPhone** (0047). The ads stop the moment StoreKit reports a purchase,
     before our server is asked.
   - **Every launch asks the server who owns a purchase before registering it** (0048 #5).
     - A purchase held by another account is never moved. The iPhone is premium all the same.
     - `Transaction.updates` (a purchase from another device, Ask to Buy, a renewal, a refund) is never
       registered on its own. It re-runs the launch's question.
   - **"Could not ask" never takes premium away** (0070). A refusal counts only when the server names it,
     and it takes back only a grant that was never confirmed.
   - **A transaction is finished once handled**: premium granted here, and the server asked.
   - **Restore Purchases calls `AppStore.sync()`.** A launch only reads `Transaction.currentEntitlements`,
     because `sync()` can ask the user to sign in to their Apple Account.
   - **StoreKit's `appAccountToken` carries our account id**, as Play's `obfuscatedAccountId` does.
2. **The App Store product ids are Play's own:**
   - `yearly_subscription` and `monthly_subscription`, auto-renewable, in one subscription group;
   - `life_time_purchase`, non-consumable.

   One vocabulary for the paywall, the server and the Health Centre. An App Store product id can never be
   reused, so these are final once created.
3. **The server checks Apple's signature itself**, the way Apple's own library does.
   - A StoreKit 2 transaction is a signed object (JWS). It is Apple's word only when all of these hold:
     - its certificate chain validates to **Apple Root CA - G3**, bundled and pinned by SHA-256 (`63343abf…9179`);
       the root inside the message is never trusted;
     - its leaf and intermediate carry Apple's marker extensions;
     - its ES256 signature verifies.
   - No shared secret and no call are needed. Apple's old `verifyReceipt` is not used.
   - **Apple's refusal** is:
     - Apple's signed word that the purchase was refunded, revoked or expired, or belongs to another app;
     - or Apple's server answering 400/404.
   - **Anything we cannot read as Apple's is "could not ask"** (a 503 with `UNVERIFIED`), never a refusal.
     A bug of ours, or a root Apple rotates, must not refuse every buyer.
   - **Same tables, no schema change:**
     - `provider = APPLE_APP_STORE`;
     - `provider_purchase_id` = the original transaction id, which survives renewals (rule 5);
     - `purchase_token` = the latest transaction id (it fits the 512-character column);
     - `obfuscated_account_id` = `appAccountToken`.
   - **Sandbox purchases are accepted**, because App Review and TestFlight buy in Sandbox against the production
     server. `APPLE_ALLOW_SANDBOX=false` turns that off.
   - **With an App Store Connect In-App Purchase key**, every device's daily check (0041) asks Apple's App Store
     Server API, as it asks Google:
     - `transactions/{id}`, then `subscriptions/{id}`;
     - Production first, then Sandbox if Production answers 404.

     **Without the key**, a purchase is still verified from its signature. Renewals and refunds then arrive only
     through Apple's notifications, and the account's other devices hold premium a day at a time.
4. **`POST /v1/billing/apple/notifications`** receives App Store Server Notifications V2.
   - It is on the reviewed public list: Apple calls it with no token of ours, so Apple's signature protects it.
   - When Apple can be asked, it is asked, rather than the message believed.
   - Otherwise the signed message is applied, with two limits: a late expiry never ends a period that has since
     renewed, and a refund stands until Apple reverses it.
   - A message that is not Apple's changes nothing and is answered 400.
5. **The Billing card in the Health Centre shows the App Store too:** live App Store purchases, how Apple is
   checked, and a warning while live App Store purchases cannot be re-checked. There is no new page.
6. **The paywall never dead-ends.** When the store sells nothing here, cannot be asked, or does not exist, the
   button says *"Plans aren't available right now. Tap to try again."* Android's Play client never reports
   that state, so its paywall reads as before.

## Rejected

- **StoreKit 1 through Kotlin/Native.** It is the only StoreKit Kotlin can call without Swift, and Apple has
  deprecated it. StoreKit 2 is Swift-only, so a Swift bridge was written, following the Google Sign-In and
  Remote Config bridges already in the app.
- **`verifyReceipt` with a shared secret.** Apple deprecated it, and the owner's brief ruled it out.
- **The app's own word, or StoreKit's check on the phone alone.** Either one is a claim by the client.
- **Reading a signature we cannot verify as Apple's refusal.** One misconfiguration would refuse every buyer.
- **Asking Apple by the transaction id inside an unverifiable message.** Transaction ids can be guessed, so this
  could bind someone else's purchase to the sender.
- **New reverse-DNS product ids.** They would give two vocabularies for the same plans, and an id can never be
  reused.
- **A migration.** The existing columns hold everything.
- **Registering `Transaction.updates` straight away.** It would move a purchase to whoever holds the phone.
- **`AppStore.sync()` at every launch.** It can prompt for an Apple Account sign-in with no reason given.
- **Hiding the paywall or the Premium button on iOS when there are no plans.** That weakens monetisation
  (`AGENTS.md` §1). A retry keeps the path open.
- **A page of its own in the Health Centre** (standing instruction).

## Consequences

- **The owner's App Store Connect steps come first**: products, agreements, the notification URL, and
  optionally the key. Until the products exist, an iPhone's paywall shows the retry line, not prices.
- **The deploy order is: server, then app.** An iPhone build sends `store: "APPLE_APP_STORE"`. A server
  without this change would read that as a Google token and could not verify it, which is "could not ask":
  premium stays on StoreKit's word on that iPhone.
- **Android is unchanged on the wire and on the screen.** A test pins Android's purchase and restore bodies to
  exactly `{purchaseToken, productId}`.
- **Still open before submission, and not billing's code:**
  - the paywall's "Terms & Conditions" link opened the privacy policy. Guideline 3.1.2 needs a Terms of Use.
    The store-review branch points it at our own page (`LegalLinks.TERMS`, `05a8ee78`); that page must be a
    real Terms of Use (Apple's standard EULA is acceptable);
  - the store-name wording is the store-review agent's (`StoreWording`, branch `fix/146-app-store-review`).
- **No introductory offer or free trial** should be created in App Store Connect. The paywall prints the
  regular price (billing.md known gap #6).
