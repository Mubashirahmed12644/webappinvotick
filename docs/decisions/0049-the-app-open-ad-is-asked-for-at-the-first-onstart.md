# 0049 — The app-open ad is asked for at the first onStart, not when the SDK is ready

**Status:** decided, built (app branch `VC_96_VN_144`; next release 1.4.5, versionCode 100) ·
**Date:** 2026-09-11 · **Goals:** monetisation, G1 (a shorter first-open splash) · **Related:**
[0047](0047-plays-answer-decides-premium-on-a-device.md)

## What happened

- The owner asked for this flow:
  - request the app-open ad at once, gated only by the saved premium flag (false by default);
  - let Play answer in parallel, and set premium if it says so;
  - check again at show time, and never show to a premium phone.
- The request side was already the rule — 0047 says requests never wait for Play. The first request
  was held by something else. `MyApplication.onStart` preloaded only `if (adsInitialised)`, and on a
  first open the SDK finishes initialising after the first onStart. So the preload never ran, and the
  first request waited for the splash to make its own.
- Measured on the Pixel (debug build), first open:

  | Moment | Time from process start |
  |---|---|
  | onStart | 1.86 s |
  | the splash's request | 2.89 s |
  | SDK ready | 3.55 s |
  | ad loaded | 5.55 s |
  | ad shown | 5.62 s |

- Production, 1.4.4, first opens since 2026-09-10 (the first app-open request of each process):
  35 of 218 under 1.5 s, 63 in 1.5–3 s, 69 in 3–6 s, 51 at 6 s or later. The splash waits 6 s for the
  ad.

## Decision

1. **The first onStart asks for the app-open ad whether or not the SDK has finished initialising.**
   The gate still checks, in this order:
   - foregrounded — a WorkManager wake never asks;
   - premium — the saved flag, or Play's ACTIVE;
   - config enabled;
   - Play Services available;
   - not already loading;
   - no fresh ad cached.
2. **The SDK's completion callback still calls preload, as a second chance.** It normally answers
   "already loading"; it matters when the first load failed before the SDK was ready.
3. **The show is unchanged.**
   - Premium from either signal refuses it.
   - "Not premium" still needs Play's confirmation, bounded at 1.5 s from the splash's start (0047).
   - In both measured launches Play answered about 1.8–1.9 s after process start, before either ad
     loaded, so the bound held nothing.

## Rejected

- **Waiting for the SDK** (the old behaviour) — nothing needs it:
  - there are no mediation adapters to initialise;
  - on the measured first open the splash's own load ran before the SDK was ready, and it filled;
  - `AppOpenAdManager.loadAd` catches what `AppOpenAd.load` throws when WebView cannot load.
- **Firing in `Application.onCreate`** — WorkManager starts the process every 15 minutes. That is
  where the 2,138 requests made for nobody came from (`AndroidAppOpenAdGate.preload`).
- **Showing before Play has answered** — this would show an ad to a paying user who reinstalled,
  whenever Play is slow. It is the owner's own rule (0047). Kept, since it costs nothing when Play
  answers first.

## Consequences

- On cold starts, `ad_request.path` reads `preload` where it used to read `splash`, because the splash
  now joins a load already in flight. Shows still read `splash`. The number of requests does not
  change; the path they are filed under does.
- To watch after release:
  - how soon each process makes its first app-open request (`ms_since_start` on the first app_open
    `ad_request`);
  - `splash_ready.wait_ms` on first opens;
  - `app_open_decision` on the splash path — `load_timeout` should fall and `ad_dismissed` rise;
  - `store_unverified`, which should stay near zero.
- The AABs on the Desktop — named 1.4.6 and 1.4.7, built before the next release was renamed 1.4.5 —
  predate this change. The 1.4.5 bundle is built only on the owner's word.
- **Verification on the Pixel (debug):** pending. The owner was using the debug app, and installing
  the new build closes it.
