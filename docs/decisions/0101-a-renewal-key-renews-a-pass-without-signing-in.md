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

## Rejected

- **Building it after 1.4.6.** This was the recommendation, to keep 1.4.6 on time.
- **Not building it.** Every key change and every 90-day absence would mean a sign-in.

## Consequences

- **1.4.6 ships later,** by the time this takes to build and verify.
- **Tier 1 (auth).** Its table ships alone and first, on the owner's word for the migration. The server part is live
  and proven before the app relies on it.
