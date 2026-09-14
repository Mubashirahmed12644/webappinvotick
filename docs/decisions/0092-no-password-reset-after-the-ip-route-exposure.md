# 0092 — No password reset after the /v1/ip exposure

**Status:** decided by the owner on 2026-09-14 ("Kuch nahi"), against the recommendation.

**Related:**
- 0072, and its amendment of 2026-09-14: what the open route exposed;
- `memory/ip-route-exposed-user-records-2026-09-14.md`;
- G3, trust.

## Context

- **From 2026-04-22 to 2026-09-13,** `GET /v1/ip/suspicious/full` answered with no login, and returned whole user
  records. Those records included BCrypt password hashes.
- **516 real accounts have a usable password.** The 14,217 guests' passwords are random.
- **No evidence of access** shows in the 8–15 days of logs that exist. The earlier ~4.5 months are unlogged.
- **Who logs in:** 44 of the real users logged in within 7 days, and 78 within 30.

## Decided

- **No password reset, and no new step for users.**
- **Users are not told; the record is kept** (the owner, 2026-09-14: "Nahi, sirf record").
  - The owner first confirmed that the door is shut. A live check at 01:07 UTC showed all three `/v1/ip` routes
    answering 401 without a login.
  - What happened and why these choices were made stays written in 0072 and here.
  - **If any evidence of access ever appears, users are told at once.**
  - The owner was told that 33 of the 516 accounts log in from places whose laws may require notice (EU 5, UK 2, US 26),
    and that only a lawyer can settle that.

## Rejected

- **An email code at the next password login** (the recommendation). No one would have been logged out and no
  message would have been shown. But the few who log in with a password would have met a new step. The owner weighed
  any change users notice, which can make them uninstall, against a risk with no evidence behind it.
- **Logging everyone out.** Sessions were not exposed, so it would add confusion and no protection.

## Consequences

- **If the list was taken,** a weak password stays usable until its owner changes it. That risk does not fade with
  time.
- **Revisit at once if any evidence of access appears,** such as a login from an unknown place on a real account, or a
  user's report.
- **Already done or next:**
  - the route stays closed;
  - since batch14 (2026-09-14 00:47 UTC), even an admin's response no longer carries hashes;
  - deny-by-default is next, so an unlocked route cannot recur.
