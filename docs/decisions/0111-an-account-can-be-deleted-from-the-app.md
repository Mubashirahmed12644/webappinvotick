# 0111 — An account can be deleted from the app

- **Date:** 2026-09-15
- **Status:** decided by the owner on 2026-09-15: *"Band foran, mitao 30 din baad"* (close it at once, erase it 30 days
  later). Built on branches; not merged, not deployed, not released. **The erase is OFF** until the owner has read the
  list below and says so.
  - Backend `feat/account-deletion-migration` `c289647` (the migration alone); `feat/account-deletion`: tests
    `3f09a96` (did not compile first), code `5f8d758`, test hygiene `3174e64`. Full suite 1066/1066.
  - App `feat/146-delete-account` on `d607e05e`: tests `55de1489` (did not compile first), code `9b6eddfb`. domain
    52/52, data 317/317, feature:auth 15/15, composeApp 12/12; Android and iOS (simulator) compiles pass.
- **Decision:** a signed-in account can be deleted from inside the app; it closes at once, a sign-in within 30 days
  can bring it back only when the owner says so, and after 30 days the server erases it for good.
- **Related:** App Store guideline 5.1.1(v) · 0013 (sign-out and the phone's purge) · 0053 (guest work joins an
  account) · 0099 (a removed phone comes back on a password) · `.claude/agents/billing.md` · G3 (trust).

## Context

- **Apple requires it.** Guideline 5.1.1(v): an app that lets people create an account must let them delete it from
  inside the app. Invotick had no way at all: no button, no server route (`AuthControllerV2` had sign-out,
  revoke-session and change-password only), and the website's `/delete-account` redirects to the sign-in page.
- **Who has an account to delete.** Production, 2026-09-15: 14,943 rows in `users`: 533 signed-in accounts, 14,844
  guests, 1 admin.

## Decided

**Who.** A signed-in account (role `USER`) only.
- The menu item (*Menu → Account → Delete account*) is not shown to a guest, and the server refuses a guest (403).
- A guest has no email or password to come back with, and a guest's own sign-out already deletes its data on the phone.
- An admin account is not closed from the app.

**At once**, in one server transaction (`POST /v2/account/delete`):
- the account is marked closed (`users.closed_at`);
- every pass of it stops working: its sessions are revoked, its phones' notification tokens dropped, and any other
  pass is refused by the account's own state (the security filter answers 401 "This account was deleted.");
- every link it shared stops opening;
- **nothing is erased yet.**
- A second press keeps the first date, so the 30 days never restart.

