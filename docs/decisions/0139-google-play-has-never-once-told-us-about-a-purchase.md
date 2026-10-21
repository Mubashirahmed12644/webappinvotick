# 0139 — Google Play has never once told us about a purchase

**Date:** 2026-09-21
**Status:** decided; server half built on `invotick-apis` branch `fix/play-notifications-arrive`, **not deployed**.
The two links outside this repository are the owner's consoles.
**Tier 1** (money and trust, goal G3). Asked for by the owner on 2026-09-20: *"find out why Google Play's
billing notifications never reach us, and fix it."*

---

## What was found

`POST /v1/billing/play/notifications` — the endpoint Google calls when a purchase changes after the sale
— **has never been called.** Not once, by Google, ever.

### The evidence, and how far back it can be trusted

| Source | Window it can actually answer for | What it says |
|---|---|---|
| nginx access log, `stage.invotick.com` | **12 Sep 2026 23:58 → 20 Sep 20:12 UTC**, complete, 8 daily files | **0** requests to `/v1/billing/play/notifications`. The only two lines in it are my own probes on 20 Sep 20:13. In the same window: 681 `GET /v1/billing/entitlement`, 145 restores, 135 purchase registrations — so billing traffic was flowing and only this path was silent. **No Google or Pub/Sub user agent appears at all**, on any path. |
| Every other vhost on the box (`gw`, `go`, `grafana`, `excahnge`, `clp`, and Jariya's) | same 8 days | 0. The message was not being delivered to a different hostname either. |
| `entitlement` + `purchase_identity` in production | **the whole life of the tables, from 27 Aug 2026** | Decisive. Three test subscriptions bought on 27 Aug **expired five minutes later** and are still recorded `ACTIVE` 24 days on, `revoked_at` NULL, `last_verified_at` frozen at the minute of purchase. Play sends `SUBSCRIPTION_EXPIRED` for every one of those; had a single one arrived, the handler would have written `EXPIRED` and a `revoked_at`. **In the entire table, no row has ever been revoked, expired, refunded, cancelled, put in grace or put on hold.** |
| Loki | not usable | It answers for 22–23 Aug and returns nothing for the recent weeks — the log pipeline is dark again (`memory/log-pipeline-stream-limit.md`). **It is not evidence either way**, and is recorded here so nobody later reads its silence as proof. |

So: **certain** for 8 days from nginx, and **certain for 25 days from the data**, because a delivered
notification leaves a row behind and there is not one.

### The chain, link by link — and which link is broken

Play does not call a URL. It publishes to a **Google Cloud Pub/Sub topic**; a **push subscription** on
that topic is what turns the message into an HTTPS request to us.

| # | Link | State | Proven how |
|---|---|---|---|
| 1 | Play Console → Monetisation setup → Real-time developer notifications: a topic name | **unknown — needs the owner's screen** | Not visible from outside the console. |
| 2 | Google Cloud → Pub/Sub → a topic, and a **push** subscription pointing at our URL | **not delivering** | Zero requests ever reached the box. Whether the topic is absent, or exists with no push subscription, or has one aimed elsewhere, only link 1's screen can separate. |
| 3 | The URL, TLS and nginx | **WORKING** | Probed 20 Sep 20:13 UTC: `POST https://stage.invotick.com/v1/billing/play/notifications` → TLS verified (`ssl_verify_result=0`), nginx routed it, the handler ran and answered. The route is on `security.public-paths` and in `PublicRoutes`. |
| 4 | The handler's shared secret | **BROKEN, and ours** | `GOOGLE_PLAY_RTDN_SECRET` has never been set anywhere: absent from `.env.prod` on the VPS, absent from `docker-compose.yml`, and `printenv` inside `invotick-server` reports it **not set**. The handler refuses on a blank secret, so **every notification Google might have sent would have been answered 403 and thrown away.** Both probes returned 403. |
| 5 | What the handler does with a message it accepts | **three ways to lose one** | See "What was wrong in our code" below. |

**Two links are broken at the same time, not one.** Fixing the consoles alone would have produced a
perfect delivery, a 403, and the same silence — with the added cruelty that Pub/Sub would have retried
for a week and then dropped the refund for good. That is why the fix has to be done in one order:
**secret first, console second.**

### Was the test-notification button ever pressed?

No. A press sends a `testNotification` message through the same chain, so it would appear in the nginx
log as a request (and as a 403). There is none.

---

## What it has cost so far — production, read-only, 2026-09-20 20:00 UTC

| | |
|---|---|
| Purchases ever made, all Google Play | **6** |
| Live right now | **3** — the first customer's yearly (to 2027-09-10), one yearly bought **20 Sep** (to 2027-09-20), one monthly bought **19 Sep** (to 2026-10-19) |
| Entitlement rows saying `ACTIVE` | **6 of 6** |
| Rows ever moved by a store's word | **0** |
| Rows saying `ACTIVE` whose own date has already passed | **3** (all three 27 Aug test subscriptions, wrong for 24 days) |
| Real customers harmed so far | **0** — nobody has cancelled, refunded or charged back yet |

**Nobody has lost money or premium over this.** What was lost is the ability to know. And the exposure
has just tripled: there was one paying customer when this was last looked at, and there are now three,
two of them on year-long plans.

### How we learn about a cancellation today, and what that misses

One channel only: **a device of that account asking us.** `GET /v1/billing/entitlement` makes the server
ask Google about a live grant (at most once per purchase in ten minutes), and a passed date is asked
about before we say no. The three live purchases were last asked of Google 0, 1 and 2 hours ago —
because their owners had the app open.

What that channel cannot see:

- **A user who stops opening the app, or uninstalls.** Nobody asks, so our row stays `ACTIVE` until the
  plan's date — up to a year for the two yearly customers. The three 27 Aug rows are this failure,
  already visible.
- **A refund.** This is the worst of them. Google's subscription record has **no refunded state**: a
  purchase refunded without being revoked still reads as a live subscription, so asking Google harder
  does not help. `voidedPurchaseNotification` is the **only** way we can ever learn — the exact message
  we have never received.
- **A chargeback.** Same message, same blindness.
- **An expiry when the phone is quiet**, as above.
- Cancellations where the user keeps using the app *are* seen, because the state does change and a
  device does ask. That is the one part of this that has been working.

---

## What was wrong in our code, and is now fixed

Four defects, each of which loses a message that did arrive. All are on
`invotick-apis` branch `fix/play-notifications-arrive`.

1. **A refund of a renewal could never find its purchase.** The voided-purchase message names the order
   of the charge that was refunded, and a renewal's order is `<base>..1`, `<base>..2`; the purchase is
   stored under `<base>` (rule 5, decision 0048). The handler looked it up under the id as sent, found
   nothing, and logged nothing worth reading. It now keys on `baseOrderId(...)` — the function that
   exists precisely because this was already fixed once, on the subscription path — and falls back to
   the purchase token the message also carries.
2. **A message Google could not be asked about was dropped.** "Google refused this purchase" and "we
   could not reach Google" shared one silent return. The first is an answer; the second is not, and
   dropping it loses that change for good. A refusal is now a 200 and a warning, and a could-not-ask is
   a **500**, which makes Pub/Sub deliver it again.
3. **Play's own test notification left no trace.** It fell through every branch and returned 200 in
   silence, so the owner's "Send test notification" button — the one thing that proves the whole chain —
   proved nothing. It is now logged and journalled.
4. **Nothing recorded that a notification had ever arrived, or been refused.** That is what made 25 days
   of silence invisible. Two marks are now written to `processing_state` (the existing "when did this
   last happen" table — a key and a time, **so no migration**): one when a message is accepted, one when
   it is turned away. They are separate because they need opposite fixes: nothing arriving means the
   wiring outside our server is not built; arrivals being refused means it *is* built and the secret does
   not match.

Also hardened, none of it a behaviour change anyone can see:

- **Idempotency.** Google retries. Handling was already idempotent by re-verification; the Pub/Sub
  `messageId` is now remembered as well (a bounded 500-entry set in memory, named in the code, not
  stored — losing it on a restart costs one extra call to Google and changes no outcome). An id is
  remembered only after the message is dealt with, so a delivery we answered 500 to is retried, not
  skipped.
- **A quantity-based partial refund no longer takes premium away.** It refunds part of a multi-quantity
  one-time purchase, not the right to use the app.
- **A notification naming another app's package is ignored**, so a stranger's topic aimed at our URL
  cannot revoke our customers even if the secret leaked.
- **A blank secret is now an ERROR line that says what it is costing**, not a warning about a bad caller.
- Google's `notificationType` numbers are logged in words (`RENEWED`, `CANCELED`, `EXPIRED`, …).
- `GOOGLE_PLAY_RTDN_SECRET` is named in `docker-compose.yml`, so "which secrets does billing need" can be
  answered from the repository rather than from a server nobody can see.

**Nobody's billing state was touched.** Every production query was read-only, and no Google-side call was
made beyond the two 403 probes of our own endpoint.

## The Health Centre card, so this cannot be silent again

New `HealthCheck` component **`store-notifications` — "Store notifications"**, drilling down to
`/billing-health`. Never a page of its own. It covers **both** stores, so the App Store does not need a
card of its own either.

Verdicts, and why each threshold is what it is:

- **CRITICAL — the secret is not set.** Nothing can ever arrive. This is the state production is in today.
- **CRITICAL — a store has sold something and has never said a word.** This is the state production is in
  today.
- **CRITICAL — messages are arriving and being refused.** Different wording and a different fix: the
  token on the push URL does not match ours. Without the two separate marks this is indistinguishable
  from the line above, which is the mistake that made this 25 days long.
- **CRITICAL — a sale with nothing after it.** The newest purchase is older than **24 hours** and no
  notification has arrived since. Google sends `SUBSCRIPTION_PURCHASED` within seconds, so a day is a
  hundredfold margin. **This is the rule that matters**, because it asks whether a message followed a
  known event rather than counting days of quiet — it works at six purchases a month and at six thousand.
- **WARNING — plain silence longer than 35 days.** Justified by the real volume: with three live
  subscriptions, the only message guaranteed to repeat is a renewal, and the shortest plan renews
  monthly. Thirty-one days of quiet can be perfectly healthy; 35 gives that slack. Deliberately the
  weaker of the two rules.
- **OK — a store that has never sold anything.** The App Store today. A permanent red badge for a shop
  that is not open yet is how a dashboard stops being read.

## Is the App Store blind in the same way?

**Structurally yes, in practice not yet — and it will be worse when it matters.**

- `/v1/billing/apple/notifications` has received **one** call ever: a `curl` from a Pakistani address on
  18 Sep at 18:42 UTC, answered 400 (no `signedPayload`). Nothing from Apple.
- Nothing has been sold through the App Store: **0 `APPLE_APP_STORE` purchase rows.** So there is nothing
  for Apple to report, and today's silence costs nothing.
- There is **no equivalent trap**: Apple's endpoint is protected by Apple's signature, not by a secret of
  ours, so there is no unset value that can close the door.
- **But the dependence is stronger.** `APPLE_ISSUER_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` are all
  empty in production, so the server cannot ask Apple anything after the sale. Until that key exists,
  **notifications are the only channel Apple has**, and Apple's refund window is 14 days against Google's
  48 hours. The notification URL in App Store Connect must be set **before** the first iPhone sale, not
  after.
- The same journal marks and the same card cover it from today, so the first sale will prove the wiring
  instead of hiding a gap.

---

## What the owner has to do (the two links that are not ours)

Plain steps in the report. In short: name a Pub/Sub topic in Play Console, create a **push** subscription
on it in Google Cloud pointing at our URL with the secret on the end, and press **Send test notification**.
Google Cloud project `invotick-invoicemaker` already exists (it is where the Play verification key lives).

**Order matters.** The secret goes into `.env.prod` and the app service is recreated **before** the push
subscription is created, or the first delivery is refused and the card turns red for the wrong reason.

---

## Rejected

- **Trusting the notification's own account of what changed.** It is not a reliable statement of the
  resulting state and messages arrive out of order. Google is re-asked every time. Kept from the original
  design.
- **Verifying Pub/Sub with a Google-signed OIDC token in the `Authorization` header** instead of a secret
  on the URL. More correct, and it removes a secret from a URL. Rejected *for now*: it needs JWT
  verification code and more console steps for a non-developer, and the query-secret path is already
  built and already reasoned about. Worth revisiting when the panel has a reason to touch this again.
- **Letting a blank secret through so that notifications are at least received.** That endpoint can end a
  paying customer's premium. An open door is a worse failure than a closed one; the answer to a closed
  door is to make it visible, which is what the card does.
- **Answering 200 to everything, as before.** It is why a message Google could not be asked about
  vanished. A 500 costs a retry; a dropped refund costs a customer's money staying with us.
- **A new table for the notification journal.** `processing_state` already stores "when did this last
  happen" as a key and a time. A migration for two rows would have been a migration for its own sake, and
  a migration must travel alone.
- **A separate Health Centre card for the App Store**, or a page for either. Standing rule: a check is a
  `HealthCheck` component, and a page is a drill-down behind a card.
- **Backfilling the three stale 27 Aug rows.** They are test purchases, they belong to nobody paying, and
  nothing may touch a customer's billing state without the owner's go. They will correct themselves the
  first time anything asks Google about them.
- **A purely time-based alarm ("no notification in N days").** At three live subscriptions it cannot fire
  sooner than a month without being wrong, which is useless for catching a break. The sale-with-no-message
  rule is what makes the card work at this volume.

## Files

- `invotick-apis/src/main/kotlin/dev/backend/infotick/controller/billing/PlayNotificationController.kt`
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/StoreNotificationJournal.kt` (new)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/health/StoreNotificationsCheck.kt` (new)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/EntitlementService.kt` (`applyStoreStatusByToken`)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/repository/billing/EntitlementRepositories.kt`
- `invotick-apis/src/main/kotlin/dev/backend/infotick/controller/billing/AppleNotificationController.kt`
- `invotick-apis/docker-compose.yml`
- Tests: `PlayNotificationsAreHeardTest` (14), `StoreNotificationsCheckTest` (8). Red before the fix:
  4 of them fail on the old behaviour (the renewal refund, the partial refund, the dropped
  could-not-ask, and its retry). **Full suite 1,268/1,268 green**, `SpringContextBootTest` and
  `MigrationsApplyToLiveSchemaTest` included.
