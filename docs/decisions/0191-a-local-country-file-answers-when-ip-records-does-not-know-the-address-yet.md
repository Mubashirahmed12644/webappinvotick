# 0191 — A local country file answers when `ip_records` does not know the address yet

- **Date:** 2026-09-30
- **Status:** built, **not merged**. Backend: branch `feat/ip-country-local-db` off `stage` (after 0190's
  `AnalyticsCountryFromIp`, live). Docs: this branch. **One volume added to `docker-compose.yml`; no schema change, no
  app change.**
- **Decided by:** the owner, 2026-09-30, the option "Muft local database" for 0190's open question 1(b).
- **Follows:** [0190](0190-a-splash-loss-names-its-way-out-its-phase-and-its-country.md) (its first open question),
  decision 0072 (the outside lookup is paid quota and is not used here).

## What was decided

A batch with no country is looked up in this order, and nowhere else: the phone's own country (never overwritten) ->
`ip_records` -> a **local DB-IP "IP to Country Lite" file** -> absent (unknown, AGENTS-EVENTS §1.7).

| | `ip_records` | local DB-IP file |
|---|---|---|
| Source | four lookup services, run by the three-hourly batch | DB-IP.com, free, monthly, **CC BY 4.0** (attribution: backend `NOTICE` and `README`) |
| When it knows a new phone | up to 3 h later (6.7 % were there at creation) | at the first batch |
| `params.country_source` | `ip` | **`ip_local`** |
| Cost | one indexed read, cached | a memory-mapped read, no network, no address leaves the server |

- **`ip_local` is a separate value, not `ip`.** DB-IP Lite is country-level and less careful than four services
  agreeing; a reader who wants only the careful ones can filter, and one who wants everything the server derived reads
  `IN ('ip','ip_local')`. Mixing them under one name would make that impossible after the fact (§1.7).
- **Reader:** MaxMind-format MMDB, `com.maxmind.db:maxmind-db` (Apache-2.0), opened **memory-mapped**: the file (8.3 MB
  for 2026-09) is paged in from disk by the operating system, not held on the heap. Measured with the real file: 200,000
  random lookups grew the heap by 23 KB. Storage, never RAM (memory `storage-not-ram`).
- **Delivery:** not in git. The backend downloads `dbip-country-lite-YYYY-MM.mmdb.gz` from `download.db-ip.com` at start
  (its own thread, never delaying boot) and every 6 hours after, but only when the file is missing or was built in an
  earlier month. It writes `<file>.part`, opens it to prove it is a country database, refuses one older than the file in
  use, then renames it over the old one (atomic). A failure leaves the working file alone. The folder is the named
  volume `ipdb-data` at `/app/ipdb`, so it survives restarts and deploys.
- **Failure is quiet for users and loud on the board:** no file -> no `ip_local`, batches stored as before. The Health
  Centre card **"IP country database"** (`ip-country-database`, a `HealthCheck`, never a page) warns when the file is
  missing, will not open, or was built more than 45 days ago.
- **Skipped as before:** `Platform.Web` (its address is Vercel's), and private, loopback, link-local, multicast and
  unspecified addresses.

## Rejected

- **The outside lookup on a miss** (0190's option a). Decision 0072: paid quota, and it would send every early leaver's
  address to four third parties.
- **Loading the CSV into a sorted array on the heap.** About 12 MB of arrays and a parse at every start, for what the
  operating system does with a mapped file for free.
- **Committing the file to git.** 8 MB rewritten monthly, forever in history.
- **A cron on the VPS.** One more thing outside the repo to forget; the backend's own job is deployed with the code and
  watched by the same Health Centre.
- **The value `ip` for both sources.** See above.

## Effect on the numbers

Coverage of first-open early leavers should rise from about 7 % to the share of addresses DB-IP knows: 197,947 of
200,000 random public addresses answered (99 %, 2026-09-30). **A trend across the deploy day is a change of source,
not of behaviour.** Country from an address is the country of the network, which for a VPN or a mobile carrier's exit
point is not always the phone's own: it is a better guess than nothing, not a fact about the user, and `ip_local`
says so on every row it touches.
