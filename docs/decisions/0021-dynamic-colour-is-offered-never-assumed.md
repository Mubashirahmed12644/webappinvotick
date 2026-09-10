# 0021 — Dynamic colour is offered, never assumed; and it stops at the document

**Date:** 2026-08-09
**Status:** accepted — built
**Builds on:** the Material 3 theme migration (see `memory/dark-mode-not-implemented.md`)

## The decision

The app ships three independent appearance controls, in a new **Appearance** screen:

| control | options | default |
|---|---|---|
| Theme | System · Light · Dark | System |
| Colour | Invotick blue · From my wallpaper | **Invotick blue** |
| Contrast | Standard · Medium · High | Standard |

Material 3's dynamic colour — the wallpaper-derived scheme on Android 12+ — is **offered but not the
default**, and it reaches the app's chrome only.

## Why not default to dynamic colour

Android's own guidance leans toward dynamic colour, and on a Pixel it is what people expect. It is
still wrong as a default here, for reasons that are specific to an invoicing product:

- **The brand blue is on paper the app does not control.** It is on the invoice, on the share card,
  and on the PDF sitting in someone's email. An app whose chrome came from the user's wallpaper would
  disagree with the documents it produces — the same product in two colours on one screen.
- **Trust is the product.** An accounting app that looks different on every phone is a weaker signal
  than one that looks the same everywhere. That is G3, and G3 is never traded down.
- **It is not available to most of the installed base.** `minSdk` is 24; dynamic colour needs 31. As
  a default it would be "the brand" for a large share of users and "their wallpaper" for the rest,
  with nothing explaining the difference.

Offering it costs nothing and wanting it is a perfectly good reason.

## Where dynamic colour stops

Only the Material 3 **roles** come from the platform. Everything below keeps its own value whatever
the setting says:

| never dynamic | why |
|---|---|
| the invoice document, its template, and anything `invoicePdf` draws | it is paper, and it is what the client receives |
| `paper` / `onPaper` / `paperLine` | the sheet, the signature and stamp plates, the QR quiet zone |
| `heroBanner` | a brand block; it is deep in both themes by design |
| `success` / `warning` / `info` | **a status colour is a meaning.** Green is "paid". A green taken from someone's photograph is not a nicer green, it is a different fact |
| the OG card | a baked PNG on a year-long immutable cache — it has no viewer to theme for, and it represents the SENDER's business, not the recipient's phone |
| the 191-row invoice colour picker | the invoice's accent is **user data** |

**Dynamic colour is also disabled at Medium and High contrast.** The platform generates its scheme
for one contrast target; layering our high-contrast tone schedule over someone else's palette gives
neither their colours nor the guaranteed ratios. Asking for high contrast is asking for legibility,
so legibility wins and the brand scheme is used.

## Contrast is a change of tone, not a filter

The first implementation solved only for the ON colour and could not reach the target. That failure
is the argument: against a mid-tone base, neither black nor white is far enough. Light `primary` at
T40 is `#2655CA`; white on it is 6.49:1 and black 2.30:1, and no third colour does better. Medium
asks for 7:1. **The base has to move too** — accents darken in light and lighten in dark, on-colours
run the other way. Surfaces deliberately do not move: a high-contrast theme that also changed the
paper colour would be a different theme rather than a more legible one.

Measured worst on/base pair across both appearances:

| level | target | worst |
|---|---|---|
| Standard | 4.5 | 5.46:1 |
| Medium | 7.0 | 8.86:1 |
| High | 11.0 | 12.27:1 |

## Rejected

- **Dynamic colour as the default.** Above.
- **A single "Theme" dropdown** enumerating the combinations. Three questions, three controls; the
  product of them is nine to fifteen rows nobody can scan.
- **A Save button.** Every option applies on tap. The screen is a preview of itself, and a change you
  cannot see until you confirm it is a change you cannot judge.
- **Letting dynamic colour reach the semantic colours.** Considered and rejected outright — see the
  table above. This is the line that makes the feature safe to ship.

## What the screen says out loud

> Your invoices are not affected by anything on this screen. The template, the colour you chose for
> each invoice, and the page your client receives all stay exactly as they are.

Because "colour settings" in an invoicing app raises exactly that question, and the answer should not
have to be discovered.

## Files

- `core/ui/theme/AppearanceSettings.kt` — the three enums and their parsing
- `core/ui/theme/ColorSchemes.kt` — six schemes (2 appearances × 3 contrast levels), generated
- `core/ui/theme/DynamicColor.kt` + `.android/.ios/.desktop` — the platform scheme, null off Android
- `core/ui/theme/Theme.kt` — where the three settings meet
- `composeApp/components/settings/AppearanceScreen.kt`
- `Webinvotick/scripts/gen-m3-palette.py` — the generator; regenerate rather than editing a hex
