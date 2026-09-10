# 0023 — One dismissal, one event; the route is a parameter

**Date:** 2026-08-16 (revised the same day — see *The wrong turn*)
**Status:** Decided, implemented in `invoice-kmp-app` (`8a8cbaa2`)
**Goal served:** G1 (real-data activation) — the create-invoice sheets are where the funnel leaks

## The question

A bottom sheet can be closed four ways: the ✕ in its top bar, a swipe down, a tap on the scrim, and
the system back gesture. Should the non-✕ routes be measured, and if so, how?

## Decision

**The sheet's existing per-sheet close id carries the route as a parameter.** No new event.

```
invoice_create_client_screen_close { method, had_input }
```

- `method` — `close_button` | `swipe` | `scrim_or_back`
- `had_input` — was anything typed before closing. Absent, never guessed, when nothing in scope can
  answer it.

The close ids were made meaningful per sheet in `38d095d6` (74 top bars, 74 distinct names). That
is already the event; how the user got there is a property of it.

## The wrong turn, because it is the point of this entry

The first implementation added a **separate** `sheet_dismissed` event alongside those ids. Closing
the client form then produced three events for one action — the ✕'s own tap, the new event, and the
view model's `client_form_dismissed` — and the business form produced two. Counting dismissals meant
knowing which of the three to trust.

That is the same defect as forty sheets sharing one close id, arrived at from the opposite end:
first the identity of an action was lost in a shared name, then a single action was split across
three names. The rule that survives both is **one action, one event, with parameters** — not one
event per variation, and not one name for everything.

The same commit also added `LocalCodedEventLogger`, a second channel that skipped the allowlist so
the new event would reach production while `AnalyticsAllowlist.DEFAULT` is empty. That was not a
decision to make in passing: the allowlist is the agreed control for what auto-captured events ship,
and a channel that ignores it makes the control a half-truth. Removed. If these dismissals should
ship, the allowlist is where to say so.

## Why the route is worth a parameter

It changes what you would fix. A sheet dismissed by swipe is frequently accidental — the drag handle
sits directly above a scrolling list. One closed with the ✕ is a decision. Those are a gesture
problem and a content problem. `had_input` splits the rest: abandoned *after typing* is a different
failure from opened-and-closed.

## How the two halves meet

The ✕ and the gestures are seen by different parts of the tree, and neither sees both:

- The ✕ closes the sheet on its own path, which Material's `onDismissRequest` never observes — so it
  attaches the parameters to **its own tap** and the sheet stays out of it.
- A swipe or scrim has no clickable for the tap layer to name — so the top bar publishes its id to
  the sheet (`LocalSheetDismissNameSink`), and the sheet emits under that same name.

Whichever half observes the dismissal emits. Only one ever does.

## What was rejected

- **A separate event per route** (`sheet_swiped_away`, `sheet_closed`) — every query would OR four
  names, and the first one anybody forgets lowers the abandonment rate silently.
- **A separate event per sheet** — the bug fixed in `38d095d6`, re-introduced from the other end.
- **A separate `sheet_dismissed` beside the close id** — what shipped first and was reverted; see
  above.
- **Keeping `client_form_dismissed` / `business_form_dismissed` / `item_form_dismissed`.** They say
  the same thing with less in it. Removed, along with `savedSuccessfully`, which existed only to
  gate them — a save closes the sheet without going through `onDismissRequest`, so the remaining
  event already means "abandoned" without the flag.
- **Splitting scrim from back.** Material3 hands both to the same `onDismissRequest` with nothing to
  distinguish them. A `BackHandler` could intercept back, but that changes real dismissal behaviour
  to win an analytics distinction, and a timing heuristic would put a number in the funnel that can
  lie. They share `scrim_or_back` until there is an honest way to separate them.
- **`this::class.simpleName` for the sheet name.** R8 renames classes in release, so the funnel would
  read `a`, `b`, `c` in exactly the builds being measured — and would look like data throughout. The
  dispatcher names are spelled out in a `when`.
- **Defaulting `had_input` to false** when nothing can answer it. Absent means unknown; false is a
  claim that the form was empty.

## Where it lives

`InvotickSheet` in `core/ui/.../BottomSheet.kt` — the single implementation behind both public sheet
wrappers — and `InvotickTopBar`. Not at the 42 sheet call sites: the close-id fix immediately before
this had to touch 74 call sites, and two were still wrong after the first pass.

Swipe is separated from scrim/back by a structural fact rather than a threshold: a drag moves the
sheet's offset while its target is still the open state, whereas `hide()` — what the scrim and back
both call — sets the target to Hidden before anything animates.

## Verification status

The three-event behaviour was found by the owner in the admin panel's Live Events feed, not by the
device run that preceded it — that run only checked that `method` was reported correctly, and never
counted how many events one dismissal produced. **Count first, then read the values.**

Measured on device (`tools/maestro/sheet_dismiss_methods.yaml` and `sheet_dismiss_swipe.yaml`), one
event per dismissal, same name, parameters apart:

```
✕      invoice_create_client_screen_close | method=close_button, had_input=false
swipe  invoice_create_client_screen_close | method=swipe,        had_input=true
```

`sheet_dismissed`, `client_form_dismissed`, `business_form_dismissed` and `item_form_dismissed`
appear zero times across both runs. The events also carry `allowlisted=false`, which is the
allowlist doing its job rather than a bypass doing it for them.
