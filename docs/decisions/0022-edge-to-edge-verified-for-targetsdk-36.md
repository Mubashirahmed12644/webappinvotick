# 0022 — Edge-to-edge is verified for targetSdk 36, and needed no code

**Date:** 2026-08-10
**Status:** Accepted
**Context:** Play Console compliance — targetSdk 36 by 31 Aug 2026

## The obligation

Android 16 makes edge-to-edge mandatory: the app window is the whole display, the system bars are
drawn on top of it, and there is no opt-out. `android-targetSdk` and `android-compileSdk` moved
35 → 36 on 2026-07-25. The note attached to that change said the whole app needed a visual pass,
"especially keyboard/IME screens, full-screen dialogs and any screen relying on system-bar insets".

## What was checked, and how

The window is confirmed edge-to-edge on device: `dumpsys window displays` reports `app=1080x2340`
equal to `init=1080x2340`, with no inset carve-out, and the installed package reports `targetSdk=36`.

Seventeen surfaces were captured and measured:

- the five bottom-nav destinations, create-invoice, the drawer, Appearance, Manage Business, the
  premium sheet, an invoice detail and its preview
- **a keyboard raised over a bottom sheet** — the case the note calls out first
- **a full-screen dialog** (the guest exit dialog)

The measure is UNIFORMITY of the strip behind each bar, not colour. A background reaching the screen
edge is correct — that is what edge-to-edge means. What is wrong is CONTENT under a bar: text a user
cannot read, a control they cannot reach. A band that is one flat colour is background; a band
carrying many distinct colours has glyphs or controls in it.

Every screen came back at 3–4 distinct colours in the status band — the system's own clock and
icons, and nothing else — and 2 in the navigation band.

## Result

**No defects, and no code changed.** The app's 172 existing inset call sites
(`statusBarsPadding`, `navigationBarsPadding`, `imePadding`, `safeContentPadding`) already do the
work. The keyboard screen pushes its content correctly and leaves the sheet's primary action above
the IME. The dialog measured 10.41:1, 5.18:1 and 6.06:1 on its title, body and button.

## Two things this cost, worth keeping

**A tap that lands nowhere reports success.** Two screens in an earlier pass looked tested and were
not: a Maestro `tapOn` that finds nothing only WARNs, and blind coordinate taps wandered into
unrelated screens three times. Both were caught only by md5-ing every screenshot and noticing
duplicates. Screens are now reached by resolving an element's real bounds from the accessibility
tree, and a miss is reported rather than tapped.

**A keyboard screenshot is not a keyboard.** The first attempt captured what looked like an IME
screen; `dumpsys input_method` said `mInputShown=false`. The keyboard had never appeared. Any claim
about IME behaviour is now gated on that flag rather than on the picture.

## Still outstanding for the 31 Aug deadline

Neither of these can be done from here:

- **Billing 9 purchase test** on a real device (sandbox purchase → acknowledge → restore). A clean
  compile proves nothing about runtime behaviour, and executing a purchase is the user's to do.
- **The release upload itself.** `versionCode` is still 90, which is what is live.
