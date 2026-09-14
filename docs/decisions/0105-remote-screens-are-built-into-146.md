# 0105 — Remote screens are built into 1.4.6

**Status:** decided by the owner on 2026-09-14 ("Haan, 1.4.6 mein hi").
- The analysis is in `docs/REMOTE-SCREENS-ANALYSIS.md`.
- The seven decisions on how it is built are asked one at a time.

**Related:**
- 0098 and 0053, the native recovery screens in 1.4.6;
- AGENTS.md §3, one HTML engine everywhere;
- AGENTS.md §1: never weaken an ad.

## Context

- **The idea.** The owner's long-held idea: screens designed in the admin panel, shown inside the app, with their
  settings and navigation set in the panel.
- **The stores allow it,** provided the phone downloads data only, never code, and no remote screen asks for a password
  or a payment.
- **The case that started it is rare.** 8 phones went from a registered account to a guest since 2026-07-20, and 7 of
  them are ours. 1.4.6 already handles the known recovery paths natively (0098, 0053).
- **Reach** grows with the rollout. In the week to 2026-09-14, 741 Android devices were still on 1.4.2.

## Decided

- **Build it for 1.4.6.** Phase 1 of the analysis, the pipe and a first announcement, takes about 3 weeks:
  - **Server:** the screens table, whose migration ships alone and first, on the owner's word. Also the phone's endpoint,
    admin routes with a publish log, images with end dates, and a Health Centre card.
  - **Panel:** a Screens page with blocks, rules, a schedule, a preview, and "send to my test phone".
  - **App:** fetch, cache, rules, the sheet and the full screen, the blocks, the first destinations, the kill switch
    and the events.

## Rejected

- **After 1.4.6.** This was the recommendation, to keep 1.4.6 on time.
- **Not now.**

## Consequences

- **1.4.6 ships about 3 weeks later** than it otherwise would.
- **The screens table is a migration,** so it needs the owner's word before it ships.
- **Still to decide, one at a time:**
  - how screens are drawn;
  - the first use;
  - the account-X screen;
  - who publishes;
  - how often;
  - the holdout;
  - text fields.
