# 0140 — A daily check with Google Play, so notifications are never the only road

**Date:** 2026-09-21
**Status:** built on `invotick-apis` branch `feat/play-daily-reconcile` (`2febbef`, on `stage` 6bf2d78), pushed,
**not deployed**. Ships **in dry-run**: it writes nothing until `BILLING_PLAY_DAILY_CHECK_APPLY=true` is set on the
owner's word, after the first dry run has been read.
**Tier 1** (money and trust, goal G3). Part 4 of the "complete solution" the owner approved after 0139.

---

## Why

0139 proved Google's notifications had never reached us for the tables' whole life. They are wired now (test
notification 2026-09-21 07:42:34 UTC → 200), but they can break again without a sound, and the only other road —
a device of that account asking us — misses a user who stops opening the app, an expiry on a quiet phone, and
above all **a refund or chargeback, which Google's subscription record has no state for**.

So once a day we ask Google ourselves, whatever did or did not arrive.

## What it does

1. **Refunds first.** Google's Voided Purchases list (`purchases.voidedpurchases.list`, `type=1` so subscriptions
   are included — Google's default leaves them out), every page. Each entry is applied **by the same code the
   `voidedPurchaseNotification` uses**: that logic moved out of the controller into `PlayVoidedPurchases`, and both
   roads call it. Keyed by `baseOrderId` then the purchase token (rule 5). A quantity-based partial refund is
   left alone, as before.
2. **Then every grant that is, or may still become, premium** — `ACTIVE`, `GRACE`, `ON_HOLD`, `CANCELLED`, Google
   Play only — is asked of `subscriptionsv2` (or the one-time endpoint for a lifetime) and written through **the
   same writer a device's check uses** (`googlesWordOn` + `EntitlementService.write`). Expiry moves, cancelled,
   on hold, paused (read as `ON_HOLD`), expired.

**Window N = 30 days.** It is Google's whole window: the list only ever holds purchases voided in the last 30
days, and a `startTime` older than that is refused or ignored. So we send none and take Google's default, which
is exactly those 30 days. Run daily, that is 29 days of overlap: the check can miss 29 days in a row and still
see every refund.

## The rules it keeps

- **Only Google's answer changes a row** (rule 3). "Could not ask" — our key refused, Google busy, a token
  lookup that failed — changes nothing. A run in which Google answered nothing at all is **not** recorded as a
  good run, so the card cannot go green on it.
- **Never deletes.** A status and a date change; an ending writes `revoked_at` and a `revoked_reason` naming the
  daily check and the date. A live word never overwrites `REFUNDED` or `REVOKED`.
- **Safe to run twice.** A row that already says what Google says is not written. A refund already applied is
  not written again — before this, a second telling (Pub/Sub redelivers) rewrote `revoked_at` every time, and
  the voided list tells us again for 30 days.
- **Dry run by default.** `billing.play-daily-check.apply=false`. The scheduled run then reports and writes
  nothing at all — not even `last_verified_at`. `POST /v2/admin/billing/daily-check` (ADMIN only) runs both
  halves on demand and returns every row; `{"apply": false}` is its default too.
- **A brake.** More than 5 endings **and** more than a quarter of the rows asked → no ending is written that run,
  and the card is red. A wrong package name, or a lifetime list emptied by a deploy, makes Google refuse every
  purchase, and those refusals look final. A day's delay costs nobody anything.
- **A lifetime is never asked** while `GOOGLE_PLAY_LIFETIME_PRODUCTS` does not list it (known gap 2): the
  subscription endpoint would refuse it and that refusal would end a paid-for lifetime.
- **Legacy rows** (kept before tokens were, 2026-09-11): the token is fetched from Google's order and **not
  stored**. `GPA.3309-6770-7742-40436` and `GPA.3309-6770-7742-40436..2` are one subscription held twice
  (from before rule 5); storing the token on both would make the refund-by-token lookup ambiguous.

## When it runs, and what it costs

A tick every hour from 10 minutes after start; it runs when this process has not run yet, or the last good run
is 20 hours old. So it runs once a day, a missed run is made up within the hour, and each restart runs it once.

