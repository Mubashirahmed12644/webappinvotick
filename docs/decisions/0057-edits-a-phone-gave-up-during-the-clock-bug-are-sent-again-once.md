# 0057 — Edits a phone gave up during the clock bug are sent again, once

**Status:** decided (the owner, 2026-09-11, item 5: "haan").
**Date:** 2026-09-11.
**Related:** sync audit class C1 (fixed in `6859b42`), 0042.

## Context

- Until 2026-09-11 the server stamped its own clock on updates. A phone's next edit therefore looked
  seconds "older than server state" and was refused.
- After repeated refusals, a phone marks such a slip `TERMINAL` and never sends it again. The Pixel
  held 2, "behind by 2s/11s".
- Those edits exist only on the phone that made them. The server and every other device show the
  value from before the edit.

## Decision

- In the release after 1.4.5, each `TERMINAL` slip that was refused as stale during the clock bug is
  sent again once, carrying the phone's current copy and a fresh time.
- This happens only where no other device has changed that record since. If another device has, the
  slip stays refused, and the other device's edit wins.

## Rejected

- **Leaving them.** The user's own edits stay lost to the server for good.
- **Resending them all blindly.** That could overwrite another device's later edit.

## Consequences

- An app migration step runs once.
- It is measured by the number of `TERMINAL` stale slips before and after, per device.
