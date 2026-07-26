# 0008 — Making the app adaptive

- **Date:** 2026-07-26
- **Status:** decided — phase 0 starting
- **Decision:** Make the Android app adaptive across every form factor, in five phases, applied
  **directly** rather than behind remote flags, with Play staged rollout as the undo mechanism.
  RTL ships as its own separate release.

## Why now

Two reasons, and the first is not optional. The app declares no `screenOrientation` and no
`resizeableActivity`, so it **already** rotates and resizes — a tablet or foldable user is seeing
today's layout stretched across a screen it was never designed for. targetSdk was raised to 36 this
week, and large-screen resizability opt-outs are being removed at that level (confirm the exact rule
before planning dates around it). The second reason is opportunity: large screens are users we
currently serve badly.

## Where the app actually is

| | |
|---|---|
| Screens | 64, across 17 feature modules |
| `WindowSizeClass` / adaptive APIs | none anywhere |
| Hardcoded `dp` widths/sizes | 1,151 |
| Fixed `.height(...dp)` | 529 |
| `fontSize` in `sp` / in `dp` | 442 / **0** |
| `remember` / `rememberSaveable` | 484 / **0** |
| `contentDescription` set / null | 634 / 94 (of 840 icons) |
| `android:supportsRtl` | `false` |

## The phases

| # | Phase | Notes |
|---|---|---|
| 0 | One `WindowSizeClass` at the root, exposed via CompositionLocal | No UI changes at all |
| 0.5 | `rememberSaveable` for state that must survive a configuration change | Before the rest, not after |
| 1 | Navigation shell: bottom bar → rail → permanent drawer | One change, all 64 screens benefit |
| 2 | Content-sized layouts (max width, stop hardcoding heights) | Fixes tablets **and** font scale |
| 3 | List/detail two-pane for the few screens that earn it | Invoices, clients, products |
| 4 | RTL | Its own release |

## Found while testing: the app switches the user's font setting off

`core/ui/theme/FixedFontScale.kt`, applied at the root in `Theme.kt`:

```kotlin
/** This ensures that all text in the app ignores the user's font size settings */
CompositionLocalProvider(LocalDensity provides Density(base.density, fontScale = 1f))
```

Setting the device to 150% font and relaunching changes nothing on screen — which is how this came
to light. `Typography.kt` goes further, with `dpToSp(dp) = dp`, so the 442 `sp` sizes are `dp` values
wearing an `sp` label.

Someone who enlarges their system font has told us they cannot read small text. The app hears that
and declines. There is no crash, no report, and nothing in any dashboard; they simply stop using it.

This changes what phase 2 is. It is not "fix 529 fixed heights so text stops clipping" — text cannot
clip today because it cannot grow. It is **remove the clamp and fix the 529 heights, together**,
because removing the clamp alone would break every one of those containers at once. That ordering is
not optional, and the size of it is a decision for the product owner rather than a cleanup:

- Ship both together, staged. The honest fix.
- Ship the clamp removal capped (say 1.3×) first, then widen. Smaller blast radius, still a lie to
  the user who chose 2×.
- Leave it. Defensible only if we say out loud that the app is closed to those users.

**Not changed here** — deliberately. It was found by testing, not asked for, and it is far too large
to decide unsupervised.

## Why accessibility is not a separate phase first

The largest accessibility defect is 529 fixed-height containers holding text sized in `sp`: at 150–200%
font scale the text grows and the box doesn't, so it clips. That is the *same* defect as a layout that
breaks on a tablet, and it has the *same* fix — a user at 200% font scale is, in layout terms, a user
on a smaller screen. Running an accessibility pass first and an adaptive pass later would mean editing
those 529 sites twice. Phase 2 covers both.

What genuinely is separate — reviewing the 94 null `contentDescription`s (many are correctly null for
decorative icons) and the thin `semantics` usage — is small and unrelated, and becomes its own track.

- **Rejected:**
  - **Remote flags on the adaptive work.** Flags belong on *behaviour* you might withdraw — an ad, a
    login wall. This is *structure*: every screen built afterwards sits on it, so a flag means
    maintaining and testing two layout systems forever, and in practice it can never be switched off
    once features depend on it. There are already 14 flags, one of them a `Long` with several UI
    variants. Flag the leaves, not the trunk.
    The safety instead comes from the size class itself — a phone cannot reach the rail's code path,
    which is a stronger guarantee than a server-side switch — plus Play staged rollout, which costs
    no code.
  - **Shipping RTL with the adaptive work.** RTL is gated by locale, not by width, so it reaches phone
    users too and flips all 64 screens at once. Two structural changes in one release is the risk we
    are otherwise avoiding.
  - **A separate accessibility phase first** — see above; it would do the same work twice.
  - **Fixing screens one by one.** With 64 screens it does not finish. The shell and the containers
    are what change, and the screens follow.
  - **Computing the window size ourselves.** Phase 0 was first written against `LocalWindowInfo`,
    on the reasoning that no dependency was needed yet. That was wrong once "every form factor" was
    the goal: a width check cannot know there is a **hinge** through the middle of the screen, and
    tabletop posture isn't a width problem at all — the answer there is to use the bottom half and
    leave the top alone. `currentWindowAdaptiveInfo()` reports both. Rewritten before any screen
    depended on it.

## What Material 3 gives us, per phase

The plan leans on M3's canonical layouts rather than inventing arrangements:

| Phase | Screens | M3 |
|---|---|---|
| 1 | Navigation shell | `NavigationSuiteScaffold` — bottom bar / rail / drawer by size |
| 2 | Dashboard, Reports | **Feed** — responsive grid |
| 3 | Invoices, Clients, Products | **List-detail** — `ListDetailPaneScaffold` |
| 3 | Create Invoice + live preview | **Supporting pane** — `SupportingPaneScaffold` |

The supporting-pane one is worth calling out as a product change, not a layout fix: on a phone the
invoice preview is a bottom sheet, and on a tablet the same thing becomes a pane beside the form that
updates as you type. The renderer is already HTML that fits whatever box it is given, so this costs
close to nothing to build.

Our own `WindowWidthClass` / `WindowHeightClass` enums wrap the library's answer on purpose: 64
screens will branch on them, and the library's size-class API has already changed shape once.

## Consequences

- Phase 0.5 comes before the visible work: adaptive layouts mean the screen changes shape more often,
  so state that resets on a configuration change would become *more* visible, not less. Form data is
  already safe (it lives in ViewModels; only two search fields hold text in composition), but 484
  pieces of UI state — open sheets, dialogs, selections — reset on rotation today.
- `supportsRtl="false"` contradicts the web app, which already renders RTL for Arabic and Persian.
- Testing needs a device matrix, not one phone: the resizable emulator plus the real device.
