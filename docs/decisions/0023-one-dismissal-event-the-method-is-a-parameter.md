# 0023 — One dismissal event; the method is a parameter

**Date:** 2026-08-16
**Status:** Decided, implemented in `invoice-kmp-app`
**Goal served:** G1 (real-data activation) — the create-invoice sheets are where the funnel leaks

## The question

A bottom sheet can be closed four ways: the ✕ in its top bar, a swipe down, a tap on the scrim, and
the system back gesture. Should the non-✕ routes be measured at all, and if so should each get its
own event name?

## Decision

**Measure all of them, under one event name, with the route as a parameter.**

```
sheet_dismissed { sheet, method, had_input }
```

- `sheet` — `invoice_client_form`, `invoice_item_form`, `expense_category`, …
- `method` — `close_button` | `swipe` | `scrim_or_back`
- `had_input` — was anything typed before closing. Absent, never guessed, when nothing in scope can
  answer it.

## Why one name

The funnel asks one thing: *was this form abandoned*. Four names would force every query to OR four
strings together, and the first one anybody forgets silently lowers the abandonment rate with
nothing to show that it happened. The app had just been through the mirror image of this — forty
sheets sharing a single close id, so no form could be told from another — and the fix for that is
not to over-correct into forty × four.

The route is still worth having, because it changes what you would fix. A form abandoned by swipe is
frequently accidental: the drag handle sits directly above a scrolling list. A form closed with the
✕ is a decision. Those are a gesture problem and a content problem, and only `method` separates
them. `had_input` splits the remaining ambiguity: abandoned *after typing* is a different failure
from opened-and-closed.

## Why the event is coded, not auto-captured

The ✕ is an auto-captured tap. In release builds the app root sends auto-captured taps **only** when
the key is allowlisted, and `AnalyticsAllowlist.DEFAULT` is empty — so no sheet close reaches
production today. A swipe has no clickable at all, so auto-capture could never see it in any build.

An event a funnel depends on cannot live on that channel. `sheet_dismissed` goes through a second
composition-local wired straight to `trackClick`, with no allowlist gate.

## What was rejected

- **A separate event per method** (`sheet_swiped_away`, `sheet_closed`, …) — the OR-everything trap
  above.
- **A separate event per sheet** — the bug being fixed, re-introduced from the other end.
- **Splitting scrim from back.** Material3 hands both to the same `onDismissRequest` with nothing to
  distinguish them. A `BackHandler` could intercept back, but intercepting changes real dismissal
  behaviour to win an analytics distinction, and a timing heuristic would put a number in the funnel
  that can lie. They share `scrim_or_back` until there is an honest way to separate them.
- **`this::class.simpleName` for the sheet name.** R8 renames classes in release, so the funnel would
  read `a`, `b`, `c` in exactly the builds being measured — and would look like data throughout. The
  names are spelled out in a `when`.
- **Defaulting `had_input` to false** when nothing can answer it. Absent means unknown; false is a
  claim that the form was empty.

## Where it lives

One place: `InvotickSheet` in `core/ui/.../BottomSheet.kt`, the single implementation behind both
public sheet wrappers. Not at the 42 call sites — the top-bar fix immediately before this one had to
touch 74 call sites, and two of them were still wrong after the first pass.

Swipe is separated from scrim/back by a structural fact rather than a threshold: a drag moves the
sheet's offset while its target is still the open state, whereas `hide()` — what the scrim and back
both call — sets the target to Hidden before anything animates.

## Verified

On device, `tools/maestro/sheet_dismiss_methods.yaml`:

```
sheet=invoice_client_form, method=close_button, had_input=false
sheet=invoice_client_form, method=swipe,        had_input=true
```
