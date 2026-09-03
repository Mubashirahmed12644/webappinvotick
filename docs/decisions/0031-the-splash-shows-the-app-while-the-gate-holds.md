# 0031 — The splash shows the app taking shape while the ad gate holds; the gate's timing is untouched

**Date:** 2026-09-04 · **Status:** decided (owner delegated the choice), being implemented on `VC_93_VN_142`

## Context
First open takes ~9 s to the first real screen. `splash_ready` fires at ~2 s; the app-open gate then
holds up to 6 s, and 84 % of first-time users get no ad in that window yet wait the full hold looking at
a logo and three dots. Of 67 first-time devices that stopped at "opened the app", 35 left during that
hold — 15 within 1 s of `splash_ready`, 15 within 1–3 s, 5 within 3–6 s, **none waited the full 6 s**.
The owner's reading, which the data supports: the ad is not the reason; the blank screen is. Network is
not it (fast networks bounce more), intent matters but not 3× (organic 6 %, campaign 20 %).

## Decision
- **The gate's timing does not change.** Its wait window is a monetisation setting; shortening it or
  adding a skip is a separate question for the owner with the revenue side alongside (memory:
  monetisation-measure-never-assume).
- **What the user sees changes.** After `splash_ready`, the splash draws the app taking shape: a
  skeleton of the create-invoice screen in theme colours, a thin determinate progress bar across the
  remaining gate window, and one line, "Tayyar ho raha hai…". When the gate releases, navigation
  proceeds as today.
- `splash_ready` now carries `reason`, `wait_ms`, `guest_login_ms`, `rc_ms`, `session_ms`, so the next
  measurement can say where the seconds went for the 13 who left before ready.

## Rejected
- Navigate to content at `splash_ready` and show the ad over it when it loads — keeps impressions but
  changes when the ad interrupts; that is the owner's call, not a default.
- A "Skip" after N seconds — weakens the gate; same reason.
- Shorten `firstOpenTimeoutMillis` — same reason.

## Consequences
Measure after release: rung-1 `left_waiting_for_ad` and its `after_ready` breakup, and app-open
impressions on first open, side by side.
