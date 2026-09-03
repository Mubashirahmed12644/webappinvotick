# 0027 — A first-time user is a device, and the journey is counted per device

**Date:** 2026-09-04 · **Status:** decided, implemented (`invotick-apis` f05629f, admin panel 29b1058)

## Context
The "Pehli invoice ka safar" screen showed 16/86 first-time users. The endpoint anchored on
`app_cold_start` with `is_first_open='true'` but grouped by `user_id`. The cold start fires before the
guest session has restored, so 256 of 340 first-open cold starts carried no `user_id` — the screen saw
86 of 321 devices, and the 86 skewed 3× towards returning devices (whose session restores first).

## Decision
- **First-time = a device** (`app_instance_id`, which is on every event) whose `app_cold_start` in
  the range carries `is_first_open='true'`. The user id, when any event on the device carried one, is
  an attribute of the row, not its key.
- `is_first_open` is the anchor; `device_id` alone cannot say "first time" because its first-seen
  moment is stored nowhere. Play's `install_referrer.install_version` is the witness that separates a
  fresh 1.4.2 install from an update (276 vs 39 of 321 in the first measurement; fresh installs convert
  better, 23.6 % vs ~15 %).

## Rejected
- Keep grouping by `user_id` and "fix the race" in the app — the row would still depend on timing.
- Define first-time as "first event we ever saw" — that is "new to our table", which moves with the
  retention window.

## Consequences
The screen reads ≈340/78 instead of 86/16. The ladder's label defects (rung 3 restating rung 2,
rungs 5/6 inflated by MAX, `ci_save_clicked` counted as created) are known and separately decided.
