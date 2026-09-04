# 0038 — The hold shows one branded loader, not a picture of the screen it is heading to

**Date:** 2026-09-05 · **Status:** decided by the owner (he rejected the shipped skeleton on a device), implemented on `VC_95_VN_143`
**Reverses:** [0031](0031-the-splash-shows-the-app-while-the-gate-holds.md) and its addendum — the remedy, not the diagnosis.

## Context

0031 read the drop-off correctly and that reading is untouched: 35 of 67 first-time devices that
stopped at "opened the app" left during the app-open gate's hold, the ad is not the reason, the
blank screen is. Its **remedy** was to draw the app taking shape — a block-for-block grey skeleton
of whichever screen the splash was about to open, plus a determinate bar and one line.

That got built (`8b216372`, `c0a1e4b8`): `PreparingSkeleton.kt` at 672 lines, `DashboardSkeleton.kt`
at 619, a `HoldDestination` enum to pick between them, and a bar polling the clock every 32 ms.

**On a device it reads as a screen that failed to load, not one that is loading.** The owner
rejected it. What is actually on screen:

- A full page of grey blobs. That is what a broken render looks like; nothing on it says work is
  happening.
- The highest-contrast element is a blue-outlined box in the middle, and it is **empty**. The eye
  lands there and gets nothing.
- The only words, "Getting ready…", are at the very **bottom**, under everything.
- **No brand anywhere** — on the first screen a new user ever sees.
- A **back arrow that does nothing**, on a screen where nothing works.

A screen recording of a real first launch (fresh install) also showed the sequence the skeleton was
designed against was not the sequence that happens:

| | |
|---|---|
| ~3.0 s | system splash — the app icon alone on white |
| ~1.5 s | the hold screen |
| ~2.5 s | the app-open ad |
| ~0.8 s | the hold screen **again** |
| | create-invoice, then the onboarding overlay |

The hold screen is shown, interrupted, and shown again. Watching the app "take shape", being taken
away, and returning to the same unfinished-looking page is a large part of why it reads as broken.

## Decision

**One calm, centred, branded thing that is obviously alive**, the same for every destination: the
Invotick mark still inside a ring that turns, and one line that changes every 2 seconds. Both
skeletons and the destination-keyed picture are deleted — 1,291 lines gone.

**The gate is still untouched.** Same gate, same timeout, no skip, no change to when the ad shows.
Only what the user looks at during the hold changes. That was 0031's rule and it still holds.

### It is the loader the invoice preview already uses

Not a second one. `renderer/main.tsx` `SkeletonPage` already shows this while an invoice renders,
and the app now ships a byte copy of that loader's artwork (`renderer/invotick-logo.png`, itself the
round launcher icon — the Play Store PNG is stale and was not used). The geometry is carried across
from its CSS, with the ratios preserved and a table in the Kotlin naming the CSS as its twin:

| renderer CSS | app |
|---|---|
| 68 px box / 62 px logo | 96 dp / 88 dp |
| `3px solid rgba(37,99,235,0.15)` | 3 dp at `primary` α 0.15 |
| `border-top-color: #2563eb` | 90° arc at `primary`, centred on top |
| `aospin 0.9s linear infinite` | 900 ms, linear, restarting |

One deliberate difference: the ring reads `colorScheme.primary` instead of the web's hardcoded
`#2563eb`, so it is right in dark mode and survives a seed change. It is drawn by hand rather than
with `CircularProgressIndicator` because M3's indeterminate spinner is a *stretching* arc — beside
the web's constant-width one it would read as a second, different loader.

### The three lines

`Setting up your workspace` → `Preparing your invoice` → `Almost ready`

Each is true of the launch on its own (settings and preferences load, and on a first open the local
guest account is created; the destination is the create-invoice screen on first opens and on 161 of
276 returning opens; then it ends). Each is short enough to hold one line, and `autoSize` with a
width constraint shrinks rather than wraps at `font_scale 1.5`, so the mark above never moves.
Spanish is translated alongside. The old line grew dots on the end — `Preparing your invoice…` —
which meant the screen was showing an unfinished sentence most of the time; whole lines now fade
into whole lines.

