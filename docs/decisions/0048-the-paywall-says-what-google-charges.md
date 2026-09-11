# 0048 — What the paywall says is what Google charges; a refusal is final only when Google gives it

**Status:** decided, built (backend live 2026-09-11; app: next release 1.4.5, versionCode 100) · **Date:** 2026-09-11 · **Goals:** G3
(trust), monetisation · **Related:** [0047](0047-plays-answer-decides-premium-on-a-device.md)

## What happened

- In Play Console, `yearly_subscription`'s only base plan, `yearlysubscription`, had been **Monthly,
  auto-renewing** since 2026-05-21. The paywall printed "/ year" over it — a label chosen from the
  product's id — and the literal "Save 58% vs monthly", while Google's own purchase sheet said
  "/month". The first annual customer (2026-09-10) paid AUD 21.99 believing it bought a year; Google set
  his renewal for 2026-10-10.
- The owner fixed the store the same day: a new base plan `annual` (Yearly, auto-renewing, 174
  countries) and `yearlysubscription` deactivated. A base plan's period cannot be changed once it is
  active, hence a new plan; a new product id was not an option because every installed app asks only
  for `yearly_subscription`.
- Fixing it exposed three more things:
  - the server never stored purchase tokens, which any admin action needs;
  - it answered 400 both when Google refused a purchase and when it could not ask Google, so a genuine
    buyer during a Google hiccup was told the purchase failed;
  - a restore that got no answer fell through to register, which moves the purchase onto whoever sends
    it.

## Decision

1. **The paywall prints what Google will charge.** Price, period and saving come from the offer the app
   actually buys (`chosenOffer`): its recurring phase's `billingPeriod` and `priceAmountMicros`. The
   saving is computed, and hidden when the plans cannot be compared honestly. Never from a product's
   name.
2. **An admin can defer one customer's renewal:** `POST /v2/admin/billing/subscriptions/defer` (ADMIN).
   It goes order id → token (Orders API) → subscription and etag → `subscriptionsv2.defer`.
   `validateOnly` defaults to true, the etag stops a double deferral, and our entitlement takes Google's
   new expiry at once.
3. **A refusal is final only when Google gives it.**
   - 400 when Google rejected the token, the purchase is not completed, or it has expired.
   - 503 when we could not ask: not configured, our key refused, or Google unreachable. A restore answers
     `UNVERIFIED` in that case.
   - The app reads 503 and `UNVERIFIED` as "unknown": Play's word stands, and premium is granted as
     unconfirmed.
4. **A final refusal takes back only an unconfirmed grant** — the one a billing emulator gets by faking a
   purchase while our server cannot be reached. A confirmed grant is never taken back by a refusal.
5. **A restore with no answer is not registered.** Whose the purchase is was the unanswered question.
6. **The server keeps the token and every restore answer** — one row per purchase, account and device.
   - The Health Centre shows "premium through another account's purchase" and "purchases used by more
     than 5 accounts" (a warning, never enforced).
   - "Enabled without payment" no longer counts the former.

## The first customer

- **Deferred, 2026-09-11.** Google's dry run first ("Validated by Google — nothing changed"), then the
  real call: his next charge moved from 2026-10-10 to **2027-09-10 11:44:44.841 UTC**,
  `serverUpdated: true`, and our stored `entitlement.expires_at` reads the same. He paid for a year and
  gets one; no refund.
- His subscription stays on the deactivated monthly plan, so on 2027-09-10 it renews for one month at
  the same price, and again every month, unless something is done first. Deferring again with no charge
  in between would give a year away, so the options are:
  - let that one renewal charge him, then defer the month it bought to 2028-09-10;
  - move him to `annual` (an in-app switch, not built).

  Decide before 2027-09.

## Rejected

- **Changing the old base plan's period** — Play does not allow it once the plan is active.
- **A new product id** — invisible to every installed app until an update.
- **Refunding and asking him to buy again** — the owner ruled out refunds, and he would lose premium in
  between.
- **Revoking premium on any refusal** — one server misconfiguration would strip every paying user.
- **Reading the refusal from its message** — codes, not messages; the HTTP status is the code.
- **Leaving both base plans active** — the app buys the cheapest first phase, so the monthly plan would
  keep selling.

## Consequences

- The service account needs "View financial data, orders…" and "Manage orders and subscriptions" in Play
  Console.
- Apps older than the next release (1.4.5, versionCode 100) read `UNVERIFIED` as their own UNKNOWN (the same behaviour), and still take a 503
  for a refusal until they update — exactly what they did with the old 400.
