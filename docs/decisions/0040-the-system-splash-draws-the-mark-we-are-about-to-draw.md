# 0040 — The system splash draws the mark we are about to draw

**Date:** 2026-09-05 · **Status:** decided by the owner, implemented on `VC_95_VN_143`
**Builds on:** [0038](0038-the-hold-shows-one-branded-loader-not-a-picture-of-the-screen.md)

## Context

0038 replaced the grey skeleton with a branded loader. It helped, and the owner's complaint survived
it, because the loader was never the part he was looking at. Measured from a recording of the new
build on a Pixel 7 Pro, 8 fps:

```
2.13 s   a static square icon appears
         <- 2.75 seconds of nothing changing
4.88 s   the round ring and "Setting up your workspace"
```

**The square icon is not ours.** It is the system splash: Android draws it from the launch theme
before our process can paint anything. No amount of moving work off the first Compose frame reaches
it, because we are not running yet. That is the honest answer to the owner's *"can't we start the
loading immediately"* — **we cannot draw earlier than the platform allows.**

But we can decide what the platform draws. His words, and they are the whole decision: *"we decided
the round icon at the same position where the loading runs"*.

## Decision

**The system splash icon becomes the round mark, at the same size, in the same place, from the same
file the Compose loader draws.** The handover then has nothing to show: the mark does not change
shape, size or position, and the wait stops reading as "a static icon, and then finally something
happens".

Three things make that true:

1. **Same artwork.** `splash_icon_round_src.png` is the round launcher mark, circle-masked by
   `tools/icon/CircleSplashIcon.java`; `PreparingBrandLoader` and `window_background.xml` draw that
   same file. The square art and `RoundSplashIcon.java` that made it are deleted — the reason they
   existed (a rounded-square hold screen, and a circular platform mask to fight) inverted with 0038,
   and the platform's mask is now working with us.
2. **Same size, by arithmetic rather than by eye.** An `<inset>` takes *absolute* insets, so
   `rendered art = icon bounds − 2 × inset`, and the target is the loader's own visible circle:
   `LOGO_SIZE 138dp × 0.945 opaque = 130.4dp` (the missing 5.5% is the artwork's drop shadow).
3. **No exit animation.** `installSplashScreen().setOnExitAnimationListener { it.remove() }`. The
   platform's default zooms and fades the icon away, which is right when the app underneath looks
   nothing like the splash; here it would be a movement between two identical pictures, and the last
   thing left that could read as a jump.

### The inset differs by API, because two different things draw the icon

| | who draws it | icon bounds | inset | result |
|---|---|---|---|---|
| API 24–30 | `core-splashscreen` 1.0.1 itself | **288 dp**, exact | 75 dp | 138 dp of art — exact |
| API 31+ | the platform | **~232 dp**, measured | 50 dp | 132–140 dp of art — ±2% |

288dp is not a guess: `Theme.SplashScreen.Common` sets `windowBackground` to
`compat_splash_screen_no_icon_background`, whose icon item is `splashscreen_icon_size_no_background`
= 288dp, read out of the 1.0.1 AAR. From API 31 the library stops drawing and maps onto the
platform's `android:windowSplashScreen*`, and the platform picks its own bounds — the old square art
at inset 40dp measured ~152dp wide on a 409dp screen, which puts those bounds near 232dp.

## What is **not** achievable, stated plainly

- **The mark on the system splash does not move, and cannot be made to without a cost we should not
  pay.** The platform runs a splash icon that is `Animatable`, but the only ways to animate *this*
  mark are to trace the artwork as vector paths — it would drift from the real logo, which is the
  exact failure 0038 exists to avoid — or to ship a frame sequence, roughly 0.5 MB of PNGs for one
  launch. Neither is worth it. The mark is still for those 2.75 s.
- **On API 24–30 it is impossible regardless.** `Animatable` appears nowhere in core-splashscreen
  1.0.1's classes (checked, not assumed), so an animated icon is never started on that path.
  `minSdk` is 24, so a real share of installs could never have had it.
- **The ring is not on the system splash at all**, and that is deliberate. The Compose ring is
  `colorScheme.primary` from a scheme generated at runtime from the user's seed (decision 0021); the
  system splash is drawn before the app runs and cannot know it. Putting a ring there would add the
  one thing guaranteed to mismatch. Instead the ring **fades in over 200 ms** when Compose takes
  over, so the single genuine difference at the handover is a deliberate arrival rather than a pop.
- **The API 31+ inset is a calibration, not a certainty** (±2%, one knob, documented in
  `drawable-v31/splash_icon.xml`). If the mark changes size at the handover, that number is the only
  thing to change.

Also fixed here, and separate from the above: `RING_STROKE` was carried across from the web loader
as the literal `3dp`. The web ring is 3px on a 68px box — **4.4%** — and the box is now 150dp, so
the literal made the ring less than half as heavy as the one it is meant to match (2.0%). It is now
**6dp**, restoring 4.0%.

## Rejected

- **Shortening or skipping the system splash** — not ours to shorten, and the ad gate and its timing
  are untouched here as in 0038.
- **Tracing the logo as vector paths to get an `AnimatedVectorDrawable`** — see above; a second,
  drifting copy of the mark is worse than a still one.
- **A frame-sequence `AnimationDrawable`** — ~0.5 MB of PNGs, and unverifiable here.
- **Dropping `windowSplashScreenAnimatedIcon` so `window_background`'s 138dp mark shows instead** —
  with no icon declared the platform draws the background colour and nothing else. That is the bug
  the icon was added to fix in the first place.
- **One inset for all APIs** — it cannot be right for both; 288dp and ~232dp bounds are 24% apart.
- **Changing the Compose `LOGO_SIZE` to match whatever the system renders** — the system side is the
  one that cannot be measured from code, so the fixed number belongs on the side we control.

## Consequences

- `LOGO_SIZE` (138dp) is now a contract across three files: `PreparingBrandLoader`,
  `window_background.xml` (drawn at exactly 138dp, no platform scaling involved) and both
  `splash_icon.xml` insets. Change one, change all four.
- **Verify on a device, in this order:** (1) does the mark change size when the loader takes over —
  if so, adjust the v31 inset only; (2) does it change position — it should not, the loader is
  centred on the full window; (3) is the handover a cut rather than a zoom.
- Still not fixed, and still another brief's: the invoice number `Auto` → `XX2609001` and the
  currency `USD` → `PKR` changing after the screen appears (G3).
