# 0024 — A double tap is stopped at the button, not counted around later

- **Date:** 2026-08-22
- **Status:** decided
- **Decision:** Guard every tap in one shared click gate so a bounced finger cannot fire an action
  twice, rather than letting the second tap through and teaching the analytics to discount it.

## Context

Two fast taps on "add business" produced two rows in Live Events. The question was whether that
matters and, if so, where to fix it.

It matters less than it looks for the funnel and more than it looks for the data:

- A **per-user** funnel — the shape decision [0006](0006-g1-real-invoice-metric.md) settled on — is
  unaffected: two events from one finger is still one user.
- **G1** is unaffected: `invoice_shared` needs a target chosen in the OS chooser and `payment_added`
  needs a payment recorded. A bounced tap reaches neither.
- **Raw counts are affected** — tap ratios, and the `firings` column on Event Discovery, which is the
  number being read while the event vocabulary is curated.
- **The action itself is affected**, and that is the real cost. Nothing in the app stopped a second
  tap from starting the work a second time. Two rows in a feed is a counting problem; two businesses
  from one finger is a data problem, and data problems are G3.

## Options considered

**Mark, do not suppress (rejected).** Let both events through and stamp the second with the gap since
the first, leaving the panel to decide what to count. It has real merits — nothing is ever lost, the
decision stays reversible on data already collected, and a double tap is itself a signal that a
button felt unresponsive. It was rejected because it treats the symptom: the duplicate *action* still
happens, and analytics cannot undo a second business.

**A list of events to de-duplicate (rejected).** Same failure mode as every list in this system: the
entry nobody adds is the one that matters. `AnalyticsAllowlist` shipped empty and silently sent
nothing; `STALE_CONFLICT` was missing from the sync queue's non-retryable set and cost 11,574 retries.
A guard that depends on remembering to enrol each button is not a guard.

**Guard the click (chosen).** One gate, on by default, opt out where repeats are genuine.

## Consequences

- The guard lives in `guardedTrackedClick` and **owns the whole click**, rather than emitting beside
  it. There were three helpers doing the emit-and-call dance — `trackedOnClick`, `buttonTapEmitter`,
  `rememberTapEmitter` — and a guard added to any one of them would have covered a third of the app
  while looking finished. `LAYOUT_RULES.md` already records this exact failure for a filter chip that
  lived in six files.
- **The guard runs even when nothing is recording.** `trackedOnClick` used to open with
  `LocalUiActionLogger.current ?: return onClick`, which hands back the caller's own lambda in
  release builds. A guard behind that line would have protected debug devices and nobody else.
- Threshold is 400ms — just past Android's own 300ms double-tap window. Below that the person has not
  yet seen the first press do anything, so they cannot have meant it twice.
- `repeatable = true` opts a control out, for steppers and "add row" buttons where every tap is its
  own action. The list must stay short and deliberate: a wrong `true` restores the bug, a wrong
  `false` eats an action somebody meant.
- A suppressed tap is **silent**. Emitting it would put back the extra row this exists to remove. If
  we later want to find buttons that feel slow, the honest instrument is a response-time measure, not
  a count of taps we threw away.
- Timing is a floor, not the answer. Where a tap **creates or sends** something the guard belongs on
  the work — disabled while in flight — because that knows instead of guessing.
- **26 call sites** are still outside the tracked components and therefore outside the gate: 24 raw
  `Button`/`IconButton` across 10 files (11 of them in `DeviceLinkScreen`) and 2 raw
  `Modifier.clickable` (`DeviceLinkScreen`, `AdaptiveHeaderZone`).

  This number was first reported as ~150. That count was wrong: it grepped `\.clickable` without the
  opening parenthesis, so every `import androidx.compose.foundation.clickable` line counted as a call
  site. Recorded here rather than quietly corrected, because the wrong figure is the kind that makes
  a small job look like a project and get deferred.

## Rejected earlier in the same discussion

Adding a duplicate rule to the analytics layer *instead of* the UI. Kept here because it is the
obvious suggestion and will be proposed again: it cannot stop the duplicate action, which is the half
that costs a user something.
