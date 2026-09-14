# 0102 — "Import from contacts" uses the phone's own contact picker, in 1.4.6

**Status:** decided by the owner on 2026-09-14 ("1.4.6 mein hi"). It is to be built for 1.4.6.

**Related:**
- 0095, 0096, 0100;
- Google Play's restricted-permission rule for `READ_CONTACTS`;
- Apple's App Store Review Guideline 5.1.2.

## Context

- **Today** the button asks for permission to read the whole address book, reads all of it, and shows the app's own
  list.
- **Both stores now point to a system picker:**
  - Android 17 has the Contact Picker (`ACTION_PICK_CONTACTS`); older Android versions have plain `ACTION_PICK`;
  - iOS has `CNContactPickerViewController`.
  - Neither needs a permission, and the app receives only the contact the user picked.
- **Google Play is making `READ_CONTACTS` a restricted permission.**
  - Play Console asks for a declaration from September 2026.
  - It is mandatory from 2027-01-27 for apps targeting Android 17. We target 36.

## Decided

- **In 1.4.6, "Import from contacts" opens the phone's own picker,** on Android and iOS. The app receives only the
  picked contact's name, numbers, emails and address, and fills the client form as today.
- **The app stops asking for the contacts permission,** and the code that read the whole book goes.
  - Android's `READ_CONTACTS` leaves the manifest.
  - The iOS permission text goes, if nothing else needs it.

## Rejected

- **After 1.4.6, before targeting Android 17.** This was the recommendation, to keep 1.4.6 on time.
- **Keeping the whole-book permission.** It needs a Play declaration later, and the approval is uncertain.

## Consequences

- **1.4.6 ships later** by the time this work takes.
- **One permission popup fewer** on the way to a first invoice (G1).
- **0096's plan to bring back a whole-book upload cannot use this path.** It would need the permission back, against the
  direction of both stores.
- **The picker looks like the phone's own screen,** not ours.
