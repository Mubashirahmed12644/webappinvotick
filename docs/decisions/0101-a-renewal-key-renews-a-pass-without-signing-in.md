# 0101 — A renewal key lets a phone get a new pass without signing in again, in 1.4.6

**Status:** decided by the owner on 2026-09-14 ("1.4.6 mein hi"). It is being built: the server part first, then the app.

**Related:**
- 0026, a session is renewed before it dies and never revived after;
- 0098, A1's sign-in-again screen;
- 0099;
- the A1 key change of 2026-09-03.

## Context

- **Where passes fail today.** A pass lives 90 days, and is renewed while it is still alive (0026). It cannot survive:
  - a signing-key change: after A1, about 17 registered accounts had to sign in again;
  - 90 days without opening the app.
- **Why no silent sign-in exists.** The app keeps no password, and the server keeps only a hash. A silent sign-in
  therefore needs another proof that the phone holds.
- **Why 0026 does not rule this out.** 0026 rejected refresh tokens for the expiry problem, because nobody alive then held
  one. This key is aimed at the next key change and at long absences. 1.4.6 phones can also receive a key without signing
  in, on their next call while the pass is still good.

## Decided

- **Each signed-in phone holds a renewal key.**
  - It is random and opaque. The server stores it only as a hash, so a signing-key change or leak does not touch it.
  - It is issued at sign-in. A 1.4.6 phone that is already signed in gets one on its next accepted call.
  - It is exchanged at one public endpoint for a new pass and a new key. The old key stops working, and a replayed old
    key revokes that phone's keys.
  - It is cancelled when the phone is removed from the account, at a deliberate sign-out, and when the password
    changes.
  - On the phone it lives in the platform's secure storage: Keystore-backed storage on Android, the Keychain on iOS.
  - It expires after a long idle time, which the builder proposes.
- **The app tries the key once on a refused pass,** before it shows the sign-in-again screen (0098).
- **A kill switch sits on both sides,** as PROJECT_RULES requires.

## The design, decided later the same day

The owner, 2026-09-14: "Saboot wala tareeqa".
- Before choosing, they asked what happens if the internet drops for more than 2 minutes, and whether a way without a
  timer exists that is both secure and complete.

**What was decided:**
- **Proof of receipt, not a timer.**
  - An exchange hands the phone a new pass and a new key, and keeps the old key waiting.
  - The first call made with the new pass proves the answer arrived. From then on, the old key is dead for good.
  - If the answer was lost, the new pass is never used. Whenever the phone comes back, it retries with the old key.
    The server hands it a fresh pair and cancels the unused one. The length of the drop does not matter.
- **A 7-day cap.** An old key whose successor was never used can retry for 7 days, then no longer. That phone signs in
  once, so a stolen old key cannot wait for ever.
- **Theft.** An old key seen after its successor's pass was used is a theft signal. It cancels that phone's keys and
  the passes they minted. That needs one more column, added to `V20260914_07` before it ships; the migration was
  never applied anywhere.
- **Expiry.** A key ends after 180 days without use. A phone in use never loses it.
- **The rate limits** are as proposed: `/renew` 10 an hour per phone and 100 per address.
- **Runbook:** if the signing secret ever leaks again, cancel every renewal key in the same step.

**Rejected:**
- **A retry timer of 2, 10 or 5 minutes.** A drop longer than the timer would still force a sign-in, and the timer
  measures the clock, not whether the answer arrived.
- **Strict rotation with no retry.**
- **Cancelling only keys on theft.** A thief's pass would live for 90 days.

## Rejected

- **Building it after 1.4.6.** This was the recommendation, to keep 1.4.6 on time.
- **Not building it.** Every key change and every 90-day absence would mean a sign-in.

## Consequences

- **1.4.6 ships later,** by the time this takes to build and verify.
- **Tier 1 (auth).** Its table ships alone and first, on the owner's word for the migration. The server part is live
  and proven before the app relies on it.
