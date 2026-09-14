# 0100 — Phones delete their cached copy of the address book once, in 1.4.6

**Status:** decided by the owner on 2026-09-14 ("Haan, aik dafa mita do"). It is being built for 1.4.6.

**Related:**
- 0095, the app stops sending the address book;
- 0096;
- `memory/contacts-upload-privacy.md`.

## Context

- **The copy.** Up to 1.4.5, "Import from contacts" copied the whole address book into the app's own database before
  uploading it. The copy held names, numbers, emails and addresses, in `contacts_cache.db`, table `cached_contacts`.
- **What it was for.** The picker never showed the copy; it reads the phone's list fresh each time. The copy fed only
  the upload and its "has the list changed" check.
- **What 1.4.6 leaves behind.** 1.4.6 no longer reads or writes the copy (0095), but existing copies stay.
  - Nothing deletes them, not even sign-out.
  - Android Auto Backup includes the file (`allowBackup="true"`, with no rules).
  - On iOS the file sits in Documents with no backup exclusion.
- **Store rules.** A copy outlives the user's permission:
  - Android revokes the permissions of apps left unused for months;
  - iOS 18 lets users share only chosen contacts;
  - Apple asks apps to respect permission settings;
  - Google asks apps to keep only what the feature needs.

## Decided

- **At the first open after updating to 1.4.6, the app deletes the cached copy, once.**
- **Untouched:** the user's contacts, their saved clients, and "Import from contacts".

## Rejected

- **Leaving it.** It is a useless copy of other people's details, in the app's storage and in the phone's backups, and
  it survives the user's permission.