**Premium.** The server never touches the store subscription (`billing.md`: never touch a customer's billing without
the owner's go, and the stores leave cancelling to the buyer).
- The answer says whether a subscription is still paid, and the screen tells the person to cancel it in Google Play or
  the App Store.
- While the account is closed nobody can read its premium, because nobody holds a pass to it. The erase removes the
  account's grant, which frees the purchase to be restored onto another account.

**The phone.** Only after the server has said yes, the phone signs out and erases its own copy of that account.
- The order matters: a deletion that never reached the server must not leave the person signed out of an account that
  still exists, with its copy gone.
- Anything on the phone that had not reached the server is lost with it. The confirmation screen says so.

**Coming back within 30 days.** A sign-in to a closed account (password, Google, or the forgotten-password code) gets
no pass. It answers 409 with `code: ACCOUNT_CLOSED`, `closedAt`, `eraseAfter` and `restorable: true`.
- 1.4.6 asks "Bring your account back?" and signs in again with `restoreClosedAccount: true` only on "yes".
- Builds before 1.4.6 show the server's sentence: *"This account was deleted on …. To bring it back, update Invotick
  and sign in again before …."*
- A wrong password is answered and counted exactly as for any account, so it learns nothing about the account.
- On return, the shared links stay off (share again for a working link), and the account's other phones sign in again.

**After 30 days** a sign-in reopens nothing (410, *"This account was deleted and is being erased."*).

**The erase** (`ClosedAccountEraser`, hourly, switch `account.erase.enabled`, **default off**). It covers the account
and every guest that was retired into it (`users.upgraded_to_user_id`).

*What it erases:*

| Group | Tables (files) |
|---|---|
| Documents | `invoices`, `invoice_items`, `invoice_payments`, `payments`, `estimates`, `estimate_items`, `expenses`, `shared_invoice` (and any old preview image), `invoice_date_repair` (the repair register's rows for them) |
| What documents are built from | `businesses` (logo file), `clients`, `merchants`, `inventory_items`, `templates` (image file), `headers`, `backgrounds`, `signatures`, `stamps` (image files), `payment_instructions`, `terms`, `item_categories`, `unit_types`, `taxes` |
| The address book the phone uploaded | `user_contacts`, `identity_claims`, `raw_contacts`, `contact_ingest_batches`, `registered_phone_lookup` |
| What the app recorded about its use | `analytics_events`, `analytics_sessions`, `analytics_sessions_v2`, `analytics_user_properties`, `sync_failure` |
| Premium | `entitlement` (the account's grant), `purchase_restore_answer` (the restores it asked), `client_premium_report` |
| Signing in | `linked_device`, `device_link_request`, `user_sessions`, `revoked_tokens`, `user_identities`, `user_preferences`, `user_state`, `login_attempts` |
| Last | the `users` rows (the retired guests, then the account), and the profile picture if it is one of our uploads |

- An image file is deleted only when it is one of our uploads (`/uploads/<uuid>.<ext>`), and only when no other row
  anywhere still names it.
- The 82 signatures that still name a developer's `http://localhost:8081` are not ours: they are skipped and counted.

*What stays, and why:*

| Stays | Why |
|---|---|
| `purchase_identity` | The store purchase itself: order id, token, product; no name, email or number. Kept so the buyer can restore it onto a new account. |
| `entitlement_binding_log` | Every hand-over of a purchase, kept by billing's rule. Ids only, which name nobody once the account row is gone. |
| `purchase_restore_answer` rows **asked by other accounts** that name this one as the owner | The other account's record. Ids only. |
| `support_view_log` | Which admin opened which account. Ids only; it has its own retention. |
| `invoice_currency_backfill_*` | Old repair registers: invoice ids and currency codes, no account column. |
| `contact_identities`, `identity_public_profile` | Aggregates over every uploader, keyed by phone number. See question 4. |
| A file another account's row still names | Deleting it would break that account's document. |
| Server logs (Loki, 30 days) and backups (nightly 14 days, monthly 400 days) | Copies that roll off on their own schedule. See question 3. |

*How it runs:*
- Each run takes at most 5 accounts, found by the `closed_at` index, and deletes at most 20,000 rows, 500 at a time.
  Each batch is its own short transaction, selected by an index on the account's key.
- `identity_claims` (460,962 rows) had no such index. The migration adds one, built online.
- A row that another account points at (another account's invoice naming this account's client) is **held, never
  forced**. The account's own row then stays until nothing points at it, and every run says what it held.
- A test fails if any column in the schema that names an account is neither erased nor listed as kept.
  - That test found `analytics_sessions_v2`, which the first list had missed.
- While the switch is off, each run erases nothing and writes one line saying how many accounts are waiting.

## Rejected

- **Delete everything at once, with no way back.**
  - One mistaken tap, or an unlocked phone in the wrong hands, would erase years of invoices for good.
  - An invoicing app lives on trust (G3).
  - Apple accepts a short, stated grace period.
- **Deletion by email request only** ("write to support"). 5.1.1(v) requires that deletion starts inside the app, and
  a manual process would be slow and easy to miss.
- **Letting a guest delete from this route.** A guest cannot come back, and its sign-out already deletes its data on
  the phone.
- **Cancelling the store subscription from the server.** It breaks billing's rule, and the stores leave cancelling to
  the buyer. The screen tells them instead.
- **Removing the account's linked devices at once.** Not needed: the account's own state refuses every pass. After a
  restore, a password or Google sign-in lets each phone back in (0099).
- **Reopening after the 30 days while the erase is still off.** The owner was told that date when they deleted; a
  reopening after it would be a surprise.
- **Bringing the shared links back on a restore.** A link is a frozen snapshot; sharing again gives a working one.
- **Forcing an erase through a row another account points at.** That would break the other account's document.

## Consequences

- **Deploy order:**
  1. the migration, alone, on the owner's go;
  2. then the server code;
  3. then the app (1.4.6);
  4. then, separately, the erase switch, on the owner's word.
- **Builds before 1.4.6** have no delete button. The App Store review needs the iOS build that carries it.
- **Store policies.** Google Play's Data safety form also asks for a web link where people can ask for deletion.
  - The website's `/delete-account` must stop redirecting to sign-in: it should explain the in-app way, and give an
    email for anyone who no longer has the app.
  - The privacy policy needs the paragraph in the report.
- **When Sign in with Apple lands,** Apple's token revoke runs at the moment of closing, through the
  `AccountClosedListener` hook built here.
- **A new table that names an account** must be added to the erase, or to the kept list with its reason. The guard test
  fails otherwise.
- **Proposed, not built:** a Health Centre card for accounts past their 30 days while the erase is off.

## Questions for the owner (to be asked one by one)

1. **Turn the erase on?** Recommended: yes, after reading this list and watching the first real closure on 1.4.6.
2. **Analytics rows:** erase them (built, recommended), or keep them with the account removed?
3. **Backups:** the monthly backup keeps 400 days. Recommended: say so in the privacy policy.
4. **The shared contacts table** (`identity_public_profile`): recompute it so this account's saved names drop out?
   Recommended: yes, as a follow-up.
5. **The web page** `/delete-account`: replace the sign-in redirect with a page that explains the in-app way and an
   email route? Recommended: yes, it is needed for Google Play too.
