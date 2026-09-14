# 0094 — The phone-number name lookup is removed

**Status:** decided by the owner on 2026-09-14 ("Poora hata do"). Being built:
- the server route goes in the next backend batch;
- the app's "Verify" button goes in 1.4.6.

**Related:**
- 0073, which found the route public, and 0074, which made it admin-only on 2026-09-13;
- `memory/contacts-upload-privacy.md`;
- `docs/RECEIVER-ON-INVOTICK-ANALYSIS.md`;
- G3.

## Context

- **What it was.** `GET /v1/lookup/phone` answered any phone number with the name other users most often saved for it
  in their uploaded address books: `identity_public_profile.bestName`, with a confidence score, and once a photo.
  It worked like Truecaller.
- **Where the names came from.** "Add a client from contacts" sent the user's whole address book to the server.
  - 509 users did so, giving 393,823 contact rows and 365,779 numbers.
  - 81,923 of those numbers have a name, and 1 has a photo.
  - It was first seen on 2026-04-07, and uploads still feed it today.
- **Until 2026-09-13 it answered anybody:** no token and no limit.
  - A stranger could turn any number into a name.
  - A script could have built a directory.
  - A private label, such as "Bilal Udhaar", went out as the name.
- **Its one caller** was the app's Contacts "Verify" button. That button has shown no name since 09-13, when the route
  became admin-only, and the route had 0 calls in 7 days.
- **What it gave:** little. The user already has the contact saved, so the button only told them what others saved.

## Decided

- **Remove the route and its service on the server.**
- **Remove the "Verify" button and its plumbing from the app,** in 1.4.6. Older builds keep a button that shows
  "not found", as it has since 09-13, and does not crash.
- **The stored names, and the upload that feeds them,** are the contacts-upload topic, decided separately.

## Rejected

- **Keeping it admin-only.** No admin task needs a stranger's name.
- **Narrowing it to "is this number an Invotick user".** The owner's requirement, a tag for clients who are on
  Invotick, needs a different fact: a verified user's own identity. It gets built on that, from the sender's own clients
  (see the analysis doc).

## Consequences

- **No user loses anything.** Adding a client from contacts keeps working.
- **The requirement is not affected.**