### The bar is gone

Its fraction was elapsed ÷ **the gate's timeout**, which is not a prediction. On the recorded launch
the gate released at ~2.4 s of a 6 s window, so the bar sat at ~15 %, showed ~65 % after the ad, and
the screen left without it ever finishing. A bar that cannot reach its end is a promise about a
duration nobody knows: it undersold a short wait and would have oversold a long one, and "this will
take a while" is the wrong thing to tell someone 2 seconds from their first invoice. An
indeterminate ring is the honest shape for a wait whose length depends on ad fill. Removing it also
takes a 32 ms polling loop out of the frame this screen exists to keep cheap.

### The lines survive the ad; they do not restart, and they do not pause

The step is a **pure function of the clock** (`holdStepIndex(elapsed, 2000, 3)`), read off the same
`readyAtMs` mark the gate times itself against — not a counter ticking while the screen is visible.

- **It does not restart.** Returning from an ad to "step 1 of 3" would tell the user the launch had
  made no progress while in fact it is nearly over. They leave on line one and come back to
  `Almost ready`, which is true — the app is ~0.8 s away.
- **It does not pause.** A counter that resumed where it paused would still owe 4 seconds of cycle
  with 0.8 s left, so the lines would lag reality by exactly the length of the ad.
- **It clamps at the last line** instead of wrapping. Six seconds in, showing
  `Setting up your workspace` again would be a claim the app had started over.
- **A hold shorter than 2 s** — a warm start, or an ad already cached — shows only the first line,
  complete. There is no fragment to catch and nothing to unwind.

No ad-awareness, no lifecycle observer and no view model were added to get this; it falls out of
using the clock. `HoldStepIndexTest` pins all four properties.

### Nothing heavy went back into the landing frame

The reason 0031's skeleton existed is that heavy content in the first frame after the gate cost
371 ms on a Pixel 7 Pro. The replacement is one image, one `Canvas` and one text; the rotation is a
`graphicsLayer` read, so it animates in the draw phase and recomposes nothing, and the text wakes at
most twice for the whole hold.

## Rejected

- **Keeping the skeleton and fixing its faults** (drop the back arrow, move the text up, fill the
  blue box) — the faults are not incidental. A grey imitation of a screen that is not there is the
  wrong idea, and no amount of polish makes a page of placeholders say "working".
- **A determinate bar over a longer or smoothed window** — still a promise about a duration that
  depends on ad fill. Any denominator we have is a timeout, not an estimate.
- **Pausing the line cycle while the ad is up** — see above; it makes the lines lag reality by the
  length of the ad.
- **A shorter, different state after the ad** — unnecessary once the step is clock-derived, and it
  would be a second thing to design and keep in step with the first.
- **Making the ad shorter, skippable, or later so the loader reads better** — monetisation is a
  requirement, not a variable (`memory/monetisation-measure-never-assume.md`). The sequence is
  designed for as it is.
- **Keeping `DashboardSkeleton` for returning opens** — the destination-keyed picture was 0031's
  addendum, and it exists only to choose between skeletons. With one loader there is nothing to key.

## Consequences

- `PreparingSkeleton.kt`, `DashboardSkeleton.kt`, `PreparingProgress`, the `HoldDestination` enum
  and the `splash_preparing` string are deleted. The destination is still on the `splash_ready`
  analytics row, which is where it was actually needed.
- `SplashScreen`'s `gateWindow` parameter is now unread by the UI. It stays plumbed because it
  carries the gate's own remote-config timing; whether that plumbing goes is the owner's call, not a
  side effect of a loading-screen change.
- **Measure after release, as 0031 asked:** rung-1 `left_waiting_for_ad` with its `after_ready`
  breakup, and app-open impressions on first open, side by side. The gate did not change, so a move
  in drop-off with impressions flat is this screen.
- Two things visible in the same recording are **not** covered here and belong to another brief: the
  invoice number changing `Auto` → `XX2609001`, and the currency changing `USD` → `PKR`, both after
  the screen appears. A money symbol that changes in front of the user is a trust problem (G3).
