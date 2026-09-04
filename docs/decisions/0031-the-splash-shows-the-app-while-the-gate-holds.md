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

## Addendum 2026-09-04 — the picture is keyed to the destination, not to the open count
The owner asked whether the skeleton should show only on the first open, or stop once the user has
reached the create-invoice screen, or once an invoice exists. None of those is the rule. The splash's
destination is decided by `hasCreatedFirstInvoice` (create-invoice until one exists, then the
dashboard), and in 30 days 161 of 276 returning opens still landed on create-invoice. So the hold
shows **the skeleton of wherever the splash is about to go**: create-invoice → the create-invoice
skeleton (a block-for-block copy of that screen); dashboard → a dashboard skeleton; auth/unknown →
the logo as before. "Stop after the first invoice" follows by itself, because the destination
changes. A create-invoice skeleton on a dashboard-bound open would be the mismatch this decision
exists to remove.

## Rejected
- Navigate to content at `splash_ready` and show the ad over it when it loads — keeps impressions but
  changes when the ad interrupts; that is the owner's call, not a default.
- A "Skip" after N seconds — weakens the gate; same reason.
- Shorten `firstOpenTimeoutMillis` — same reason.

## Consequences
Measure after release: rung-1 `left_waiting_for_ad` and its `after_ready` breakup, and app-open
impressions on first open, side by side.
