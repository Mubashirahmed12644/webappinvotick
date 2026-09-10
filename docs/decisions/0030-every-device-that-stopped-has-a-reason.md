# 0030 — Every device that stopped on the journey has exactly one reason

**Date:** 2026-09-04 · **Status:** decided, implemented (`invotick-apis` fe1b8a0, admin panel e27de9d)

## Context
The owner's instruction: every new user makes at least a first invoice, and when one does not, we know
that person's reason — per person, not per average — and the reason is visible on the rung itself.
A funnel percentage is a symptom; the deliverable is the split of the drop-off into named causes.

## Decision
- A second query reads the evidence per first-time device (what the first-open process did before its
  first background, what was pressed on the invoice screen, how the Save gate ended), and an **ordered
  rule set names exactly one reason per device**. Order is the point: "pressed Save then dismissed the
  gate" is the gate, not "left normally", although both are true.
- Rung 1 reads order inside the first-open process (`open_count='1'`, `ms_since_start`): the same events
  before and after the first background mean different things — "left while the ad was loading" versus
  "gate released and nothing navigated", which is a bug shape.
- The residual is named for what is known ("left normally, touched nothing"), never hidden in the
  average; an `unknown`/`no_signals` bucket is a measurement gap to close, and must shrink release by
  release.
- Reason keys are stable identifiers; the panel labels them. The buckets on a rung must sum to its
  "stopped here" count — the first thing anyone checks.

## Rejected
- Show the last event before exit as the "reason" — a symptom again, and unreadable at scale.
- Add a "reason" event in the app first — the rules cover 100 % of today's devices from existing
  events; new parameters are for the gaps (`splash_ready.reason/wait_ms`, `app_cold_start.prev_exit`,
  `invoice_screen_close.method/had_input`, a coded `guest_login_failed.reason`).

## Consequences
First measurement, rung 1 (67): 41 left during the app-open ad wait, 13 after guest login before splash
ready, 4 went silent after the ad was dismissed. The ad wait is a monetisation question for the owner,
with the revenue side alongside — not a finding.
