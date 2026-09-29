# 0182 — What each user has earned us, ads and premium, on the All Users page

**Date:** 2026-09-28 · **Owner's decisions, same day** (relayed by the lead)
**Backend:** `feat/user-revenue` off `stage` — the SQL alone first (`V20260928_01`), the code after it. Not merged, not
deployed. **Schema: three new tables, additive; no existing table touched.** The Users list and the panel UI are
not changed by this branch (another agent is changing those files); what they need is at the end.

## What the owner decided
1. **Premium counts what reaches the owner:** the price, less tax, less the store's fee. Google's own net is used
   where its API gives it; otherwise the store's fee tier is applied. Every charge says which, and nothing is guessed
   silently.
2. **A refund counts as 0.** A cancelled auto-renew still counts what was paid.
3. **A yearly charge counts in full on the day it was charged.**
4. **The list shows lifetime revenue; the drill-down shows the last 30 days as well.**
5. **A guest's revenue rolls into the account it joins** after sign-up; the drill-down keeps the split.
6. **Yes to three new tables:** `user_revenue_day`, `user_revenue` and `purchase_charge`.
7. **Shown in USD.** Premium is converted at the charge day's rate, and the rate's date is frozen on the row.

**Rejected (the options these decisions chose against):**
- *The price the buyer paid (gross)* as premium revenue: it includes tax and the store's 15–30 %, money the owner
  never receives, so a premium user would look worth more than an ad user who earned the same.
- *Counting a refunded charge*, or taking it off the day of the refund instead of its own day: the charge day is
  where it was counted, so that is where it becomes 0.
- *Spreading a yearly charge over twelve months*: accrual accounting the page does not need, and a user who bought
  yesterday would show a twelfth of what they paid.
- *30 days in the list*: a paying customer from last month would sort below a guest who watched ads this week.
- *Keeping a guest's money on the guest row*: 96.6 % of users are guests; after sign-up the guest row is retired, and
  its money would disappear from the account the person actually uses.
- *Computing it on every page load from `analytics_events`*: the table has ~2 million rows, and the page that killed
  production on 2026-09-04 did exactly this (decision 0034).
- *Showing each charge in its own currency*, or *converting at today's rate every time it is read*: a total over
  AUD, EUR and USD cannot be added, and a figure that moves with every rate refresh is not a record.

## How it is built

### `purchase_charge` — one row per store order
- A renewal is a new order (Google `<base>`, `<base>..0`, `<base>..1`…; Apple a new transaction id), so each is a row.
- **Google:** register, restore, a device's check, the daily check and a Play notification already get Google's
  answer, which names the current order. The order ids up to it are kept at once with no money (`fetched_at`
  NULL); the revenue job then asks the **Orders API** (`orders.get`) for `total`, `tax`,
  `developerRevenueInBuyerCurrency` and any refund. **No device request waits on it**, and a failure never touches
  premium (written after the caller commits, in its own transaction, errors swallowed and logged).