Cost: one Google call per live grant (6 rows today, 250 ms apart, `max-rows` 1,000, the one asked longest ago
first), plus one voided-list call per 1,000 refunds. Google's quotas: 200,000 a day for the Publisher API, 6,000 a
day and 30 per 30 s for the voided list.

**No migration.** The last good run of each half is a `processing_state` key (`play_daily_check_ok_at`,
`play_voided_read_ok_at`). The last run's counts and rows are one object in memory, rebuilt by the run each
restart makes. Every change is also a `[BILLING] daily check` log line.

## The Health Centre

New sibling check **`play-daily-check` — "Google Play daily check"**, drilling down to `/billing-health`. No page.

- **CRITICAL** — either half has not finished a good run for **36 hours** (a daily run with half a day's slack),
  or has never finished one on a server up that long.
- **CRITICAL** — Google refused the refunds read with 401/403. The card names the permission to tick.
- **CRITICAL** — the brake held endings back.
- **WARNING** — dry run, and it would correct rows ("apply is the owner's word"); switched off; or not run yet
  just after a deploy.
- **OK** — otherwise, with the facts: mode, last good run of each half, grants asked, corrected (or would
  correct), unanswered, refunds listed / applied / not ours.

"Store notifications" (0139) is unchanged: it watches whether Google is talking; this watches whether we are
asking.

## Permission: can the same key read refunds?

The Voided Purchases list needs **"View financial data, orders, and cancellation survey responses"** on the
service account (Play Console → Users and permissions). The Orders API needs the same permission, and it is
already in use: `orders.get` found the first customer's token for the 2026-09-11 defer, and `orderCreatedAt`
reads every renewal's charge time (0041). **So the key almost certainly can** — proven only by the first run. If
not, the card turns red with Google's 403 and the steps below.

Play Console → **Users and permissions** → the service account's row (its email ends in
`.iam.gserviceaccount.com`) → **App permissions** tab → **Invotick** (or the **Account permissions** tab, for every
app) → under *Financial data*, tick **"View financial data, orders, and cancellation survey responses"** →
**Apply** → **Save changes**. Google can take up to a day to honour a new permission.

## The dry run against production — what was and was not possible

Asked for before building. **Not possible from here without a credential:** the rules allow Google only through
our own endpoints; the admin token in memory is dead since 2026-09-19; and the daily check itself is the first
endpoint that asks Google about every row. What *was* read (production SQL, read-only, 2026-09-21):

| Purchase | Our row | Google's last answer we hold | Expected |
|---|---|---|---|
| GPA.3389-5014-8213-64085 (first customer, yearly) | ACTIVE to 2027-09-10 11:44:44.841 | asked 09-20 17:52 UTC | unchanged |
| GPA.3321-6983-3803-03239 (monthly) | ACTIVE to 2026-10-19 02:26:17.729 | asked 09-20 18:57 UTC | unchanged |
| GPA.3394-8951-1581-91759 (yearly) | ACTIVE to 2027-09-20 19:38:27.756 | asked 09-21 05:05 UTC | unchanged |
| GPA.3309-6770-7742-40436 (owner test) | ACTIVE to 2026-08-27 11:22, **no token** | never since 08-27 | → EXPIRED |
| GPA.3309-6770-7742-40436..2 (same subscription, held twice) | ACTIVE to 2026-08-27 11:37, no token | never | → EXPIRED |
| GPA.3373-2580-0268-46036 (owner test) | ACTIVE to 2026-08-27 12:13, no token | never | → EXPIRED |

The real rows' dates were written from Google's own answer within the last 28 hours. **The proven dry run is the
first scheduled run after deploy** (10 minutes in, writing nothing), or the admin endpoint with `apply=false`.
Stop condition, as asked: if it would change anything other than the three test rows, apply stays off and the
rows are reported instead.

## Apple — before the first iPhone sale (not built here)

The daily check covers Google Play only; there are 0 App Store purchases. For the App Store the owner does two
things in App Store Connect, **before** the first sale:

