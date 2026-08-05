# 0016 — One bottom sheet, and it answers when you pull it

**Date:** 2026-08-05
**Status:** accepted, shipped
**Touches:** `invoice-kmp-app` — `core/ui/components/BottomSheet.kt` and five call sites

## What was found

Forty-three bottom-sheet call sites across twenty-six files, excluding the invoice preview sheet on
create-invoice, which was deliberately out of scope. They came in three tiers:

| Built by | Sites |
|---|---|
| `InvotickBottomSheetWrapHeight` | 21 |
| `InvotickBottomSheet` | 19 |
| `ModalBottomSheet` directly | 3 |
| `ModernBottomSheet`, `ModernBottomSheetWithActions`, `InvotickFloatingBottomSheet` | **0** |

## The cause

Both live wrappers passed `sheetGesturesEnabled = false`, **and** installed a nested-scroll
connection whose `onPostScroll` returned `available.copy(x = 0f)` — consuming the whole vertical
overscroll before the sheet could see it.

So forty sheets drew a drag handle that did nothing. None could be pulled down; no scrollable child
could hand its overscroll to the sheet. This is the opposite of the complaint that started the
investigation — the preview sheet felt like it *jolted*, and everything else was simply inert.

Both are gone. Material's own gesture handling is what produces the smooth settle and the
velocity-aware dismissal; none of that had to be written, only stopped from being suppressed.

Worth stating plainly: no call site passed `enableNestedScrolling`, `wrapHeight` or
`maxHeightFraction`, so removing those parameters changed nothing anyone had asked for. The
suppression was a default nobody chose.

## The standard

Material's numbers win wherever the two wrappers disagreed, because a disagreement between two
copies is not a decision anyone made.

- **28.dp** top corners — was 28 / 18 / 24 / Material default
- **32×4** handle — was 40×4 / 60×6 / 36×3
- `skipPartiallyExpanded` on every sheet; two options menus alone had a half-height stop
- status-bar padding kept: a full-height sheet stopping below the clock is deliberate, and the only
  sheets that opened underneath it were the ones bypassing the wrapper
- the handle stays visible on every sheet, gestures now being live everywhere

The two wrappers are now one private implementation behind a `wrapHeight` flag. They were copies, so
every earlier fix to one of them reached half the app and looked finished.

## Also folded in

- The two expense "Select Business" sheets — near-duplicate files one package apart — go through the
  wrapper instead of `ModalBottomSheet`.
- The estimate preview sheet hoists its `SheetState`, the fix the invoice's already carried:
  created inline it could not be asked to leave, so closing it removed the composable outright and it
  vanished with no exit animation.
- Deleted three wrappers and a preview — about four hundred lines with zero call sites.

## Rejected

- **Leave gestures off and only unify the looks.** Safest, and it would have left a decorative
  handle on forty sheets — the G3 cost of a control that does not answer is larger than the risk of
  Material's own gesture handling.
- **Enable gestures only on the wrap-height sheets.** Halves the risk and guarantees two behaviours
  in one app, which is the problem this pass exists to end.
- **Hide the handle wherever gestures stay off.** Moot once gestures are on everywhere.

## What to watch on device

Sheets whose content scrolls — the client list, the stamp and signature pickers, the colour picker,
and the full-height forms behind `InvotickBottomSheet` (create business, create item). Scrolling the
content to its top and continuing to pull should now move the sheet. If any of them fight, the fix is
per-sheet, not a return to suppressing gestures app-wide.
