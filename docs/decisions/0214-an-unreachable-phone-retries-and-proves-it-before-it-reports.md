# 0214 — A phone that could not reach us retries, and proves it, before it reports

**Status:** decided by the owner, 2026-10-14 (*"retry + jaanch wala tareeqa banao"*). **Built, not tested by Gradle yet,
not pushed, not deployed, not released.**
- App: `fix/153-sync-defects` (1.5.3, worktree `kaam/worktrees/invoice-kmp-app-153`), `3ab058649` (plumbing) and
  `1e7ea36ef` (the change), `1d873977c` (two fix-ups).
- Backend: `feat/unreachable-needs-a-probe` off `origin/stage` `3616e97` (worktree
  `kaam/worktrees/invotick-apis-unreachable`), `24f836a`.
- No migration, no new column, no new event.

**Amends** [0129](0129-a-phone-that-thought-it-was-online-and-could-not-reach-us-is-evidence.md) (its §3 "online →
reported" and its §4 rejection of a retry). **Applies** the owner's rule of 2026-10-13 (sync agent, second mandate):
`sync_failed` means a real, fixable failure. **Related:** 0029 (a reported failure is an attempt the server refused),
0050 (the evidence net), 0125 (offline is silent).

## 1. What the data said

1.5.2 (versionCode 116), 48 hours to 2026-10-14, `sync_failed` with `stage` in `pull_unreachable` / `push_unreachable`:

| | |
|:--|--:|
| Reports | **397** |
| Carrying no `net_online` / `net_type` at all | **369** |
| Phone reached us again **more than 10 minutes** after the failure (it really was offline) | **63 %** |
| Phone reached us again **within 1 minute** (a blip) | **27 %** |
| **Noise, together** | **93 %** |

The typical row: `Unable to resolve host "stage.invotick.com": No address associated with hostname`, from a process
parked in the background for one to two hours.

Why 0129's fix did not hold: it made the phone take a **live** reading (`isCurrentlyConnected()`), which was right, but
"the system says online" still includes a captive portal, a radio waking up, a DNS server that has not answered yet,
and the second between a hand-over and the next. 0129's own follow-up said: *if it stays at or above 8 % with a live
reading, the stale cache was not the cause.* The ledger (`kaam/research/sync-defects-2026-10-13.md`, part 2) recorded
19.5 % of 7,306 phones in the week on 1.5.1. The test was failed.

## 2. The decision

A sync call that never reached our server is reported only when it is a **real, evidenced** problem between this phone
and us. Everything else is silent, and a blip is simply sent through.

### The app (`UnreachableCallPolicy`, `HttpControlProbe`)

1. **Which failures.** Exactly the network classes 0029 already names — `isNetworkFailure` in `NotASyncFailure.kt`
   (UnknownHost, Connect, timeouts, socket reset/abort, stream reset, iOS `NSURLErrorDomain` codes). Never our gateway's
   502/503/504 page (`isGatewayAnswer`), never a cancellation, never an answer. A TLS handshake failure is **not** in
   that set (a certificate the phone refuses may be ours) and keeps being reported as `push_failed`/`pull_failed`, as
   before.
2. **The live reading first.** `NetworkMonitor.isCurrentlyConnected()` (0129). Offline → silent, nothing retried; the
   next scheduled sync is the retry, as it always was.
3. **Online → the same call again, twice.** After **3 s**, then **10 s**, and only while a fresh reading still says
   online. No try starts once **20 s** have passed since the first failure, and a try that is still running at 20 s is
   stopped (its failure before it stands). Success on any try → **nothing is reported and the sync simply goes
   through** — the user's work no longer waits for the next scheduled run because of a blip.
   - Each try is a call of its own: its own `X-Request-Id` (0050), learned on the trace; for a push, its own T0 on each
     record's journey (`RecordJourneys.theseWereSent`).
   - It runs where the sync runs (off the UI thread). It holds the sync's own mutex a little longer, nothing the save
     path needs: a save writes the local DB and the queue, and a push it asked for while this one waits is carried by
     the run's second push (`push_after_images`) or the next trigger.
4. **Push vs pull.** A pull is a `GET`: any of the failures above is sent again. A push is sent again **only when it
   provably never left the phone** (`neverLeftThePhone`: no DNS, refused, no route, connect timeout, iOS
   −1003/−1004/−1006/−1009/−1018/−1020).
   - Why: the server is safe against a **resent** push — a create it already holds is redirected to update and answered
     `ALREADY_APPLIED` (`AbstractSyncV2Support.answerIfAlreadyHeld`, `SyncVersionRule.SUPERSEDED_BY_SELF`), which is
     exactly what the next scheduled run relies on today (journey T0, M1 of 2026-09-24).
   - What it is not safe against is a **race**: a read timeout or a reset can leave the first push still running in its
     transaction; a second copy three seconds later waits on the same primary keys, fails the commit with a duplicate key,
     and goes down 0080's per-record path — and may write an ERROR line that Grafana's `invotick-sync-failure` rule sends
     to Slack. So a push that may have arrived is not sent again in-process; the next scheduled run, minutes later, sends
     it as before. The batch sent again is the same object, so it is the same records.
5. **Still failing → the control check** (`HttpControlProbe`), four questions at once, **5 s each**, on a bare client of
   its own (no pass, no device id, no header of ours, closed after the check):
   - `probe_web` — `HEAD https://www.invotick.com/icon.png` (our website: another host, another network, our domain);
   - `probe_neutral` — `HEAD https://www.google.com/generate_204` (Android's own internet check);
   - `probe_api` — `HEAD <BASE_URL>/logo.webp` (a public static file on our API host) — **added, see §3**;
   - `probe_dns` — whether the API's name resolves (Android `InetAddress`, iOS `getaddrinfo`).
   Any HTTP answer, whatever its status, is `ok`; an error is `fail`; nothing within 5 s is `timeout`.
6. **The verdict** (`UnreachableCallPolicy.proves`). Reported only when **all** hold:
   - the system read online at the failure (`net_online=true`);
   - our website **or** the neutral host answered (`probe_web=ok` or `probe_neutral=ok`) — the phone reaches the
     internet;
   - our API's address did **not** answer (`probe_api` ≠ `ok`) — the path to us is still broken.
   Control hosts also down → the phone has no internet: **silent**. Our API answering the check → a blip: **silent**.
7. **Rate limit.** At most one report per phone per **6 hours** per (sync phase `run`, exception class), kept in
   DataStore (`SyncMetadataRepository.lastUnreachableReportAt`) so a background sync in a fresh process still sees it.
   The guard is read **before** the check, so a phone already reported spends no data on it.
8. **What the report carries** — the same `sync_failed` event, the same stages `push_unreachable` / `pull_unreachable`,
   0050's columns for them unchanged, plus (on these two stages only, `SyncFailureEvidence.STAGE_PARAMS` and its
   contract test):

   | Parameter | Value |
   |:--|:--|
   | `tries` | how many times the call was sent: 1 (a push that may have arrived), 2 or 3 |
   | `waited_ms` | from the first failed send to the last one |
   | `probe_web`, `probe_neutral`, `probe_api` | `ok` \| `fail` \| `timeout` |
   | `probe_dns` | `ok` \| `fail` |
   | `net_online` | the system's live reading at the failure — always `true` on a sent row |
   | `net_type` | `wifi`, `cellular`, `vpn`, `none`… — the gateway's own words (`NetworkTelemetry.describe`) |

   `net_online` and `net_type` are the names the analytics gateway stamps on every event; an event's own value wins over
   the stamp (`AnalyticsGatewayImpl`: `if (!containsKey(k))`), so on these rows the live reading **replaces** the held
   one. That also fills the 369 of 397 rows that carried none — a background process had never fed `SessionNetwork`.
   Absent means unknown (AGENTS-EVENTS §1.7). One action, one event: no new event (§1.1).
9. **Kill switch** `sync_unreachable_retry_enabled` (Remote Config, Android and iOS; on unless it says `false`). Off: no
   retry, no check, and nothing of this kind is reported — the 2026-10-13 rule's safe direction.

### The backend (`SyncFailureCheck`)

- The card counts toward red only unreachable rows from builds that report with the proof:
  `health.sync-failures.unreachable-proven-from-version-code` (Android, default **117** = 1.5.3) and
  `health.sync-failures.unreachable-proven-from-ios-build` (default **31**). A row that names no platform is judged by
  the Android floor; a row with no build is never proven.
- Older builds' rows (1.4.8–1.5.2) go on their own line, **"Ignored — could not reach us, unproven (builds before the
  check of decision 0214)"**, and never decide the colour, however many there are.
