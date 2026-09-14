# 0103 — Meta Audience Network joins AdMob mediation in 1.4.6

**Status:** the owner's instruction, 2026-09-14:
> "is latest version main facebook montization ka mediation adapter lagwao and iky baad isko khud test bhi kerwao aik
> agent sy ky wo sahi kaam ker rha hy yaan nhi"

It is being built for Android first. iOS follows once its ads are live, since they wait on the owner's AdMob setup.

**Related:**
- AGENTS.md §1: monetisation is a requirement; measure the gain and the cost;
- `memory/monetisation-measure-never-assume.md`;
- `memory/admob-webview-crash.md`;
- `memory/app-library-audit-2026-09-11.md`.

## Decided

- **The app gains the Meta Audience Network adapter** for its AdMob mediation (Android, 1.4.6). With it, Meta can bid
  for the app's ad slots next to AdMob.
- **A separate agent tests it on a device** after the build. It checks:
  - the adapter starts;
  - AdMob ads still load and show as before;
  - nothing new crashes;
  - Google's mediation test tool shows Meta's state.
- **The console side is the owner's**, from written steps:
  - Meta's app and placements;
  - Meta added to AdMob's mediation groups;
  - Play's Data safety form;
  - an app-ads.txt line, if Meta needs one.
  Until that is done, the adapter sits idle, and nothing changes for users.
- **Both the gain and the cost are measured.**
  - The gain: Meta's share of impressions and revenue, through the existing `ad_source` on the ad events.
  - The cost: app size, start-up work and crashes.

## Rejected

- None was offered; this is the owner's instruction.
