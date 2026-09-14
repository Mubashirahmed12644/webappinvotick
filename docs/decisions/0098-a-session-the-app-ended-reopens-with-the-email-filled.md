# 0098 — A session the app ended reopens on the same sign-in screen, with the email filled and the password one tap away

**Status:** decided by the owner on 2026-09-14 ("Email likha + password aik tap"). It is being built for 1.4.6.

**Related:**
- A1, in `memory/sync-audit-2026-09-11.md` (re-measured 2026-09-14);
- 0026, a session is renewed before it dies and never revived after;
- 0053;
- G3.

## Context

- **The key change.** On 2026-09-03 19:21 UTC the server's signing key changed.
  - The old key was a development placeholder, in git since the first commit, and it was printed into a transcript on
    09-04.
  - Every pass signed with it stopped working.
- **Who was hit: 517 phones.**
  - 502 guests got a new pass silently.
  - 9 registered accounts: 4 signed in again, and 5 have not come back (0 invoices waiting on their phones).
  - About 17 registered accounts still meet a sign-in screen at their next open.
- **What that screen does today:**
  - it says only "Your session has expired. Please login again.";
  - it starts empty, because the app deletes the email when the session ends;
  - it offers "Login as Guest", which hides their invoices until they sign in with their email;
  - it has no password-manager support.
- **The owner asked for an automatic sign-in** with the stored id and password. The app keeps no password, and the
  server keeps only a BCrypt hash, so neither can sign anyone in silently.

## Decided

- **The server: no change.** The old key never returns.
- **1.4.6: a "sign in again" mode on the existing sign-in screen.** It opens when the app ended the session itself. It
  does not open after a deliberate sign-out or on a first open. In this mode:
  - **The line:** "Please sign in again. Your invoices are safe on this phone — sign in with the same email to keep
    backing them up."
  - **The email is filled in.** The app keeps the account's email through an involuntary sign-out only. A deliberate
    sign-out still clears it, so a shared phone shows nobody's email.
  - **The password is one tap away** from the phone's password manager (Google or Apple). The manager also offers to
    save the password at every sign-in. The password never reaches us.
  - **"Login as Guest" is not offered.**

## As built (`feat/146-sign-in-again`, `ca2bccc5`, 2026-09-14)

- **When the mode opens:** it also opens from the sync-refused snackbar's "Sign in". A guest whose session ended still
  gets the old screen and snackbar.
- **The kept email:** it is copied in the same edit that removes the session's email. Any new session, guest included,
  clears it, and so does a deliberate sign-out.
- **The password:**
  - On Android the saved-password sheet opens by itself.
  - After any email sign-in, Android asks once to save the password, unless the password came from the manager.
  - On iOS only the keyboard's AutoFill works until `webcredentials:invotick.com` is in the app's associated domains
    and in the site's apple-app-site-association.
- **The guest button:** the sign-in screen never had a "Login as Guest" button (`LoginFooterActions.kt` is dead code). The
  real guest entry is Register's "Continue as Guest", which is hidden when reached from this mode.
- **A forced sign-out keeps the half-written invoice draft** (being added). A deliberate sign-out still clears it.
- **A Remote Config kill-switch, `sign_in_again_enabled`,** is on by default, as PROJECT_RULES requires.

## Rejected

- **Accepting the old key for a while.** Anyone holding it could forge a pass for any account.
- **A silent re-issue from the old pass.** It is the same hole.
- **Keeping the password on the phone for a silent sign-in.** Backups and compromised phones expose it, and people reuse
  passwords for email and banking.
- **Better wording only.** The user would still type both fields.

## Still to ask

- **A renewal key that survives a key change,** so the next change needs no sign-in. 0026 rejected refresh tokens for
  the expiry case.
- **The owner's idea of admin-panel-designed WebView screens.** A full analysis comes first, and sign-in stays native.