- The red rule itself is unchanged: ≥ 25 phones **and** ≥ 8 % of the phones we heard from (0129 §6).
- **No migration, no ingest change.** `DeviceSyncFailureIngest` already files these rows (stage in `app_stage`,
  exception in `last_exception`); the probe answers stay on the event in `analytics_events.params`.

## 3. Where this differs from the order, and why

- **`probe_api` was added.** The order's verdict was "control reachable but ours not". "Ours not" was the sync call that
  had failed up to 13 s earlier. Asking our own address once more, beside the control hosts, separates *the path to us is
  broken* from *the call met a blip that has just ended*, at the cost of one more header-only request. Without it, a
  read timeout on a push (not resent, §2.4) would be reported every time the internet answered a moment later.
- **A push is resent only when it never left** (§2.4), as the order allowed ("retry only the connect-phase failures").
- **The server decides "proven" by the build, not by the row's probe columns.** `sync_failure` has no column for the
  probe's answers, and the order preferred no migration. Since 1.5.3 sends these stages **only** with the proof (pinned
  by the app tests below), a row from a build at or past the floor is proven by construction. The answers stay readable
  on the event. If ever a build sent them unproven, the floor is a setting, not a release.
- **A 20 s budget, and a try cut at the budget.** "Bounded total ≤ ~20 s" is enforced on the waiting and the tries
  together; the check adds at most 5 s. A first failure that itself took 60 s (the client's request timeout) is still
  followed by at most 20 s more.
- **The DNS lookup is abandoned, not awaited, at 5 s.** A blocking lookup cannot be interrupted; it runs in a job of its
  own and finishes on its own thread.

## 4. Rejected

- **0129's rejection of a retry ("a guard over the symptom; the next scheduled sync is the retry").** Overridden by the
  owner's 2026-10-13 rule and his 2026-10-14 order. 0129 was right that a retry alone would hide the signal; this one
  does not hide it, it **proves** it — a phone that still cannot reach us after two more sends and a check that finds
  the internet working is reported, with the proof. And the next scheduled sync is 15–30 minutes away; for a blip that
  is work left waiting for nothing.
- **Keep reporting on the live reading alone (0129).** 93 % noise on 1.5.2.
- **Stop sending these stages at all** (the ledger's option). Then a real block on our host — a country's ISP, a DNS
  provider, our edge — would be invisible from the phones, which are the only ones that can see it.
- **A once-a-day count in a non-`sync_failed` event** (the ledger's other option). A new event for a fact that is a
  sync failure when proven (AGENTS-EVENTS §1.1), and a count cannot say which call, which build, which network.
- **Resending any push failure.** The race in §2.4.
- **Using the app's own HTTP client for the check.** It carries the user's pass (`installAuthInterceptor`, bearer on
  sync calls) and logs bodies; a request to a third-party host must carry nothing of ours.
- **Checking only the neutral host.** It proves the internet; it does not prove *our* side of the internet (Vercel's
  edge vs our VPS), which is what `probe_web` adds.
- **A row-level proof on the server (new columns).** A Flyway migration with no rollback, for a fact the build already
  guarantees.
- **Counting old builds' rows by their `net_online`.** It is a held value (0129 §4), and on 1.5.2 it was absent on 369 of
  397.
- **Retrying our gateway's 502/503/504.** A deploy gap is ~40 s; 13 s of retries would rarely bridge it and would add
  load to a backend that is starting. Unchanged: silent (0029 addendum).

## 5. What it costs a phone

- **Normal day:** nothing. The retry and the check run only after a sync call failed **while the phone read online**.
- **A blip:** one or two more sends of the same request — a pull is a few hundred bytes up and its usual answer down; a
  push re-sends its batch, which never left the phone on the first try.
- **A lasting failure:** the check is three TLS handshakes with header-only answers (~5–7 KB each) and one DNS lookup:
  **about 20 KB**, at most **once per sync phase and exception class per 6 hours** — so at most about **4 checks a day per
  kind, ~80 KB/day**, only on a phone whose path to us is broken all day while its internet works. A phone that is
  simply offline makes no check at all.
- **Battery:** the radio is already up for the sync; the waits are suspensions, not work. At most ~25 s more per failed
  sync run.
- **iOS background:** `BGAppRefreshTask` gives about 30 s. A retrying run plus the check can approach it; if the system
  ends the task, the run is cancelled and nothing is reported (a cancellation never is). Not measured.

## 6. What is not done

- **Gradle has not run on any of it** (the order: the lead runs Gradle). The commands are in the report that came with
  this decision.
- **iOS needs an Xcode-side check** of `ControlProbePlatform.ios.kt` (`platform.posix.getaddrinfo` / `addrinfo` /
  `freeaddrinfo` via cinterop, and `HttpClient(Darwin)`): `:data:compileKotlinIosSimulatorArm64`, then a TestFlight
  run where a sync fails online.
- **The parked-account push** (`ParkedAccountPush`) builds its own queue and handler without the policy: it is sent once
  and a failure to reach us stays silent, as before.
- **Image upload/download, reconcile and the guest sign-in** are untouched: their network failures stay silent (0029).
- **The thresholds (8 %, 25 phones) are not re-derived.** Proven rows will be far fewer than the old noise; the first
  week of 1.5.3 decides the number (below).
- **The floors are defaults, not facts:** 117 assumes 1.5.3 ships as versionCode 117 with this code; 31 assumes the next
  iOS build carries it. Set both to the real first builds before the backend deploy matters.
- **The `Could not reach us` line on the Sync health page** still sets aside proven and unproven rows alike
  (`SyncFailureSetAside`); only the card splits them.

## 7. Follow-up — one week after 1.5.3 reaches most phones

```sql
-- 1. Proven reports, by build and probe answer (the numerator the card counts).
SELECT app_version_code,
       JSON_UNQUOTE(JSON_EXTRACT(params, '$.probe_web'))     AS web,
       JSON_UNQUOTE(JSON_EXTRACT(params, '$.probe_neutral')) AS neutral,
       JSON_UNQUOTE(JSON_EXTRACT(params, '$.probe_dns'))     AS dns,
       COUNT(DISTINCT app_instance_id) AS phones, COUNT(*) AS rows_
FROM analytics_events
WHERE event_name = 'sync_failed'
  AND JSON_UNQUOTE(JSON_EXTRACT(params, '$.stage')) IN ('push_unreachable', 'pull_unreachable')
  AND created_at >= NOW() - INTERVAL 7 DAY
GROUP BY 1, 2, 3, 4 ORDER BY phones DESC;

-- 2. Where: one country or one network carrying it is a block, spread everywhere is not.
SELECT country, JSON_UNQUOTE(JSON_EXTRACT(params, '$.net_type')) AS net,
       COUNT(DISTINCT app_instance_id) AS phones, COUNT(*) AS rows_
FROM analytics_events
WHERE event_name = 'sync_failed'
  AND JSON_UNQUOTE(JSON_EXTRACT(params, '$.stage')) IN ('push_unreachable', 'pull_unreachable')
  AND app_version_code >= 117
  AND created_at >= NOW() - INTERVAL 7 DAY
GROUP BY 1, 2 ORDER BY phones DESC LIMIT 20;
```

- **Expected:** a handful of phones a week. Each proven row is then a defect to trace (the owner's 2026-10-13 rule):
  a country, a carrier, a DNS provider, or our edge.
- **If `probe_dns=fail` dominates in one country,** it is a block on our name: the memory `isp-block-cloudflare-fix`
  route.
- **Set the red share from the measured week:** the settled share plus about half again, as 0129 §6 says; write the
  number and the date here.
