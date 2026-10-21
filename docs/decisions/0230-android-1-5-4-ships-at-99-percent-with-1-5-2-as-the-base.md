# 0230 — Android 1.5.4 (versionCode 118) ships at 99 percent, with 1.5.2 as the base

**Date:** 2026-10-21 · **Owner:** the owner, in chat · **Release:** done on his word

## The owner's words

- "1.5.4 banao and usko direct 90% rollout kero taky result jaldi aye"
- then: "1.5.2 ko 100% rollout kerogy and 1.5.4 ko 99% per le jaogy"
- then: "agar 1.5.3 better hai older version se to usko 100% kar do"

## What was done

- Branch `release/1.5.4` from `feat/156-second-invoice` (head `c5e9e6fcb`, gate green: 3,433 tests, 0 failures; shared-id check clean) plus one commit `2d39cca4c` (versionCode 118, versionName 1.5.4). It contains all of 1.5.3 (117) and the second-invoice nudges (A next-step card, B Repeat, C opt-in unpaid reminder on Android) with a 20 percent holdout, and the iPhone Rate card commits.
- Clean release bundle, signed with the upload key, uploaded with its mapping file; Play dry-run first, then the real upload: production = **118 (1.5.4) inProgress 0.99**, **116 (1.5.2) completed** (the base for the remaining 1 percent). Read back from Play afterwards.
- 1.5.3 (117) was at 20 percent; it is no longer on the track. Phones that already took it stay on it. Not using `--complete-prev` was deliberate: that would have made an unvalidated 117 the 100 percent base.

## Why 1.5.3 was not made the 100 percent base (the owner's conditional)

Panel reading on 2026-10-21 (120 new installs on 117 against 604 on 116): status "thin", recommendation WAIT. G1 24 h 10.9 vs 10.0 percent (no clear difference); splash pass-through 75.1 vs 79.5 (below the safety line, thin); errors and sync defects lower on 117 (thin); ad money per phone-day -10 percent (thin). Play vitals for 117 do not exist yet (Play's data stops at 16 October). "Better than the older version" was not shown, so the condition did not fire. 1.5.4 contains the 1.5.3 code, so 99 percent of phones get it anyway.

## What it costs, said plainly

- The staged 117-against-116 comparison on the Release Impact page ends; the nudges are measured by their own random holdout, which does not need versions.
- One jump to 99 percent leaves little brake: Play's halt, and the Remote Config switches `next_step_card_enabled`, `repeat_action_enabled`, `unpaid_reminder_enabled`, `nudges_holdout_percent`.

## Open

Panel section for the second invoice (built on feature branches, not deployed), the iOS build, and the 24-48 h vitals of 117/118.
