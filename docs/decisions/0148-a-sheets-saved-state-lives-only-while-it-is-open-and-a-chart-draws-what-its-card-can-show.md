# 0148 — A sheet's saved state lives only while it is open; a chart draws what its card can show; no main-thread IPC

**Date:** 2026-09-21
**Status:** built — app `fix/148-crash-and-anrs` (`8a567560`, from `origin/VC_102_VN_146`, for the 1.4.8 hotfix) and
ported onto `VC_107_VN_148` (`b95ed389`). Not released. One question for the owner (below).
**Related:** memory `crash-fix-root-cause-only`, `no-jugaad-fix-the-root`, `monetisation-measure-never-assume`,
`meta-troas-ad-revenue`.

## The owner's words

> "in ANR aur crashes ko bhi is version per fix karna hai, aur jo bhi 1.4.8 main kaam update ker rahe ho usko achy
> sy check kerky phir bundle banana — koi bug nahi chahiye." (2026-09-21)

Input: three Crashlytics exports from 1.4.7 (106), one session each, retraced with R8's own `retrace` against
`mapping-1.4.7-106-51ca0d7a.txt`. The exports carry no event or user counts, so how often each happens is not known
from them.

## 1 — Crash: "Restoring the Navigation back stack failed: destination -566868199"

**What the user saw.** On Create Invoice (or Estimate), tapping *Add Client* closed the app.

**Root.** `-566868199` is the hash of `ProductRoutes.List` — the *Items* sheet. Every create-screen sheet is one
`NavHost` composed inside `if (sheetOpen)`, at the same code position whichever sheet it is. When Android kills the
app in the background with the Items sheet open, the sheet's back stack is saved to disk, but the screen's view model
(which says a sheet is open) is not. The app comes back with **no** sheet open, and the unread back stack waits in the
save registry. The next sheet opened there — Client — is handed the Items stack; the Client graph has no such screen,
and `NavHost` throws.

**Fix.** `SheetSavedState` (core/ui): a sheet's saved state is kept exactly as long as the sheet is open — kept across
a rotation, removed the moment the sheet is closed, and removed when the screen comes back with no sheet. Used by both
sheet containers that hold a `NavHost` (invoice/estimate, expense).

**Proof.** Unit: `SheetSavedStateTest` — the 1.4.7 shape hands `items#0` to the Client sheet (control), the fixed
shape gives Client its own state, rotation keeps state, close clears it. Device (Pixel 7 Pro, debug builds): baseline
— open Items, Home, kill, reopen, tap Add Client → the identical exception; fixed → the Client list opens.

## 2 — ANR in `Path.op` (Analytics tab)

**What the user saw.** Analytics → quick range **All** → the app froze and Android offered "close app".

**Root.** Both daily charts drew one point for every calendar day of the period. "All" is sent as 36,500 days, so each
line had 36,501 points (nearly all 0) in a 300-pixel card. Vico clips the area under a line with two `Path.op` calls
on every draw; Skia's path operations are extremely slow on thousands of segments lying on the edge they cut along.

**Fix.** `ChartPeriod`: a point per day up to 92 days, per week up to 731 days, per calendar month beyond; a period
longer than 731 days starts at its first record. Money is **added** per point (never averaged), so totals are
unchanged. The card's subtitle says Daily / Weekly / Monthly accordingly.

**Proof.** Unit: `ChartPeriodTest` (All = 19 monthly points for data since March 2025; nothing drawn past a century of
months; sums preserved). Device, baseline: two ANRs, 3,417 and 3,880 frames skipped, frame 99th percentile 4,950 ms.
Fixed: no ANR.

## 3 — ANR in `onServiceConnected` → `getInstallReferrer`

**What the user saw.** A freeze at the first opens after installing.

**Root, found by retracing.** The recorded trace is **the Facebook SDK's** `InstallReferrerUtil`: it reads the Play
install referrer — a blocking call into the Play Store process — on the main thread, where Android delivers
`onServiceConnected`. Upstream (facebook-android-sdk `main`, checked 2026-09-21) still does this. It retries on every
event flush until one read succeeds. Our own `GooglePlayReferrer` had the same main-thread call.

**Fix (ours).** `GooglePlayReferrer` reads the referrer on its own thread.

**Open — owner's question.** The Facebook half is not ours to change. The honest options:
- **A. Keep as is** and watch the count in Crashlytics (recommended until the count is known).
- **B. Turn off Facebook's automatic app events** — ends this ANR, but costs Meta install attribution / tROAS
  (monetisation: not proposed as a fix, only listed so the trade is visible).
- Rejected: writing Facebook's private "referrer done" flag after our own read — depends on the SDK's internals
  (jugaad).

## Rejected

- `try/catch` around `NavHost`, or dropping navigation restore altogether (loses a user's place on every rotation).
- Keying the sheet's state by sheet type only — stops the crash but reopens a stale stack from before the kill.
- Clamping "All" to N days, or turning the area fill off — hides the cost instead of drawing a sane number of points.
