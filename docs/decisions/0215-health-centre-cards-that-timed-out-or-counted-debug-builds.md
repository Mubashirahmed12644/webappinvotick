# 0215 — Health Centre cards that timed out, or counted our own phones and old damage

**Status:** built 2026-10-15, **Gradle not run, not pushed, not deployed, not released.**
- Backend: `fix/health-cards-2026-10-15` off `origin/stage` `24f836a` (worktree
  `kaam/worktrees/invotick-apis-hc-cards`), commit `e698cff`.
- App (classification only): `fix/153-sync-defects` (worktree `kaam/worktrees/invoice-kmp-app-153`), `00d412cba`.
- No migration, no new index, no new event, no stored row changed.

**Applies** the owner's rule: noise that is not a real problem is not reported, and every real problem is fixed at
the root. **Related:** 0034 (a page costs what it shows), 0115 (random-UUID key), 0141 (FORCE INDEX trap),
0179 (one network list for sentence and `kind`), 0214. `sync-failures` and `refused-record` are another agent's.

## What the Health Centre said on 2026-10-15, 09:15 UTC, and what was behind it

| Card | Said | What it was |
|:--|:--|:--|
| `duplicate-press` | UNKNOWN, timed out at 5 s | Its read was too heavy (below). Its answer, when it finished, was a real WARNING: 9 pairs to review. |
| `unknown-invotick-hosts` | UNKNOWN, timed out at 10 s | crt.sh asked on the page's time. When it answered: **`next-api.invotick.com`**, a live certificate to 2027-01-02 and a DNS record — a real finding. |
| `event-delivery` | WARNING, "273 events dated after they arrived, 1 device" | The card could not say whose device. Its debug/release split covered late events only (2 debug, 0 release); the 273 were never split. |
| `invoice-currency` | WARNING, 1 unexplained | `DD2605002`, ZWL against a USD client, written **2026-05-30**, before the push DTO stopped dropping the currency (2026-08-21). 0 unexplained written in 24 h or 7 days. Old, understood damage; the owner does not have users' invoices changed. |
| `errors-users-saw` | WARNING, "New on Android build 116: IOException (load other), 1 phone" | One event, screen `pdf_viewer`: Android's PdfRenderer refused a PDF the person opened (not a PDF, damaged or password-locked). The app counted the bare `IOException` as `kind=network`. Neither our defect nor the network. |
| `database-exposure` | WARNING, `invotick_app@172.30.10.%` "usable from any address" | Report only (below). |

## 1. `duplicate-press` — the read stays in an index

**Was:** `WHERE event_timestamp > now − 6 h ORDER BY user_id, event_timestamp LIMIT 20001`, no index named, reading
`params` JSON. 18,544 rows came back on 2026-10-15 (93 % of the cap). Every one is a random page read (decision 0115),
and the ORDER BY lets MySQL walk `idx_analytics_events_user_ts` from the first user instead of sorting.

**Now:**
- Window on **`created_at`** (arrival), through `FORCE INDEX (idx_analytics_events_created_name_user_instance)`, an
  index production already uses in five other reads. The phone's clock can no longer move a row in or out.
- **The names the pairing can never report are dropped in the index**, before a row is fetched: the `INFRA` set,
  `session_break`, and the `isByDesign` families (`sync_*`, `*_shown`, `*_open(ed)`, `*_permission_*`,
  `*_form_text_add|typed`). A pair containing one was never reported, so no answer changes. Production, 6 h to
  2026-10-15 ~10:00 UTC: **21,887 events, 16,239 (74 %) left out, 5,648 fetched.**
- Only `screen` and `auto` come back, not the JSON.
- `jakarta.persistence.query.timeout` 4 s: a read that cannot finish says "could not read" and frees the connection.

Measured locally on a 2,025,000-row table shaped like production (random 16-byte key, 500-byte params, about 22,000
rows in the 6-hour window, 10 event names in production's proportions, 128 MB buffer pool), two runs each:

| | Old read | New read |
|:--|--:|--:|
| Plan | range on `event_timestamp`, MRR, filesort of whole rows | range on the named `created_at` index, index condition, filesort |
| Index entries read | 22,340 | ~41,000 (the window, filtered inside the index) |
| Rows fetched from the table | **20,001** (hit the cap) | **6,716** |
| Time | 1,083 / 931 ms | **298 / 314 ms** |

Production took more than 5 s for the old read (a 6 GB table, 3.1 M rows), about five times the local figure; the
same factor puts the new one near 1.5 s, under the 5 s wait, with the 4 s database timeout behind it.

**Rejected:** precomputing it into a table (a pre-computed figure can be stale and is a cost — 0034; not needed once the
read is small); a new covering index with `params` (cannot index JSON, and an ALTER on a 6 GB table); keeping the
`event_timestamp` window (a wrong clock moves rows in and out); raising the 5 s wait (the query was the defect, not the
budget).

**Tests:** `ThePressReadStaysInAnIndexDbTest` (real MySQL: what comes back, the plan is a range on the named index with
the name filter pushed into it, the timeout is under 5 s, and every family the SQL drops is one `isByDesign` drops);
`AnAdNetworksCallbackIsNotAPressTest`, `APressAndItsResultAreTwoFactsTest` (moved to the new projection).

## 2. `unknown-invotick-hosts` — crt.sh is never asked on the page's time

A thread of its own reads crt.sh at start and whenever the last good read is 6 h old, 3 tries 30 s apart, then every
15 min while it fails; the same thread re-asks DNS for the unapproved names every 15 min. `run()` only reads what it
kept (no network; the 10 s timeout is gone). The card says "Read from crt.sh: X ago", and "Latest attempt failed …
this card shows the last good read" after a failure. UNKNOWN only with no good read since start, or none for 2 days.
An empty answer is a failure, never an all-clear. Kept in memory: ~a dozen names, under 2 KB.
`health.ct.refresh.enabled=true` in `application-prod.properties` only.

**Rejected:** caching inside `run()` (still waits on crt.sh when the cache is old); Spring's `@Scheduled` (one shared
scheduler thread; a 45 s crt.sh call would delay every other job); a database table for the last read (a migration for
2 KB; after a deploy the first read starts at once); a second CT source (another third party to watch).

