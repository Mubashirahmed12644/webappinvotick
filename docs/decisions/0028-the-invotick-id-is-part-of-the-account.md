# 0028 — The Invotick ID is minted with the account, not on demand

**Date:** 2026-09-04 · **Status:** decided, implemented (`invotick-apis` f05629f) — reverses the lazy
assignment decided 2026-07-09

## Context
Lazy assignment (only when the app hit a trigger screen) left **94 % of guests and 97 % of registered
users without an ID** after two months: registered users never open the trigger screens, and the eight
auth-time call sites were no-ops behind `invotick.shortcode.eager-assign=false`. The backfill was also
off, and its paging stepped over a shrinking set, skipping every other 500 rows.

## Decision
- Every user row is created **with** its 9-digit Luhn ID, in the same transaction (`eager-assign=true`);
  the flags stay only as kill-switches, pinned by a test.
- One backfill for the rows created while assignment was lazy (11,577 rows, 46 s, 0 failures; 0 NULL
  remaining, 0 duplicates). The paging bug is fixed and tested.
- The login response carries the ID as `invotickId`, the name the app already reads from the profile
  endpoint. The app's `UserDto` must map it (next release).
- The local guest UUID stays local and instant; the ID is server-only because uniqueness can only be
  guaranteed there. "Has a server row" and "has an ID" are now the same fact.

## Rejected
- Keep lazy assignment and add more app triggers — the population that lacked IDs never reaches them.
- Mint the 9-digit ID locally — 90 M space, collisions, and no authority to guarantee uniqueness.

## Consequences
`short_code NOT NULL` is the natural next migration once the backfill has been verified across a
deploy or two (Flyway; asked first). The remaining hole is "device with no server row" — a Health
Centre check, still to build.
