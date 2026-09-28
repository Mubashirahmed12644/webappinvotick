# 0184 — The Screen Map is a page of its own, read from three per-device rollups

**Date:** 2026-09-29 · **Owner's decisions:** Screen Map review of the mockup, 2026-09-28/29
(`kaam/screen-map/screen-map-mockup.html`) · **Backend:** `feat/screen-map` off `stage` (`1587db3` migration alone,
`788a179` job + reads, `85f3f87`) · **Panel:** `feat/screen-map` off `main` (`aed032d`, `6694603`). **Not merged, not
deployed.** The migration adds three tables and needs the owner's yes before it ships. The app's signals are decision
[0183](0183-the-screen-map-measures-the-tour-dead-taps-and-ad-clicks.md).

## What the owner decided

1. **A sidebar page of its own, "Screen Map"** (`/screen-map`). This is a **deliberate exception** to the standing rule
   that anything health- or monitoring-like goes into the Health Centre as a card (AGENTS.md §5, memory
   `health-centre`). The reason: the Health Centre exists for things that fail silently and must shout on an ordinary
   day. The Screen Map does not watch for a failure; it is where the owner goes, on purpose, to look at a screen. A
   card with a drill-down would hide a tool he opens deliberately behind a list meant for alarms.
2. **Per screen:** a picture of the phone with a numbered badge on every measured element (% of viewers who tapped,
   taps per viewer, repeat-tap %), the ways people left (next screen, back, ✕, discard, background, killed, crash, no
   signal), time on screen (median, p75), taps on nothing (dead taps), and "why they leave" — three suggestions, each
   with the number that will show whether it worked.
3. **Filters, all at once:** days (7 / 14 / 30), platform, app version, Meta vs organic (`device_journey.meta_shaped`),
   country, new vs returning.
4. **A mode switch:** on Create Invoice, *tour* vs *no tour*, per visit; on every other screen, the journey phase —
   before the device's first invoice (+30 minutes) vs after. Every number on the page follows it.
5. **Tap to navigate:** tapping an element goes to the screen the data says it leads to (the next `screen_view` within
   2 s of the tap, 5 s after Save, 120 s after Watch ad, shown when it happens at least half the time). Breadcrumbs,
   a back button and the URL hash carry the path, the mode and the filters, so Back, reload and a copied link work.
6. **Wherever an ad or the paywall sits, a both-sides panel:** the leaving side (visits that ended within 30 s of an
   ad, the Save gate closed without watching) next to the earning side (app-open, interstitial and banner money and
   impressions paid during those visits, purchases, ad clicks) — **as a question, never a proposal to weaken
   monetisation** (AGENTS.md §1).
7. **The tour holdout (0183: 20 % of new users see no tour)** is shown on Create Invoice: on vs off, devices, invoice
   made, and G1 (a confirmed share or a payment within 24 h of that invoice), with sample sizes and the plain words
   **"abhi kaafi data nahi"** until both arms hold 200 devices *and* the difference is outside chance at 95 %
   (two-proportion z test, |z| ≥ 1.96).
8. **Reference pictures are made on the computer** by the screenshot pipeline (Roborazzi, our own demo data), never
   taken from a user's phone. The page reads its manifest from `NEXT_PUBLIC_SCREENMAP_MANIFEST_URL`; until that
   exists it draws Create Invoice from the app's code and a placeholder frame for every other screen. Nothing waits
   on it.

## How it is built

### Three tables, one row per device (`V20260929_01__screen_map_tables.sql`, its own commit)

| Table | One row per | What it holds |
|:--|:--|:--|
| `screen_stay` | visit of a screen | start, day, **mode** + how it was known (`screen_mode`, `history`, `overlay_tap`, `phase`), platform, version, country, `open_count`, `overlay_variant`, length, how it ended, and flags for what happened inside (item, save, gate, watch/premium/dismiss, invoice, share within 3 h, G1 within 24 h, preview, touched anything, landing ad, ad within 30 s of leaving, ad click, error, validation), overlay taps by tour step, and the ad money paid during it |
| `screen_tap_day` | device × day × screen × element × **mode** | taps, repeats within 2 s, rage taps (third within 3 s) |
| `screen_nav_day` | device × day × screen × element × **mode** × next screen | taps that opened that screen |

- **Per device, on purpose:** the page counts people. A per-day total overstates them when a device comes back:
  5,470 device-days were 4,516 devices on Create Invoice in 14 days.
- `device_id` is `BINARY(16)` (`UUID_TO_BIN` of `app_instance_id`): 16 bytes instead of 37 in every key and index.
  The web page's `web_…` ids are never release builds, so never read.