**Tests:** `AFlakyThirdPartyIsNotAnUnknownTest`.

## 3. `event-delivery` — a wrong clock is split like a late event

The query adds `aheadFromDebug`, `aheadDebugDevices` and the ids of the non-debug devices with a wrong clock (same
covering index, still no row fetch). Only a user's phone colours the card: not `build_type=debug`, not a phone in
`OurOwnAccounts` (`health.our-own.device-prefixes`). Both are shown on their own lines, "not counted". An id cut off by
`GROUP_CONCAT`'s length is counted as a user's. Verified in code which rows count: `created_at` in 7 days, and either
`build_type=debug` or a session whose `app_version` is not 1.4.0.

**Rejected:** dropping debug rows from the query (the count is true and must stay visible); a second per-device query
(doubles a ~1 s read).

**Tests:** `LateEventsNameTheirDevicesTest` (+4), `EventDeliveryReadStaysInAnIndexDbTest` (+1).

## 4. `invoice-currency` — only a recent unexplained invoice colours the card

Amber when an unexplained one was **written in the last 7 days**, red in 24 h or at 25+ in 7 days, red for any invoice
with no currency (unchanged). Older unexplained invoices: OK, named in the facts ("Newest unexplained …") and counted on
"Older unexplained, shown and not counted". No data touched. "Written" is the invoice's own `created_at` (the phone's),
so an invoice made offline long ago and sent today counts as older — accepted, stated on the card.

**Rejected:** repairing `DD2605002` (owner, 2026-09-27: users' stored money data is not changed by us); an allow-list of
known invoice numbers (an exception baked into a check outlives the thing it excuses); `updated_at` as "written" (an
edit of the old invoice would turn it red as if a path were producing them now).

Note: there is no decision 0211 in this folder (the index goes 0163 → 0212); the history is in 0003, 0009 and memory
`currency-not-stored-on-invoice`.

**Tests:** `InvoiceCurrencyIsASnapshotTest` (+3, one updated).

## 5. `errors-users-saw` — a dropped connection is not a "new exception class"

- **Card:** the new-class rule skips `kind=network` rows. A connection that dropped is weather, judged by the network
  rules (25 % of phones and 20+ for red, a spike for amber). A new class of any other kind still turns it amber on one
  phone.
- **App (root of this one):** the PDF viewer names a renderer refusal `UnreadableFileException` (from `IOException` or
  `SecurityException`), with no cause chained, and `ErrorShown` counts it `local`. The sentence the person reads is
  unchanged. Ships with 1.5.3; until then the same refusal reads `IOException · network` and is no longer amber.
  Expect one amber line ("New … UnreadableFileException") the first day a 1.5.3 phone opens a broken PDF: that is the
  rule working (a class new with the release).

**Rejected:** taking `IOException` off the app's no-connection list (OkHttp reports dropped connections as a bare
`IOException`; 0179 put it there); requiring two phones for every new class (a new local crash on one phone is exactly
what the rule is for).

**Open, not done:** the sentence says "Please try again", which cannot help a damaged file. A truthful sentence needs a
translation entry and a design-agent look.

**Tests:** `ErrorsUsersSawCheckTest` (+2); app `ErrorShownTest.aFileThePdfRendererRefusedIsLocalNotNetwork`.

## 6. `database-exposure` — reported, nothing changed

The card lists `invotick_app@172.30.10.%` as "usable from any address". `172.30.10.%` is a Docker subnet, not `%`: the
account is already narrowed to one /24, which is the card's own recommended remedy. The nightly script that writes
`wildcard_accounts` (on the server, not in a repo) counts any `%` in a host as "any address". Two ways out, both the
owner's word: narrow `invotick_app` further to the backend container's fixed address, or teach the script and card that
a private-subnet wildcard is not "any address". `debian-sys-maint@localhost` on `mysql_native_password` is context only
(localhost).

## What each card should read after deploy

- `duplicate-press`: an answer within 5 s (WARNING with its review pairs, or OK).
- `unknown-invotick-hosts`: WARNING for `next-api.invotick.com` until its DNS record is removed or it is approved —
  a real finding for the owner.
- `event-delivery`: OK if the wrong clock is a debug or our own phone; still WARNING, now naming a user's device count,
  if it is a user's release phone.
- `invoice-currency`: OK, with `DD2605002` on the "older" line.
- `errors-users-saw`: OK (the 1-phone `IOException · network` no longer counts as new).
- `database-exposure`: unchanged WARNING until the owner decides.
