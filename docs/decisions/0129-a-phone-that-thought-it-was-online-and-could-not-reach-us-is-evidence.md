# 0129 — A phone that thought it was online and could not reach us is evidence, not weather

**Status:** **decided by the owner, 2026-09-20 — the card goes red** (see §6). Built on two branches, pushed, not
merged, **not deployed**. App `fix/147-a-phone-that-thought-it-was-online` (off `VC_107_VN_147`), `dd5b408b` +
`e31c98ba`, `:data:testDebugUnitTest` **332/332**, Android and iOS-simulator compiles pass. Backend
`fix/a-phone-that-could-not-reach-us-is-named` (off `origin/stage` `0fd4e3f`), **`3f9d4ee`**, full suite
**1238/1238**. No migration, no schema change, no version bump.

**Asked by the owner, 2026-09-20,** from a second device: Invotick ID 941940223, user `96c2fafa`, phone `2b9630b7`,
1.4.4, Bangladesh, installed from a Facebook campaign. Four `sync_failed` rows on 2026-09-12, `stage=pull_failed`,
`Unable to resolve host "stage.invotick.com"` — **every one of them carrying `net_online=true`, `net_type=wifi`,
`net_speed=over_5m`**. His question: would he ever see this on the Health Centre?

**Related:** 0029 and 0125 (a failure while offline is not reported), 0050 (the evidence net), 0034 (Health Centre
checks are components, never pages); sync agent rules 1, 7, 8; memory `isp-block-cloudflare-fix`.

## 1. The Health Centre: no, he would never see it — and the one line that mentions it is wrong

- The check is **`SyncFailureCheck`**, id `sync-failures`, card **"Device sync"**, drill-down `/sync-health`. It runs
  every 30 minutes over a **7-day** window. It counts **devices**, not occurrences: **CRITICAL at 10 devices**, or at
  any one device with **200 or more retries**; otherwise WARNING. Only Android builds from versionCode **94** up, and
  every iOS build, decide the colour.
- It decides "this is the device's surroundings" from the **reason text**, in `isTheDevicesNetwork()` — and
  `Unable to resolve host "stage.invotick.com"` reads exactly the same whether the phone had no network or believed it
  had a good one. So every such row was counted into one line: **"Ignored — the device had no network"**, and left out
  of the verdict entirely.
- Worse, on the drill-down those rows name **no phone at all**: in `sync_failure`, the 1,873 DNS rows carry
  `device_id` NULL on every one (the pre-0050 ingest path, builds up to 1.4.4).
- **And from 1.4.5 the app stops sending them at all.** `isNotASyncFailure` has sent every network failure to silence
  since `1b66e30c`, which is why there is not one such row from a build ≥ 101. Once every phone updates, the evidence
  disappears completely. (This is older than 0125 and has nothing to do with it; 0125 touched the guest sign-in only.)

**So: plainly, no.** Not on the card, not on the drill-down, and soon not on the server at all.

## 2. What it is — the numbers first

30 days to 2026-09-20, `analytics_events`, rows whose reason contains `Unable to resolve host`:

| | Rows | Phones |
|:--|--:|--:|
| `net_online=false` — the ordinary offline case | 14,716 | 1,270 |
| **`net_online=true` — the phone believed it was online** | **8,343** | **1,007** |

Read again a few minutes later (the table is live), the 8,343 split as **`pull_failed` 6,671 and `push_failed` 1,675**;
by network, **wifi 3,818, cellular 3,942, VPN 586**. Every build from 91 to 100, and **none at all from 101 up** — the
app stops sending them there.

**Ruled out — an ISP or DNS block on `stage.invotick.com`** (memory `isp-block-cloudflare-fix`: Pakistani ISPs have
blocked us before). A block is one country, one carrier, one window. This is **every day of the window**, and up to
**70 countries in a single day**: PK 1,727 rows / 105 phones, then IN, NP, ZA, MM, ZW, NG, DZ, MW, ST, PG…

**Ruled out — a phone cut off for good.** **993 of the 1,007 phones reached the server again after their last such
failure** (`linked_device.last_seen_at`). The owner's own device is one of them: it first reached the server at
03:41 UTC on 2026-09-12, an hour *before* the four failures, and its `last_seen_at` is **2026-09-20 13:07 UTC**, now on
**1.4.7**. It holds 0 invoices, so nothing was lost by anyone.

**Ruled out — a naive "online" flag.** Both readings the app keeps already require Android's own
`NET_CAPABILITY_VALIDATED` — `AndroidConnectivityObserver` and `AndroidNetworkMonitor` alike. The phone was not calling
an unchecked wifi "online".

