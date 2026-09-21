# 0157 — One empty answer from the store never takes premium from a premium phone

**Date:** 2026-09-22
**Status:** **Built** on app `VC_108_VN_149`: `3feadaa5`, kill switch `82b0a374`, for 1.4.9. Android unit tests 1,078/1,078, JVM 205/205, iOS simulator compiles. Not released. No server change.
**Tier 1** (premium on a paying customer's phone). Owned by the billing agent (0051); rule 16 in
`.claude/agents/billing.md`.
**Related:** 0047 (Play decides premium on a device), 0070 ("could not ask" never takes premium), 0041 (the account's
grant), 0112 (iOS by Android's rules).

## What happened

The Samsung release test of 1.4.9 build 110, with a monthly **test** subscription (it renews every 5 minutes):

- The server's period ended at 02:14:17. A relaunch at 02:14:25 got "0 subs" from Play.
- The app took premium off (`restorePurchases — Play holds no active purchases`) and showed a splash ad.
- At 02:16 Play said "1 sub" and premium came back.

## Why, from the code (`VC_108_VN_149` @ `630bba25`)

- `BillingRepositoryImpl.restoreHeld`: an empty answer with an OK code set `StoreVerdict.NONE` and called
  `recordStoreSaidNone`, which writes `is_premium = false`. One answer, acted on at once, whatever the phone was before.
- `adVerdictOf`: `NONE` with the flag off is `ALLOWED`, so the splash may show an ad.
- The account's grant (0041) could not cover it: its date is the plan's date, which had just passed, and the app asks
  the server again only after the splash.
- iOS does the same (`AppStoreBillingRepository.holdings`): the old period's transaction is filtered out as expired
  before the renewal's transaction arrives.

Play's list is its own copy on the phone; at the renewal moment it can be empty for a minute or two. A real monthly
or yearly renewal can open the same gap for a paying customer, once per renewal.

## What was decided

- **An empty answer on a phone the store did not call premium is acted on at once, exactly as before.** No ad changes
  for a free user.
- **On a phone it did call premium** (its own store flag, `hasStoreGrant`), the first empty answer starts a watch kept
  on disk (`store_none_since`), premium stays, and the store is asked again at 30 s, 2, 5, 10, 20 and 30 minutes.
- **Any answer that holds a purchase ends the watch.**
- **Only an empty answer 30 minutes or more after the first takes premium off**, recorded as today
  (`recordStoreSaidNone`, which also ends the watch).
- A watch dated in the future (a clock moved back) starts again from now.
- One shared rule, `StoreSaidNothing` in `domain/billing`, used by Android and iOS.
- Kill switch `store_nothing_watch_enabled` in Remote Config, on by default (PROJECT_RULES: every behavioural change
  has one). Off: every empty answer is acted on at once, as up to 1.4.8.

## Cost, measured against the gain

- **Gain:** a paying customer is never shown an ad, or loses premium, because Play's copy lagged a renewal.
- **Cost:** someone whose subscription truly ended, or was refunded, keeps premium and sees no ads for at most 30
  minutes more, once. Not measured yet: none of the three real buyers has lapsed, so today the cost is zero
  impressions. The window is the owner's to change.

## Rejected

- **Ask our server on every empty answer before acting:** a network call in the splash's 1.5 s, and the server answers
  for the Invotick account, not for what Play holds on this phone (a purchase held by another account).
- **Keep premium while the server's date is within N minutes:** the phone does not hold the server's date for its own
  purchase, only the account's grant, whose date is exactly the gap.
- **Play's `isAutoRenewing` or a pending state:** an empty answer carries no purchase to read them from.
- **Change the server's `offlineValidUntil` to add a margin after the plan's date:** that is the owner's own design
  (rule 9), and other devices of the account meet the same gap at a renewal. Asked as a question instead.
- **A new `StoreVerdict` value for "watching":** the saved flag already says premium, so the ads already read it as
  premium; a new value would touch the ads module for nothing.

## Open

1. The window: 30 minutes (recommended), or another length.
2. Other devices of the account (rule 9) lose the grant at the plan's date until they ask again after the splash; a
   short margin after a renewal date in the server's answer would close that too. The owner's design, so a question.

## Addendum, 2026-09-22 — the owner's answers, and the server's 30-minute margin

- **Q1 (the window): 30 minutes, as built.**
- **Q2 (other devices): yes.** The owner: the server keeps premium for 30 minutes past a subscription's `expires_at`,
  so linked devices do not lose premium at the renewal instant; a Google-reported cancel, refund, revoke or voided
  purchase ends it at once, with no margin. Rule 9 in `billing.md` is rewritten for it.
- **Built** on `invotick-apis` `feat/renewal-grace`, on top of `feat/purchase-test-flag`: `8b9e064`, 1,429/1,429. Not deployed.
  - `Entitlement.inRenewalMargin`: status `ACTIVE` or `GRACE`, date passed, less than 30 minutes ago. `holdsPremium`
    = live or in the margin; what a device is told (`premium`) reads it. Counts keep reading `isCurrentlyActive`.
  - `offlineValidUntil`: for `ACTIVE`/`GRACE` the plan's end is `expiresAt + 30 min`, both inside the refund window
    (still never past a day) and after it. `CANCELLED` keeps the plain date.
  - `currentEntitlement`: a passed date is still asked of Google first. Google's new date wins; Google's ending
    (`EXPIRED`, refund, revoke) ends it at once; only when Google gives no answer does a row inside the margin answer
    premium until the margin ends, where it used to be a 503.
- **Rejected:** the margin in `isCurrentlyActive` (it would move every count and the logs' premium label); a margin
  for `CANCELLED` (the owner: a cancel ends it); skipping Google inside the margin (its answer is the truth).
