# 0085 — One lifecycle for both platforms, and an update is never a first open

**Status:** built on 2026-09-14 by the user-journey agent, on the owner's "Haan, banao" (`95558880`, `0234aa09`).
- Merged into `VC_102_VN_146`.
- It reaches iPhones in the build after 17.
- Android keeps its behaviour.

**Related:**
- 0083, the drain;
- AGENTS-EVENTS §1.17;
- the G1 journey, which starts from `app_cold_start` with `is_first_open`.

## Context

- **No iPhone had ever sent a lifecycle event:** 0 `app_cold_start` rows, ever. The G1 first-invoice journey starts
  from that event, so no iPhone could appear in it.
- **Android's lifecycle observer lived in androidMain.** Copies of the analytics code on iOS had already drifted from
  Android's three times that week.

## Decided

- **Android's lifecycle logic moves to commonMain,** as `AnalyticsLifecycle`.
  - Android's `AnalyticsLifecycleObserver` becomes its adapter.
  - Its constructor, preferences file, key, device census, log tag and events are unchanged.
- **iOS runs the same code** from `UIApplication` notifications. The launch clock is marked on the first line of
  `didFinishLaunching`.
- **An update is never a first open.**
  - `open_count` counts launches on this install, and `is_first_open` means `open_count == 1`.
  - An iPhone may have no stored count yet, but still have the analytics database on disk at launch. Every earlier
    build created that database, so this is an update, and the count starts at 2.
  - So no existing tester counts as a new user. For them the count is a minimum, not an exact number.
- **What `app_cold_start` carries on iOS:**
  - `webview_available=true` and `webview_package=WKWebView`;
  - no `webview_version` and no `prev_exit`, because iOS has no true equivalent (§1.7).
- **iOS network stamps stay off** until `IOSNetworkMonitor.registerCallback` gets a caller. On the Simulator they
  marked events as offline while those same events were uploading.

## Rejected

- **An iOS copy of the observer.**
- **Counting from 1 on an update.**
- **Leaving out `open_count`.**
- **Taking the device id or the main database as proof of an earlier run.** The app's own startup can create either one
  before the check runs.
- **Shipping iOS network stamps now.**

## Consequences

- **Proven on Simulators against production** (read-only):
  - an update sent `open_count` 2, then 3, with `is_first_open=false`;
  - a fresh install sent 1 and `true`;
  - the G1 journey, with the debug filter, counted only the fresh install.
- **Android's lifecycle now runs through shared code.**
  - Unit tests pass: 24/24 on each platform.
  - No Android device has run it yet. Check `app_cold_start` on an Android debug build before 1.4.6 is released.
- **Found, and handled separately:**
  - the iOS network monitor, which lives in the sync code;
  - `prev_screen`, which neither platform produces.