**What is left, and what the code says.** The reading is **cached**. `networkStatus` is a `StateFlow` that moves only
when a `ConnectivityManager` callback arrives, and the sync's own offline gate read `networkStatus.value`; the
`net_online` stamped on the event comes from `SessionNetwork`, another held value. A process parked in the background
answers both with whatever it went to sleep holding. **The owner's phone had been alive in the background for 1.8
hours** — `ms_since_start` 6.6 million, `screen_ms` frozen at 1857 on the splash, a `session_break` before each
failure — and the real transition to no network only arrived two hours later, at 12:11.

Whether the network was truly validated at that instant and DNS alone was dead, or the reading was simply stale, the
code cannot tell today **because nobody ever asks at the moment it matters**. That is the fixable part, and it is true
in both worlds.

## 3. What was fixed

**App — the reading is taken, not remembered.**

- `NetworkMonitorImpl.isCurrentlyConnected()` asks the system and **corrects `networkStatus` as it does**, so the live
  answer becomes the one answer rather than a second opinion.
- `SyncManager`'s offline gate asks instead of reading the cache, so a parked process stops starting syncs it could
  never finish.

**App — the two facts stop sharing a silence.**

- `SyncQueueManager.reportRequestFailed` takes a fresh reading when a call never reached the server. **No network →
  silent, exactly as the owner confirmed on 2026-09-20.** **Online → reported**, under a stage of its own:
  `push_unreachable` / `pull_unreachable`, carrying exactly the columns `push_failed` and `pull_failed` carry (0050's
  table, and its contract test now covers both). A cancellation is never reported, whatever the network says; a build
  with no reading to take reports nothing.

**Backend — the card names it honestly.**

- `SyncFailureCheck` files those two stages on their own line, **"Could not reach us while the phone said it was
  online"**, with devices and occurrences. The **stage** decides, never the message, so old builds' rows stay where
  they are. `app_stage` already holds it: **no migration, no new column.**
- It is **never counted as a refusal** — nothing was refused, because nothing arrived — but from the owner's answer of
  2026-09-20 it has a red of its own. See §6.

Guards: `APhoneThatThoughtItWasOnlineIsNotSilentTest` (did not compile first, naming what the code had to add; then the
0050 contract test failed on the two new stages), `TheNetworkIsReadWhenItIsAskedTest` (1 of 3 failed first),
`APhoneThatCouldNotReachUsIsNamedTest` (3 of 4 failed first).

## 4. Rejected

- **A retry inside the sync run.** That is a guard over the symptom: 993 of 1,007 phones recovered on their own, and
  the next scheduled sync is already the retry. It would also have hidden the very signal the owner asked for.
- **Counting these as sync failures.** Nothing was refused. Mixed into the card they would turn "the server is
  refusing pushes" into "somebody's wifi is bad", which is the noise 0029 removed.
- **Filtering them on the server instead of at the phone.** The phone is the only place that knows what its network
  said at that instant.
- **A new Health Centre page.** A check is a `HealthCheck` component; a page with rows is a drill-down behind a card.
- **A raw count as the threshold.** 300 phones is an outage in a week of 500 and nothing in a week of 40,000. The share
  is the honest measure; the count survives only as a floor.
- **Comparing this window with the one before it, from `sync_failure`.** A row accumulates: one that was last seen this
  week may have started twenty days ago, so the previous window would be undercounted and the comparison would invent
  a rise. The baseline is a measured number in config instead.
- **A threshold hard-coded in the check.** The first number is a first number; it had to be tunable without a release.
- **Trusting `net_online` on the old rows as proof of anything.** It is a held value, possibly hours old. It is why the
  reading now has to be taken live before it is allowed to accuse anyone.

## 5. Open

- **Country and network are not on the card, deliberately.** `sync_failure` carries the phone, the build, the platform
  and the counts; it does not carry `country` or `net_type` — those live only in `analytics_events.params`. The card
  says so and the detail sends the reader to the events. Putting them on the card would mean two new columns, which is
  a migration, so it is a separate ask and not done here.
- Builds up to 1.4.7 keep their current behaviour: they report nothing, and the owner's confirmation of 2026-09-20
  stands.

## 6. The owner's answer (2026-09-20) — the card goes red, and how the number was chosen

**His answer:** the card should **go red** for "the phone said it was online and could not reach us", not merely show
the line.

**Red is a rate, and it means "something got worse", never "this exists".** Two settings, and **both** must be passed:

| Setting | Default | Why |
|:--|--:|:--|
| `health.sync-failures.unreachable-red-share-percent` | **8** | Measured, not guessed — below |
| `health.sync-failures.unreachable-red-devices` | **25** | A floor, so a quiet day cannot shout |

