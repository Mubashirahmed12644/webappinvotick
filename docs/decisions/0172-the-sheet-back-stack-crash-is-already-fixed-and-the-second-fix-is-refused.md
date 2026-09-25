# 0172 — The sheet back-stack crash is already fixed, and the second fix is refused

**Date:** 2026-09-26
**Status:** accepted. `rescue/a96b7bfb-nav-backstack` (`a96b7bfb`) is **not** merged and should not be.

## Why this entry exists

Three separate agents have now worried about the same crash and two of them independently wrote a
fix for it. The commit `a96b7bfb` was found tonight with **no branch pointing at it** — minutes from
being garbage-collected — and was rescued onto a branch precisely so it could be judged rather than
lost. It has now been judged. Without this record a fourth agent will find it again and merge it.

The crash: *"Restoring the Navigation back stack failed: destination -566868199 …
startDestination=ClientRoutes.List"*. A sheet composes inside `if (sheetOpen)` at one position for
every sheet, so its back stack is filed under that one position. Android kills the app; the stack is
saved but the view model saying *which* sheet was open is not. The screen returns with no sheet open,
the stale stack waits unread, and the next sheet opened there is handed another sheet's stack.

## The decision

**The release already fixes it, at its root, with the stronger of the two fixes.** `e5fbb59d`
(decision 0148) is in `VC_113_VN_149`; `a96b7bfb` is refused as a duplicate.

The proof, read from the refs rather than from any agent's account:

1. **What the rescue branch actually changes.** Under `git diff -w` its entire code change is one
   line — wrapping the existing body in `key(bottomSheetType.navScopeKey) { … }` around
   `rememberNavController()` — plus a new `navScopeKey` property holding 14 hardcoded strings for
   invoice and 3 for expense. The other ~280 lines of its diff are re-indentation.
2. **The release already does the same thing.** At `3d081be7`, `BottomSheetContainer.kt` calls
   `sheetState.Scope(sheetKey = currentBottomSheet.analyticsSheetName)`, and `SheetSavedState.Scope`
   is `holder.SaveableStateProvider(OPEN_SHEET) { key(sheetKey) { content() } }`. So
   `rememberNavController()` is **already** inside a `key()` whose value is one distinct string per
   sheet — all **14** invoice values distinct, all **3** expense values distinct. A one-for-one match
   with the rescue branch's 14 and 3: the same mechanism, keyed on a different string.
3. **The release has a second barrier the rescue branch lacks.** `rememberSheetSavedState(isOpen)`
   drops the whole saved-state bucket the moment the sheet is not open, so the process-death path is
   closed twice on the release and once on the rescue branch. The rescue branch is a strict subset.
4. **There is no third place either fix could miss.** `git grep rememberNavController 3d081be7`
   returns exactly two sheet hosts — invoice-create and expense-create — plus the app shell, which is
   already version-keyed. `presentation/preview/bottomSheet/BottomSheetNavHost.kt` has no `NavHost`
   and no `rememberNavController` at all; it is a plain `when`, so it cannot have this crash. Estimate
   reuses the invoice container.
5. **The tests are not equivalent.** The rescue branch's `EachSheetOwnsItsBackStackTest` asserts that
   14 hardcoded strings are distinct and lower-case — a data test on its own new property, and every
   one of those assertions is equally true of `analyticsSheetName`. The release's `SheetSavedStateTest`
   drives a **real Compose composition** through a real save/kill/restore cycle with a
   deliberately-failing control case proving the harness reproduces the original crash. One is a
   regression guard; the other is not ([[a-check-that-cannot-fail]]).

## What merging it would have cost

A duplicated 17-entry lookup table that must be kept in step with `analyticsSheetName` for ever, on a
crash path, for **zero** behaviour change. Two fixes for one crash is worse than one: the next person
to change a sheet name has two places to remember and no test that fails if they miss the second.

## Rejected alternatives

- **Merge it anyway, "belt and braces".** Rejected — the standing rule is root-cause fixes, not layers
  over a crash, and a redundant guard rots because nothing exercises it.
- **Delete `a96b7bfb`.** Rejected — it is cheap to keep, and a deleted commit is how this became
  confusing in the first place. It stays on `rescue/a96b7bfb-nav-backstack` as history, with this entry
  saying why it is not in the product.

## How the confusion started, so it does not repeat

The fix lives in `core/ui` (`SheetSavedState`), not in `BottomSheetNavHost` where anyone hunting the
crash naturally looks. An agent searching the obvious file concluded, reasonably, that nothing was
fixed. **When a fix is deliberately placed away from the scene of the crash, the decision entry is the
only signpost** — which is why this one exists.