1. **Notification URL** — App Store Connect → **Apps** → Invotick → **App Information** (left, under *General*) →
   **App Store Server Notifications** → *Production Server URL* **and** *Sandbox Server URL*, both
   `https://stage.invotick.com/v1/billing/apple/notifications`, **Version 2** → Save. (Sandbox is accepted, because
   App Review buys there.)
2. **The In-App Purchase key**, so the server can ask Apple after the sale — App Store Connect → **Users and
   Access** → **Integrations** tab → **In-App Purchase** (left) → **Generate In-App Purchase Key** (or +) → name
   "Invotick server" → **Generate** → **Download** (the `.p8` downloads **once only**). Three values:
   - `APPLE_ISSUER_ID` — the *Issuer ID* shown at the top of that same page;
   - `APPLE_KEY_ID` — the *Key ID* in the new key's row;
   - `APPLE_PRIVATE_KEY` — the `.p8` file's whole text, line breaks written as `\n`.

   They go in `.env.prod` on the VPS and the app service is recreated. The boot log then says
   `App Store Server API armed`. Never paste them into chat or git.

## Rejected

- **Trusting a stored answer as the dry run.** The table's last answers are hours old and the three test rows
  were never asked; a dry run has to ask Google today.
- **Going round our endpoints with the service-account key, or hunting for a token.** Against the billing rules;
  the dry run rides the deploy instead, writing nothing.
- **Applying from the first run.** The owner's rule: the dry run is reported first.
- **A run-history table.** It would have been a migration, and a migration travels alone; two `processing_state`
  keys plus the log carry what the card needs. Worth it if the owner wants a history page.
- **Storing the token fetched for a legacy row.** Two rows share it; see above.
- **Skipping rows a device asked about recently.** Six rows; asking every one is simpler and cannot miss.
- **A startTime older than 30 days**, or a window shorter than Google's: the first is refused or ignored, the
  second loses refunds whenever a run is missed.
- **Folding this into "Store notifications".** That card is about Google talking to us; this one is about us
  asking. Two questions, two cards, no page.
- **A brake on refunds.** A refund in Google's list is Google's explicit word about that purchase; a mass refund
  is real and must land.

## Open — the owner's

1. After reading the dry run: turn apply on (`BILLING_PLAY_DAILY_CHECK_APPLY=true` in `.env.prod`, recreate)?
2. **A refund of one renewal** (e.g. `..1` of a monthly that keeps renewing) ends the whole grant — that is
   0139's rule for the notification, and this check now reaches it for 30 days. Google may still show the
   subscription as live. Keep it (money back = premium off), or re-ask `subscriptionsv2` and end only when Google
   also revoked it?

## Files

- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/PlayDailyCheck.kt` (new)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/PlayVoidedPurchases.kt` (new; the refund rule, shared)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/health/PlayDailyCheckHealth.kt` (new)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/EntitlementService.kt` (`googlesWordOn`, one writer, `applyDailyCheck`, `heldPlayStatus`)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/PlaySubscriptionAdmin.kt` (`voidedPurchases`)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/service/billing/PlayPurchaseVerifier.kt` (`isLifetimeProduct`)
- `invotick-apis/src/main/kotlin/dev/backend/infotick/controller/billing/PlayNotificationController.kt`, `BillingAdminController.kt`
- `invotick-apis/src/main/kotlin/dev/backend/infotick/repository/billing/EntitlementRepositories.kt` (`findIdsForDailyCheck`)
- `application.properties`, `docker-compose.yml` (`BILLING_PLAY_DAILY_CHECK_APPLY`, default false)
- Tests: `PlayDailyCheckTest` (16, production's six rows as the fixture), `PlayDailyCheckHealthTest` (9),
  `VoidedPurchasesPageTest` (3), `PlayNotificationsAreHeardTest` +1. **8 go red** with the matching safeguard
  removed. **Full suite 1,297/1,297**, `SpringContextBootTest` and `MigrationsApplyToLiveSchemaTest` included.