**Where they live:** `invotick-apis/src/main/resources/application.properties`, beside
`health.sync-failures.supported-from-version-code`. Changing either is a config change, **not a release** — which is
the point, because the first number is a first number.

**How 8 % was derived.** Seven days to 2026-09-20: **347 of the 4,292 phones we heard from** reported it — **8.1 %**.
Every one of those readings came from a cache that could be hours old, so **8.1 % is the worst the number can be**.
Once the phone takes the reading live (§3), the count can only fall. So today's figure is the honest line between an
ordinary week and a week that got worse — a week that climbs back to 8 % after the fix is a week in which something
changed.

**Why 25 phones as well.** Against ~4,300 phones a week, 25 is **0.6 %**, so the floor decides nothing on a normal
day; the share does. It exists for the day the denominator collapses — three phones of twenty is 15 % and is still
three phones.

**What a healthy day looks like:** the line is present with a small number — "12 devices, 36 occurrences",
"0.3 % of the 4000 phones we heard from" — and the card is green. **What turns it red:** 25 or more phones **and** 8 %
or more of the phones we heard from that week. The summary then reads *"N phones could not reach us while their own
network said they were online (X % of the phones we heard from)"*, and a warning about refusals no longer hides it —
the unreachable verdict wins over a warning, with the refusals still on the card in their own lines.

**The denominator.** `LinkedDeviceRepository.countPhonesSeenSince` — one bounded `COUNT(DISTINCT device_id)` over
**5,915 rows**, every half hour, nothing loaded into the heap. **It can only answer for a window ending now:**
`last_seen_at` holds the latest call, not a history, so asked about a past week it returns only the phones whose very
last call fell in it — 4 for the week of 2026-08-17 against 4,292 for the week to 2026-09-20. This check always asks
about the last seven days, which is the one question it can answer. With no count available the share reads
**"not known"** and nothing goes red on it.

**What the card names, so the owner can act:** how many phones, how many times, the share of the phones we heard from,
and **which builds** they are on (`106 (2), 108 (1)`). Country and network are not claimed — see §5.

**During the rollout the card is deliberately conservative.** Only 1.4.8 and later can report this, while the
denominator is every phone that called in. So the share reads **lower** than the truth until the release is wide. It
under-reports rather than crying wolf, which is the safe direction; the follow-up below is where it is corrected.

### Follow-up — due one week after the release that carries the app half

**Re-run this, read-only, and set the two numbers from it. If it is not done, this decision is unfinished.**

```sql
-- 1. The new stages, as the fixed phones report them (the numerator the card counts).
SELECT COUNT(DISTINCT app_instance_id) AS phones, COUNT(*) AS rows_
FROM analytics_events
WHERE event_name = 'sync_failed'
  AND JSON_UNQUOTE(JSON_EXTRACT(params, '$.stage')) IN ('push_unreachable', 'pull_unreachable')
  AND event_timestamp >= NOW() - INTERVAL 7 DAY;

-- 2. The denominator the card uses.
SELECT COUNT(DISTINCT device_id) AS phones_we_heard_from
FROM linked_device WHERE last_seen_at >= NOW() - INTERVAL 7 DAY;

-- 3. Only the phones that can report it, so the rollout does not flatter the share.
--    app_version is the version NAME on linked_device.
SELECT app_version, COUNT(DISTINCT device_id) AS phones
FROM linked_device WHERE last_seen_at >= NOW() - INTERVAL 7 DAY
GROUP BY app_version ORDER BY phones DESC;

-- 4. Where it happens — the card cannot say this, the events can.
SELECT country, JSON_UNQUOTE(JSON_EXTRACT(params, '$.net_type')) AS net,
       COUNT(DISTINCT app_instance_id) AS phones, COUNT(*) AS rows_
FROM analytics_events
WHERE event_name = 'sync_failed'
  AND JSON_UNQUOTE(JSON_EXTRACT(params, '$.stage')) IN ('push_unreachable', 'pull_unreachable')
  AND event_timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY 1, 2 ORDER BY rows_ DESC LIMIT 20;
```

**How to read it.** Take (1) ÷ (3, restricted to 1.4.8 and later) as the true share among phones that can report.
- If it settles well below 8 %, lower `unreachable-red-share-percent` to that settled figure **plus about half again**,
  so an ordinary week stays green and a bad one does not.
- If it sits at or above 8 % with the live reading, the stale cache was **not** the cause and the case is still open:
  go to query (4) and look for one country or one network carrying it.
- Either way, write the new number and the date into this decision. The comparison figure to beat is
  **347 of 4,292 = 8.1 %, week to 2026-09-20, from a stale reading.**
