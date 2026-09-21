# 0152 — A business's own footer choices follow the business to every phone

**Date:** 2026-09-22
**Status:** **DECIDED by the owner, 2026-09-22** ("finish every pending 1.4.9 item", which includes this). Built and
pushed on branches. **Not deployed:** the migration waits for the owner's word.
**Tier:** Tier 1 for the phone's database (an additive Room migration), Tier 2 for the sync contract (one optional field).
**Builds on:** [0151](0151-a-premium-footer-is-the-business-s-own-in-the-same-slots.md), which kept the choices on the
phone only and left a server column as the owner's call.

## What was wrong

0151 stored the owner's footer choices (which slots show, the message, the contact line, the QR target, "remove the
footer") in the phone's settings. The documents were right everywhere, because the snapshot carries the resolved
footer. But a second phone, a reinstall, or an added account's phone started from the defaults again.

## What is decided

1. **The choices live on the business row**, in one nullable text column that holds the same JSON the app already wrote
   (`OwnFooterSettings`): `businesses.footer_settings` on the server, `business.footerSettings` on the phone. It is
   presentation data for the business, with no image in it: the logo slot points at the business's own logo.
2. **A choice is an edit of the business.** Saving the sheet writes only that column, with a new edit time and number,
   and queues the business like any edit (a business the server has not had yet stays a create). The same choice
   saved again writes and sends nothing.
3. **Newest wins, as for every business edit.** The whole row is judged by its edit time, as it always was. No
   field-by-field merge.
4. **Null means "not said", never "cleared".**
   - The server keeps the stored value when a copy does not carry one. That covers every build up to 1.4.8, and every
     web write of a business.
   - The phone keeps its value when a pulled copy carries none. That covers a server before this change.
   - A reset travels as `{}`, which is also what the defaults encode to.
5. **The business form never touches the choices.** It does not hold them, so its save keeps what the row has.
6. **What 1.4.9's first internal builds kept on the phone moves in once,** at the first open of this build, and only
   where the row holds none. A value that arrived by sync is at least as new, so it stays. A choice for a business this
   account's file does not hold stays in the settings, untouched.
7. **The web needs no change for the choices.** The share page draws the footer the snapshot carries (`ownFooter`),
   resolved on the phone. It never reads the choices.

## How it is built

**Backend** (`invotick-apis`), two branches in deploy order, both from `stage` `49ebff0`:

- `migration/business-footer-settings` @ `5981146`: `V20260922_01__businesses_footer_settings.sql` alone. It adds
  `footer_settings TEXT NULL` if absent. The step is INSTANT on MySQL 8.0.46, so no table is copied and no row is
  written. The jar before it does not map the column, and `ddl-auto=validate` ignores an unmapped column.
- `feat/business-footer-settings` @ `76ddf9c`: `Business.footerSettings`, plus the field on `BusinessSyncV2Upsert` and
  `BusinessSyncV2Pull`. A create stores it. An update stores it when sent, and keeps it when absent.
  - Rows touched: the business row being written, as before. No new query.
  - Guards: `ABusinessFooterFollowsTheBusinessTest` (5). The keep-when-absent case goes red with the rule removed.
    `ACopyThatChangesNothingKeepsItsNumberTest` now tries the new field too: the number moves exactly when it changes.
  - Full suite: 1349/1349.

**App** (`invoice-kmp-app`), `VC_108_VN_149` @ `63d15aaa` (also `feat/business-footer-settings`):

- Room 5 → 6: `business.footerSettings`, `@AutoMigration(5, 6)`, `6.json` exported. The schema diff is that one column.
  No new table, so `UserMigrationDao` needs nothing: its moves are UPDATEs that keep every column.
- `BusinessDao.setFooterSettings`, `adoptFooterSettings` and `observeFooterSettings`; `BusinessRepository` exposes
  them. `BusinessDto.footerSettings` goes on the push, and the pull keeps the phone's value when the copy has none.
- `OwnFooterStore` is now only the in-memory copy of the open account's rows. `AppViewModel` belongs to one account
  (0146), so a switch builds it again on the next file. It feeds the store every row, writes each choice the sheet
  saves, and moves the phone-only copy in once.
- Guards:
  - `ABusinessFooterFollowsTheBusinessTest` (8): real Room, the real push and pull. It goes red in 2 places with the
    keep rules removed.
  - `AnUpdateToV6KeepsEveryBusinessTest` (1): a 1.4.8 file built from `5.json` and opened by the app's own database.
  - `AppDatabaseMigrationTest.migrate5To6`: runs on a device only; compiled here.
  - `OwnFooterRulesTest`: 25 tests.
- Suites: `:data` 451, with one timing flake in `APushTokenFollowsTheSignedInAccountTest` that passed twice when run
  alone. `:core:common` 31, `:feature:document:invoice` 61, `:domain` 78, `:core:datastore` 45.
- Builds: `:composeApp:assembleDebug` and the iOS simulator Kotlin compile are green, and `shared-id-check` passes.

## Old apps

- **Unaffected.** Builds up to 1.4.8 never send the field, and the server then keeps what is stored.
- They ignore the new key on a pull: every build's HTTP client has `ignoreUnknownKeys = true`.
- A 1.4.9 phone talking to today's server is safe too. Spring ignores the unknown field, and the phone keeps its own
  value when the pull carries none.

## Deploy order

1. Backend `migration/business-footer-settings` to `stage`, alone. This needs the owner's word.
2. Backend `feat/business-footer-settings` to `stage`, once step 1 is live.
3. 1.4.9 goes to the Play Store / TestFlight only after step 2.
   - If 1.4.9 reached phones first, a choice saved on a phone would be answered SUCCESS by the old server and dropped.
   - It would then reach other phones only when it is next edited. That costs nothing, but it silently undoes the
     point of this decision.

## Rejected

- **A new table for footer settings.** It would be a new user-owned table: a new sync group on both sides, a
  `UserMigrationDao` entry, and a purge rule, all for one small value per business.
- **Field-by-field merge of the footer against the rest of the business.** No other business field has one. Two phones
  editing one business's footer and profile in the same minute are rare (2 of 1,107 writing accounts had two writing
  phones, 2026-09-12).
- **Null as "reset".** A null would let every old build's edit erase the choices on the server.
- **Keeping the choices in the settings and syncing the settings file.** No settings sync exists, and the choices
  belong to a business, not to a phone.
- **A per-invoice copy in the presentation JSON.** Already rejected in 0151.