- No `user_id`: nothing here names an account (the closed-account eraser's list is unchanged).
- **Size:** ~6.5k + ~7k + ~3k rows a day (measured day on production: 53,102 events, 1,122 devices, 7,207 screen
  views, 6,677 device-tap pairs); 296–349 bytes a row measured with indexes; kept 32 days → **~170 MB**. The disk has
  26 GB free; `analytics_events` is 3.4 GB.

### The job (`ScreenMapJob`, every 3 hours)

- Reads **only the rows that arrived** since its watermark (`processing_state.screenmap_arrived_through`), through the
  `(created_at, …)` index — never a range of `analytics_events` by occurrence time (§5a; memory
  `analytics-events-random-pk-reads`).
- For each device that sent something: its events from 2 h before the first day touched to a day after the last, its
  history (first item / first invoice, index-only), built into rows by `ScreenMapBuilder`, which is the mockup's
  analysis (`segment.py`, `nav.py`, `modeextras.py`) ported rule for rule; the touched days' rows replaced in one
  transaction. Replacing is the same done once or twice, so a run that dies is simply redone.
- Release builds only; our own phones and accounts (`health.our-own.*`) and `testing_devices` left out; event times
  bounded on both sides (AGENTS-EVENTS §3.14).
- `SCREENMAP_ROLLUP_ENABLED=false` stops it with no release.
- **Cost:** a run reads ~6.6k arrived rows, then the events of ~300 devices' touched days (~30k rows by device index).
  The first run fills 32 days, a day per window (~1.5M arrived rows read once).

### The page's reads (`/v1/webpanel/screen-map/{screens,screen,dimensions,holdout,status}`, `@RequireRole(ADMIN)`)

One screen, one mode, ≤ 30 days, through `(screen, mode, day)`; counted and summed in SQL; every list capped. On a
local copy with 18,788 synthetic events: 20–160 ms each.

### Mode, until and after the app says it

- Until 0183's `screen_mode` ships, Create Invoice's mode is worked out: *tour* until the device's first item, invoice
  or estimate, and any visit with an overlay tap is *tour*. The mockup measured this rule as possibly ~18 % wrong on
  "no tour" visits (the app decides per account, we can only look per device). The page says how many visits were
  **stated** by the app and how many were **worked out**.
- When an event carries `screen_mode`, it decides the visit: any `tour_*` → tour, `none` → normal.

## Rejected

- **A Health Centre card with a drill-down** (the first mockup's recommendation). Rejected by the owner: see decision 1.
- **Reading `analytics_events` live per page view.** One screen over 14 days scanned ~550k rows at ~12 s a day of
  data in the mockup's extraction; §5a forbids it, and it is the shape of the 2026-09-04 outage.
- **Per-day totals instead of per-device rows.** Cheaper, but a device counted on three days is three viewers; every
  reach figure would read high by up to 10 points, and no filter could be combined with another.
- **An aggregate `screen_nav_day` (no device).** It cannot be rewritten for one device when that device's late events
  arrive; per-device rows make the job idempotent. Only taps that opened a screen get a row, which keeps it the
  smallest of the three.
- **A fourth table for device state** (first item, first invoice). Read instead from the covering index
  `idx_ae_instance_ts_cover`, index-only, each run. Known limit: after the 180-day event retention removes a device's
  first item, a device active for more than six months could read as *tour* again; `screen_mode` removes the limit.
- **Recomputing whole days for all devices** on each run. Rewrites everything to pick up a handful of late rows.
- **Pre-computing each filter combination** (what the mockup did). Filters could not be combined.
- **Screenshots from users' phones.** Never: privacy, and the owner's rule; the pipeline renders our own demo data.

## What is not the same as the mockup, on purpose

- **"New" users:** a visit of this screen during the phone's first app open (`open_count = 1`) inside the range. The
  mockup used the same signal but over the device's whole 14 days; the page follows the range chosen.
- **Version and country** are the visit's own, not the device's first; a device that updated counts on both versions.
- **"Shared within 3 h"** is judged per visit from that visit's first invoice; the mockup took the device's first
  invoice across all its tour visits. The two differ only for a device with two invoice-making visits.
- **Every other screen's time** is the app's own `prev_screen_ms` when the next view names this screen, otherwise
  start to leave — the mockup used only `prev_screen_ms`.

## Checked

- Production (read-only), the mockup's window (14 days to 2026-09-28 15:09 UTC, release, Android, our 15 phones out):
  Create Invoice viewers **4,517** (mockup 4,516: one late arrival), views **8,931** (mockup 7,911 + 1,017 = 8,928).
  These are the filters the job uses.
- The visit, tap and nav rules are unit-tested one by one against the scripts (13 tests), and the job + every read
  with every filter on a real MySQL (4 tests). Full backend suite **1,621 / 0** on the Mac (baseline 1,604 + 17).
- The complete per-visit numbers (exits, idle, the tour's own counts) cannot be compared with the mockup before the
  job runs on production, because production events may not be copied to the Mac. **Owed after deploy:** open the
  page for 14 days and set it beside the mockup's figures (tour 4,314 devices / 6,416 visits / 880 invoices; no tour
  964 / 2,499 / 221), expecting them within late arrivals and the differences above.

## Deploy order (not done — the owner's yes on the tables first)

1. Backend `1587db3` alone (the migration). Additive; both jars run against it.
2. Backend `788a179` + `85f3f87` (the job starts 10 minutes after boot and fills 32 days).
3. Panel `feat/screen-map`. When the screenshot pipeline publishes, set `NEXT_PUBLIC_SCREENMAP_MANIFEST_URL` on Vercel.
