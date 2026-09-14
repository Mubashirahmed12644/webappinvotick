# 0105 — Remote screens are built into 1.4.6

**Status:** decided by the owner on 2026-09-14 ("Haan, 1.4.6 mein hi").
- **Moved to 1.4.7 the same day.** The owner froze 1.4.6: "ab naya kam koe open nhi kerna… build bana kerdo". They chose
  "Jo bana hai + premium text". None of this had been started.
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
- **How screens are drawn: decided the same day as B,** blocks designed in the panel and drawn by the app ("B: panel mein
  blocks").
  - A button can open a page on invotick.com in the app's existing WebView dialog, with no bridge into the app.
  - Rejected:
    - A, a whole HTML page in a WebView: heavier on old phones, no dark mode, and a bridge is needed to act in the app;
    - C, Firebase In-App Messaging: designed in Firebase's console, not our panel, and still labelled Beta.
- **Still to decide, one at a time:**
  - the first use;
  - the account-X screen;
  - who publishes;
  - how often;
  - the holdout;
  - text fields.
