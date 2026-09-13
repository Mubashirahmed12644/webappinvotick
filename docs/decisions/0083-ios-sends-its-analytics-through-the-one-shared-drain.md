# 0083 — iOS sends its analytics through the one drain Android already runs

**Status:** built on 2026-09-14 by the user-journey agent (`63f7174b`, `24134092`) and merged into `VC_102_VN_146`.
It reaches iPhones with build 17, on the owner's word.

**Related:**
- AGENTS-EVENTS §1.17: a second surface joins the pipeline;
- §1.18: the iOS version-floor exemption of 2026-09-11;
- §1.20: a queued event keeps its identity;
- `memory/ios-what-is-still-stubbed.md`.

## Context

- **No iPhone had ever sent an event.** Up to 2026-09-13 20:34 UTC, production held 0 rows with
  `app_version_code < 50`, ever.
- **The server was not the blocker.** The version floor has let iOS through since 09-11.
- **The blocker was on the phone.**
  - The iOS `AnalyticsSyncScheduler` was two `println`s.
  - The drain, `AnalyticsFlusher`, lived in androidMain, so nothing on iOS could empty the queue.
- **Nothing on iOS called `startSession()`.** So every iOS event:
  - went out without a session;
  - went in a request of its own;
  - left no `analytics_sessions_v2` row, and so no platform.
- **The Simulator's queue held 300 events** from builds 4, 9, 11 and 16, every one with `createdAt = 0`.

## Decided

- **One drain for both platforms.** `AnalyticsFlusher` moves to commonMain, changed in two places only:
  - its logging, where Android keeps its tag and levels;
  - the `IOException` it names, which is the same class on Android.
- **iOS decides only when the drain runs:**
  - at launch;
  - 2 s after the last event, as on Android;
  - every 15 minutes on screen;
  - on returning to the foreground;
  - on entering the background, inside a UIKit background task;
  - in the background sync pass.
- **Where the app may be about to stop, a trigger waits for a drain already running** (`waitForRunning`) instead of
  skipping it. Android's callers do not use it.
- **Every iOS event carries a session.** It uses `getOrStartSession()`, as Android has since `0bcc846a`.
- **Queue items get a real enqueue time.**

## Rejected

- **A separate uploader for iOS.** The iOS copy of the manager had already drifted from Android's twice: in the
  session id and in `createdAt`.
- **Sending only from Apple's background scheduler.** It runs when iOS chooses, often hours late.
- **Rewriting old queued events to the new device id.** They keep the identity they were recorded with (§1.20).
- **Guessing the platform from build numbers** (`< 50` means iOS). It breaks as iOS build numbers grow.

## Consequences

- **Proven on the Simulator against production** (read-only):
  - the queue went from 300 to 0;
  - 316 rows were stored, against 0 ever before;
  - 4 iOS rows appeared in `analytics_sessions_v2`;
  - the 16 new events with a session all join to a session row;
  - every row is `build_type=debug`, and the Simulator is on the internal list.
- **In build 17's first minutes, each real iPhone sends its whole old queue:**
  - under the all-zero device id;
  - with the build numbers the events were recorded on (13–16);
  - with no session.

  Read these rows by `event_timestamp`. They are backlog, not new users.
- **Still no iPhone in the G1 journey.** The journey starts at `app_cold_start` with `is_first_open`, and iOS sends no
  lifecycle events. Whether to build the iOS lifecycle observer is the owner's question.
- **Not verified:**
  - a real iPhone;
  - the 15-minute tick;
  - `scheduleImmediateSync`, which only the exit path reaches;
  - a real `BGAppRefreshTask` wake-up.
- **Questions queued for the owner:**
  - build 17;
  - a `platform` column on `analytics_events` (a migration), or the session join with "Unknown";
  - the iOS lifecycle observer;
  - moving CI's test and docker jobs off the production server;
  - `sync_failure.platform`, with the build-94 floor applied to Android only.
