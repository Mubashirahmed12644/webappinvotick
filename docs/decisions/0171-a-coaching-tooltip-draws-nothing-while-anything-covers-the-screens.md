# 0171 — A coaching tooltip draws nothing while anything covers the screens

**Date:** 2026-09-26
**Status:** accepted, built on `invoice-kmp-app` branch `fix/149-coach-tooltip-hides-under-modal` (`ade1cbe4`), not yet merged into `VC_113_VN_149`

## What happened

The owner opened iOS build 26 and sent three screenshots. In all three, the first-invoice coaching
bubble — *"Let's start! Add your business to create your first invoice"* — sat at the same screen
position on top of a completely different screen:

1. over the **"You used these accounts on this phone before"** sheet, hiding the third account's name
   and Invotick ID;
2. over **"Is this your account? Step 1 of 2 — Which is this account's business?"**, hiding the third
   option;
3. over **Step 2 of 2 — "Which of these is your client?"**, hiding the third option again.

Two things measured afterwards made it worse than an overlap:

- **The bubble swallows the tap.** On the simulator, tapping the covered row registered nothing while
  tapping an uncovered row registered its name. A user who guesses what is hidden still cannot pick it.
- **At accessibility text size it covers two options, not one.**

Both proof steps must be answered correctly for a guest to recover their account. A hidden and
untappable correct answer means the guest does not get their invoices back — and ~96.6% of users are
guests whose data is device-bound (G3, trust).

## Why it happened

The coaching tooltip is Material's `TooltipBox`, whose bubble lives in **its own popup layer above the
whole app**. The screen that owns the tooltip is never told that something opened over it: the app's
own prompts (`AppPromptsHost` — returning accounts, the proof steps, the guest-work question, the
removed-phone notice, the purchase move, the recovery apology) are ordinary composition content drawn
**above** `AppDisplay` rather than replacing it. So the anchor stays alive, unscrolled, at the same
coordinate — which is why the bubble appeared in the same place on three unrelated screens.

**A hypothesis that was wrong, recorded because it was plausible:** that the anchor had been captured
as a stored *position* which outlived its composable. It had not. The anchor is live; the screen
underneath simply never went away. Same symptom, different cause — and the difference decides the fix.

Separately, and measured rather than assumed: the bottom sheets (business, client, item, discount, tax,
payment) already covered the tooltip on iOS, because they are popups too and open later. The defect is
specific to **full-screen, in-composition prompts**.

## The decision

**A coaching tooltip draws nothing while anything is covering the screens**, expressed as one rule
rather than as a list of screen pairs.

- `core/ui/overlay/ScreenCover.kt` holds a process-wide register of what is currently over the screens.
- Anything drawn above them declares `CoversTheScreens()` — one line. Applied to the app's single
  bottom-sheet implementation (so every sheet), the 3 sheets outside it, **39 dialog call sites**, and
  all six prompts in `AppPromptsHost`.
- All three coach-tooltip wrappers render nothing while `coachTooltipsMayDraw()` is false. They are
  **not removed**: Material's tooltip state dies with the box, so removing it would end the coaching
  permanently instead of restoring it when the cover goes. An empty popup is 0×0 — invisible and
  untappable.
- **`ACoachTooltipNeverDrawsOverACoverTest`** fails the build when a new cover does not declare itself
  or a new tooltip does not ask. It caught two dialogs that had been missed by hand — the practical
  proof of the "fix every copy" rule in `LAYOUT_RULES.md`.

Because the rule names no pair, Step 1 and Step 2 are both fixed by it, as is the "Start new" button
in a short account picker, which falls in the same band and would have been untappable for the same
reason.

## Alternatives rejected

- **Hide the tooltip on these two screens.** A patch over a crash-class defect, against the standing
  rule of root-cause-only fixes. It would also leave every future screen exposed.
- **Raise the prompts' z-order above the popup layer.** Compose popups are sub-windows of the activity
  window; in-composition content cannot reliably be placed above them, and doing so would change how
  every dialog draws.
- **Dismiss the tooltip when a prompt opens.** Ends the coaching for good rather than deferring it —
  the user would never see the hint again after one unrelated interruption.

## Consequence for the release

**Android 1.4.9 must not ship without this fix.** The live Play build (1.4.5 / versionCode 101) is not
at risk: the tooltip exists there, but the accounts and proof screens do not — they arrive in
`VC_108_VN_149`. **1.4.9 is the first Android build where both exist at once.** iOS TestFlight build 26
already has both, which is where the owner found it.

## What was verified, and what was not

- **iOS 26.5 Simulator (iPhone 17 Pro)**, before and after within one debug build: bubble present and
  the covered option not registering taps → bubble gone, every option readable and tappable; the
  tooltip **returned to its own screen** once the cover closed; repeated at accessibility text size
  (two options covered → none).
- **Unit: 1272/1272**, guard test included.
- **Not verified on an Android device.** The Pixel was locked and this Mac has no emulator image. The
  Android conclusion rests on the code (a Compose popup is a sub-window of the activity window, so it
  sits above all in-composition content) plus branch analysis of which screens exist in which build.
  Recorded as reasoning, not as a measurement.

## Left alone, deliberately

`InvoiceScreen.retireSaveNudge()` — a patch that permanently retires the Save hint when the discard
dialog opens. This rule makes its z-order purpose unnecessary, but it also changes behaviour, and
behaviour is not changed on a release candidate. Worth revisiting after 1.4.9.
