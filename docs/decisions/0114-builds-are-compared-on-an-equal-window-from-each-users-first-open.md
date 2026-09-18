# 0114 — Builds are compared on an equal window from each user's own first open

- **Date:** 2026-09-19
- **Status:** the feature was asked for by the owner ("version wise comparison report ka feature bana dain",
  2026-09-19). Built by the user-journey agent, not deployed:
  - backend `invotick-apis` branch `feat/journey-version-comparison`;
  - panel `invotick-admin-panel` branch `feat/journey-version-comparison`.
  The choices marked *(agent)* below are the owner's to confirm.
- **Decision:** Funnel Analysis gets a second journey mode, **"Version ka muqabla"**, next to "Pehli invoice ka safar".
  It is not a sidebar page (AGENTS.md 5a). It is served by a new endpoint,
  `GET /v1/webpanel/analytics/journey-comparison`, `@RequireRole(ADMIN)`. Its parameters: `versions` (2 or 3 codes),
  `baseline`, `windowHours` (1 | 24 | 72 | 168), `from`/`to` (at most 60 days), `country` + `excludeCountry`, and
  `buildType`.
  1. **Every first-time device is read over the same window from its own first open**, by `event_timestamp`. A device
     whose window has not passed yet is counted apart as "abhi waqt poora nahi", never as a device that made no invoice.
  2. **A device belongs to the build of its first first-open cold start in the range**, over every build. Devices on
     `testing_devices` are left out.
  3. **The ladder is the journey's own CASE, copied.** `JourneyComparisonStepsMatchTheJourneyTest` fails the build when
     the two differ. It was copied because the journey's file was being fixed for a 502 at the time. A ninth row counts
     `invoice_shared_success` inside the window, the G1 proof of decision 0006.
  4. **"Peeche, shor se zyada"** means a pooled two-proportion z of -1.96 or lower against the baseline, with both
     cohorts at least 50 devices. Below 50 the cell says `too_few`. Each cell shows a 95 % Wilson interval. *(agent:
     threshold and test)*
  5. **Country is the device's**: the first non-null `country` on any of its events inside the window. The cold start
     row carries none 93 % of the time.
  6. The panel warns when the builds' first-open dates do not overlap, because version and calendar/campaign cannot
     then be told apart.
- **Why:** On 2026-09-19 the panel showed 1.4.7 (vc106) at 61/399 = 15 % and 1.4.6 (vc105) at 20 %. The journey
  endpoint counts an invoice made at any time up to the end of the range. So 1.4.6's users had had 1 to 3.5 days, and
  1.4.7's a few hours. Read on equal windows, release, Android, test phones out:

  | vc | 1 h | 24 h |
  |:--|--:|--:|
  | 101 (1.4.5) | 220/1159 = 19.0 % | 247/1152 = 21.4 % |
  | 105 (1.4.6) | 73/454 = 16.1 % | 83/446 = 18.6 % |
  | 106 (1.4.7) | 52/385 = 13.5 % | 13/84 = 15.5 % |

  106 against 105: z = -1.04, not provable. 106 against 101: z = -2.44. About half of the panel's 5-point gap was
  exposure time.
- **Rejected:**
  - *Adding a window parameter to `first-invoice-journey`.* That file was under another fix. Its `withinMinutes` already
    means "range length", so the same word would have meant two things.
  - *A new sidebar page.* It answers the journey's own question, so it is a mode of that page.
  - *Arrival time (`created_at`).* One flush stamps a whole batch.
  - *Hard-coding the memory's list of test phones in the backend.* `testing_devices` is the one list the panel edits.
    The phones missing from it are the owner's to add.
  - *Stop reasons per build in this view.* They are the next step, not this one: `JourneyStopReasons` reads signals
    over the range, not over the window.
- **Cost:** it reads the first-open cold starts of the range (about 3,300 rows for 30 days), then each chosen device's
  events inside its window, both through indexes. Measured on production: about 6 s for 30 days, with a 24 h window and
  with a 7 d window. It returns one row per build × step × share flag.
