# 0153 — A guest inside the legacy file moves into a file of its own: copy, check, switch, then remove

**Date:** 2026-09-22
**Status:** **Built** on app `VC_108_VN_149` (test `a8f819b1`, code `501026fc`), for **1.4.9**. Not released, not run on
a phone. No server change.
**Tier 1** (data on guests' phones, no rollback). Owned by the sync agent (0051).
**Related:** 0146 (several accounts on one phone, each in its own file: this is its stage 3), 0053 (a guest's work
joins an account only on a yes), 0145 (a phone joined by QR), 0013 (sign-out erases only what is sent),
`.claude/agents/sync.md` rules 41 and 43.

## The owner's words

> 2026-09-22: *"finish every pending 1.4.9 item before release"* — his go for 0146 stage 3, which waited for it.

## What the data says (production, read-only, 2026-09-22)

- **Who sits in `invotick_v2.db` beside its account:** a guest kept apart at a sign-in (0053 "No") and the guest a
  phone was before it joined an account by QR (0145). A signed-out registered account waiting to be erased
  (`AccountDataPurger`) sits there too, but it is that code's.
- **How many:** few. `guest_work_claims_total` shows **at least 1** keep-apart in the last 15 days (a counter reset at
  every deploy reads low). 41 QR links ever, 29 of them to a guest (0145), are the upper bound for the second group.
  Each such phone holds that guest's only local copy until it syncs, so each one matters.
- Not measurable from the server: which phones still hold such a guest. The event below measures it after 1.4.9.

## What was built

Per guest, while `invotick_v2.db` is the open file, off the main thread, 30 s after the app or an account opens
(Android at `onCreate` and after every switch, iOS at the hand-off; the same common code on both):

1. **Copy** every row the guest owns into a new file `invotick_acct_g<guest id>.db`. Also copied: the rows that go
   with them (its `users` row, an invoice line with no owner, its images, reminders, first-use flags, settings, sync
   log). The waiting queue keeps its own ids, times, priorities and order.
2. **Check** the new file table by table: the same row count, the same ids and the same values in the same types, by
   two checksums. Nothing else may be in any table.
3. **Switch:** one write adds the guest's place to the register, parked. Its session waits there as a guest, its pass
   is asked for again when the vault holds none, and the open account is not touched.
4. **Remove** the guest's rows from the legacy file, in one transaction. Only rows the new file holds are removed, and
   never a row that a kept row names. The guest's `users` row goes last, only when nothing names it.

**Crash-safe:** nothing is removed before step 3, and step 3 happens only after step 2 passed.
- A failure before step 3 deletes the half-made file and leaves the legacy file untouched.
- It is tried again after 1 h, 6 h and 24 h, then daily, 6 attempts in all.
- A process that dies after step 3 only removes, on the next run.

**How it finds what goes:** from the file's own schema (owner column, foreign keys), never from a list of tables. A
table added later moves without anyone remembering it.

**Left where it is, and said once:**

| Reason | When |
|:--|:--|
| `guest_work_undecided` | 0053's question for this guest is not finished: a "yes" would still join it to the account |
| `already_has_a_place` | the phone already holds this guest in a place of its own (0144's return) |
| `too_many_accounts` | the phone holds 5 accounts |
| `another_account_points_at_it` | an account row names a guest row (e.g. the account's invoice line uses the guest's product) |
| `points_at_another_account` | a guest row names an account row |
| `a_default_points_at_it` | a shared default names a guest row |
| `names_a_missing_row` | a guest row names a row that is not there |
| `not_a_guest` | the owner is a registered account not waiting to be erased |

**Shared defaults** (`00000000-0000-0000-…`, the seeded templates, headers, taxes…) are copied into the guest's file
and stay in the legacy file. Often the guest seeded them, and the account's invoices name them. In the legacy file
they are handed to its account.

**Kill switch:** Remote Config `legacy_guest_move_enabled`, and `account_switcher_enabled` with it. The move is on
unless Remote Config says `false`, read from the saved copy; unreadable counts as on. Off, no move starts and a guest
not yet moved stays exactly where it is.

**One coded event, `legacy_guest_move`** (AGENTS-EVENTS §1.1, §6):
- `outcome`: `moved | skipped | failed`;
- `reason`: `done`, a reason above, or the failed stage (`open_target | copy | check | schema_differs | register |
  remove | remove_refused`);
- `guest_id` (a join key, §1.18), `rows`, `queue_rows`, `removed_rows`, `left_in_legacy`, `attempt`, `elapsed_ms`, and
  `exception_class` on a failure.

Each outcome is sent once per guest. Nothing is pressed, so it is coded, and no existing event is about this.

## Proven (tests, real Room schema)

`AGuestInTheLegacyFileMovesOutWholeTest` (10, Robolectric) and `AMovedGuestGetsAPlaceOfItsOwnTest` (4). Red first: the
test commit alone does not compile, 153 errors, all in those two files.
- A guest with a row in all 21 synced tables and every other owned table moves whole. The account's rows are
  unchanged, value for value, and the shared template both name stays with the account.
- Every table with an owner column moves: the 23 of `UserMigrationDao.migrateAllUserData`, plus `user_state` and
  `user_preferences`.
- The waiting queue keeps its order and goes out under the guest's own account.
- A process killed at each of the four steps loses nothing, and the next run finishes.
- A second run changes nothing. A half-made file, or a file that is not a database, is made again.
- A copy that differs in one value is never registered, the legacy file keeps everything, and it is retried after
  its wait.
- A guest row that an account row names stays, and is said once.
- Nothing moves while switched off, while the guest's question is open, or while another file is open.

Whole unit suite 1034/1034, `:composeApp:assembleDebug`, `:composeApp:compileKotlinIosSimulatorArm64`.

## Rejected

- **Moving at the app update, inside a Room migration.** A migration runs before any screen, cannot be switched off,
  and a failure there stops the app from opening. The one rename in the app's history lost every phone's data.
- **`ATTACH DATABASE` and `INSERT … SELECT`.** Android's framework SQLite turns a database out of WAL when a file is
  attached through it (`SQLiteDatabase.execSQL`). Whether the fallback driver some phones run does the same was not
  tested, and a live file holding the account's data is not the place to find out. Row by row is fast enough for one
  guest.
- **Moving through the 21 entity DAOs.** Every future table would have to be remembered. The schema-driven copy moves
  what the file holds.
- **Deleting in the same step as copying**, without a register write between them. A process killed in the middle
  would leave a guest in neither place, or in both with no way to tell which is true.
- **Moving the shared defaults with the guest.** The account's invoices name them: removing them would clear those
  links with no error (foreign keys `SET NULL`).
- **Cutting a link to make a move possible** (setting the other account's reference to null). That is silent damage;
  the guest stays and the event says why.
- **Moving while the legacy file is parked.** Its account's settings (the undecided question, the signed-out accounts)
  are parked with it and cannot be read live. It waits until that account is opened again.
- **Asking a proof question to open the moved guest.** 0146 Q3 rejected it for a guest the phone holds.
- **Moving signed-out accounts waiting to be erased.** `AccountDataPurger` sends their work and erases them; moving
  them would make an account the user left switchable again.
- **Removing the legacy file's own account once only it is left.** It is not built here. The file also holds the
  phone's received invoices (0146, open), and it would be a new button. That is question 1 below.

## Open

- **Run on a real phone of each platform**, with a guest kept apart, before 1.4.9 ships (Robolectric has no Keystore;
  0146 stage 2 has the same item).
- **After 1.4.9:** count `legacy_guest_move` by outcome and reason per phone; `failed` and `left_in_legacy > 0` are
  the cases to read.

## The owner's question

> **Answered 2026-09-22 by 0154:** received invoices now live in the phone's own store, so "remove from this phone"
> is offered for the `invotick_v2.db` account too — only once its received invoices are moved and no other owner's
> rows are in its file.

1. Jab purani file mein sirf us ka apna account reh jaye, to kya "Is phone se hatayein" us ke liye bhi khule? (Us
   file mein doosron ki bheji hui invoices bhi hain; pehle unhein naye khule account ki file mein le jana hoga.)