- **Apple:** the signed transaction carries `price` (milliunits) and `currency`, so the row is written whole.
- **`net_source`:** `STORE_REPORTED` (Google's net: after tax, fee and partial refunds), `FEE_TIER` (Google gave no
  net: price after tax less `revenue.fee.google-play`, 0.15), `FEE_TIER_TAX_UNKNOWN` (Apple states no tax, so none is
  taken off; price less `revenue.fee.apple`, **0.30**, Apple's standard rate — 0.15 only in the Small Business
  Program; the owner's to confirm).
- **USD:** converted by the job at the rate the rates service holds at that moment; `usd_rate` and `rate_date` (the
  rate's own date) are frozen on the row. For a charge kept within minutes this is the charge day's rate. **For the
  backfill it is not:** the rates service keeps no history, so the 4 real purchases of September are converted at
  the rate of the day the backfill runs, and each row says that date. USD needs no rate (`rate_date` = charge day).
- **Refund:** Google's voided purchase (notification or the daily list) sets `refunded_at` on **that exact order**,
  also in the daily check's dry run — a label on our own count, not a change to anyone's premium. The order's own
  `state = REFUNDED` does the same. Apple's latest signed word sets or clears it.
- **Test purchase:** `test_flag` is the store's word (0156), copied from `purchase_identity.test_purchase` and kept in
  step each run; TRUE counts 0, NULL counts as real.
- **Backfill:** `POST /v2/admin/revenue/charges/backfill` — dry by default, it asks each purchase's store and each
  order's money and lists them; `{"apply": true}` keeps them. It uses the same Play permission as the defer endpoint
  ("View financial data") — nothing new to grant. Apple needs the App Store Connect key, which production does not
  have; there are 0 Apple purchases.

### `user_revenue_day` — per user id, per UTC day
- **Ads:** `ad_impression_value` rows that **arrived** (`created_at`) after the job's watermark, read through
  `(created_at, event_name, user_id, app_instance_id)`; the day is the arrival day (some `event_timestamp`s are in
  the future). Release builds only; our own phones and accounts (`health.our-own.*`) and `testing_devices` left out;
  currency USD only (it has never been anything else — a non-USD row is left out, not converted by guess).
  `precision = 0` rows pay 0 and are not counted as impressions. An event with no user is kept under the all-zero id:
  **unattributed**, shown apart on the summary.
- **Premium:** each `(holder, charge day)` whose charge changed is **set** from `purchase_charge`, never added to.
- `earned_as_user_id` never changes; `user_id` is the account it belongs to now, moved when a guest joins one.

### `user_revenue` — per account, lifetime
Recomputed from the day rows of every account a run touched. `from_guests_micros` is the part earned under guests
that joined it. Indexed by total, ads and premium for a list sorted by any of them.

### The job — every 10 minutes (`UserRevenueJob`)
Charges asked (≤ 50 orders a run) and converted → ads added in windows of ≤ 6 h, each window **one transaction with
the watermark that ends it**, its row locked so two runs take turns → changed charge days set → guests that joined an
account folded into it. The window ends 2 minutes before now. A crash mid-run leaves the watermark at the last whole
window: nothing is added twice or missed. The first run is the one-time rebuild (from 2026-07-01, 21,450 events, ~360
windows); `POST /v2/admin/revenue/rebuild` empties both rollups and does it again.

**Cost per run, measured on production 2026-09-28:** ~415 index entries of `analytics_events` (60k arrive a day) and
~10 rows opened (1,409 `ad_impression_value` a day at most); `purchase_charge` whole (one row per order, about 15 after the backfill) for the test-flag step;
181 upgraded guests through `idx_users_upgraded_to_user_id` for the fold step.

**Rejected here:**
- *Recomputing each touched day from the events* instead of adding the new arrivals: a day of arrivals is ~60k index
  entries per run instead of ~415, for no gain once each window and its watermark commit together.
- *Asking Google for the order's money inside register/restore*: a second Google call on the buyer's request, and a
  second way to fail next to the purchase.
- *A fourth table for the watermarks*: the owner approved three; `processing_state` already holds "when did this
  last happen" marks (two new keys).
- *Taking a percentage off Apple's price as tax*: tax differs by storefront; the row says the tax is unknown instead.

## The account erase (0111)
`user_revenue_day` and `user_revenue` are erased with the account (by `user_id`; a guest's days sit under the account
it joined). `purchase_charge.user_id` is kept, like the purchase and its binding log: the store's record, an id only.

## What the Users list needs (the lead integrates)
- `LEFT JOIN user_revenue ur ON ur.user_id = u.id`; `COALESCE(ur.total_micros, 0)` (and `ad_micros`,
  `premium_net_micros`) for the columns. No row = earned nothing.
- **Sort by revenue:** drive from `user_revenue` (`FORCE INDEX (idx_user_revenue_total) ORDER BY total_micros DESC`),
  or use `GET /v1/webpanel/revenue/users?page&size`; users with no row follow.
- **Or without touching the list query:** `GET /v1/webpanel/revenue/lookup?ids=` (≤ 200) for the page shown.
- **Drill-down:** `GET /v1/webpanel/revenue/users/{userId}` — lifetime and 30 days by ad type and premium, the
  guest/account split, the last 30 days, and each charge with `net_source`, `rate_date` and whether it counts.
- `GET /v1/webpanel/revenue/summary` — all accounts, unattributed, and how far the job has counted.
- All money is **USD micros** (÷ 1,000,000).
