# 0154 — A received invoice is the phone's; each action on it is an account's

**Date:** 2026-09-22
**Status:** **Built**, for **1.4.9**. App `VC_108_VN_149` (pushed): test `72d45c36`, code `35420158`. Backend:
migration branch `migration/shared-invoice-decided-by-user` (`db65d33`), code branch `feat/decision-names-its-account`
(test `96a05a4`, code `7a46618`, erase `a66f1bb`) on top of it. **Nothing deployed, nothing released.**
**Tier 1** (data on guests' phones, no rollback), Tier 2 (an API call gains an optional pass). Owned by the sync agent
(0051).
**Related:** 0146 (one database file per account), 0153 (its question 1 is answered here), 0110 (the share-loop
events), 0144 §1 (never a whole email on screen).

## The owner's words

> 2026-09-22: received invoices are **viewed phone-wide**, like a PDF anyone on the phone can open, but **every action
> on one belongs to the account that took it.**

## What the data says (production, read-only, 30 days to 2026-09-22)

| | Count |
|:--|--:|
| Decisions stored on the server (`shared_invoice.approved_at`) | 64 (59 approved, 5 declined) |
| … of them sent by the app (`shared_invoice_approved`, Android) | 4 |
| … sent by the web page (`platform=Web`) | 40 |
| Received invoices opened in the app (`shared_invoice_opened`) | 102 opens, 27 phones |
| Taps on Tools → Received Invoices (`tools_received_invoices_click`) | 529 taps, 316 phones |
| Rows where `shared_invoice.decided_by` was ever written | **0** |

- The Received list is used far more than the decision buttons: 316 phones opened it.
- The server has never known who decided. `decided_by` exists (free text, 2026-07-11) and nothing has ever filled it.
- How many phones hold received invoices in more than one account file cannot be read from the server; 1.4.9 is the
  first build with more than one file. The event below counts it.

## What the code said before (app `VC_108_VN_149` @ `501026fc`)

- `received_invoices` sat inside the open account's database file (0146). An invoice opened while account A was open
  showed only in A.
- `invotick_v2.db`'s account could not be removed (0153, question 1): its file held the phone's received invoices.
- A re-open overwrote `firstOpenedAt` with now (an upsert of a new row), so "when it arrived" moved on every open.
- A decision on the receiver screen was never written back to the stored row.
- The decision call sent no pass. The server's filter lets a public route through with or without one.

## What was built

**1. One phone store.** `invotick_phone.db` (`PhoneDatabase`, version 1, schema exported), beside the account files and
never one of them: a switch never opens or closes it, 0153 never moves it, "remove from this phone" never deletes it.
Android and iOS (Documents folder, bundled SQLite) use the same common code.

**2. The move** (`ReceivedInvoicesMove`), from every file in the register, `invotick_v2.db` included:
1. **Copy:** every row merged into the phone store in one transaction.
2. **Check:** each token read back must hold at least what the file held (its first and last opening, a decision, the
   document).
3. **Remove:** in one transaction, only rows still exactly the copy that was moved. A row opened again mid-move stays
   and moves next time.

- Nothing is removed before the check. A process killed after any step loses nothing, and a rerun changes nothing.
- It runs off the main thread, 30 s after the app or an account opens, before 0153's guest move, holding the file lock.
- The account files keep their `received_invoices` table, empty: Room migrations stay additive (invariant 5).

**3. One token in two files is one row:** the earliest `firstOpenedAt`, the latest `lastOpenedAt`, the content of the
copy opened last, and the latest known status. A decision is never replaced by PENDING, because the server locks a link
after its first decision. The same join in any order, and again, gives the same row.

**4. The list is the same in every account.** It shows the phone store and the open account's file joined by token, so
it is whole before the move and while switched off. The count is one per document.

**5. Actions are per account.**
- A decision is written with the account that made it: `decidedByAccountId`, and the label the drawer shows for it
  (`a•••@gmail.com`, or `Guest •••441`; never a whole email).
- Another account reads **"Approved by a•••@gmail.com"** on the screen and in the list, and is not asked again.
- **Can a decision be changed?** No: the server answers 409 to a second decision (`SharedInvoiceService.decide`, "Lock
  after the first decision"), and the screen hides the buttons once decided. Nothing here changes that.
- A decision made elsewhere (the web, or before 1.4.9) names nobody and reads as before.
- **The seam for "record as expense / purchase"** (not built): such an action is the account's own business data, so it
  becomes a row in **that account's synced tables**, naming the received token, never a row in the phone store. It is
  written on `ReceivedInvoiceStore`.

**6. The server learns who decided.**
- The app sends the open account's pass with the decision, and never `X-Device-Id` (a removed phone named by that header
  is refused 401 even on a public route, and a 401 signs a user out). A 403 (a drain pass) is sent again with none.
- The backend keeps that account in `shared_invoice.decided_by_user_id` (one nullable column, indexed; 1,187 rows in the
  table on 2026-09-22). When that account is erased (0111), only this name is cleared. No public answer carries
  it; the body's free text `decidedBy` can never set it. With no pass, or one it cannot accept, the decision is taken
  exactly as before.
- Builds up to 1.4.8 and the web send no pass: nothing changes for them.

**7. "Remove from this phone" for the `invotick_v2.db` account** (0153's question). Offered like any parked account,
with the usual warning, which now adds "Invoices other people sent you stay on this phone." It removes only when, read
from the file itself:
- nothing of it is unsent (as for every account);
- its received invoices are in the phone store (moved first; if they cannot move, nothing is removed:
  `ReceivedNotMoved`);
- no other owner's row is in the file: a guest 0153 left where it was, or a signed-out account still waiting to send
  (`OthersInside`).
Then its pass and push token go as for any account, the register forgets it, and `invotick_v2.db` is deleted through
its own door (`deleteLegacyDatabase`), the only code allowed to. The open account is never removed.

**Kill switch:** Remote Config `received_phone_store_enabled`, on unless it says `false`. Off: no move starts, a newly
opened invoice is kept in the open account's file as up to 1.4.8, and the list still shows both places. The legacy
account then cannot be removed while its file holds received invoices.

**Events** (AGENTS-EVENTS §1.1, §6):
- `shared_invoice_approved`, `_rejected` and `_decision_failed` gain **`decided_as`**: `account | guest | none`. A kind,
  never an id; the event already carries its account.
- New coded event **`received_invoices_move`**, because nothing is pressed and no event is about this: `outcome`
  (`moved | failed`), `reason` (`done` or the failed stage: `read | open | open_store | merge | check | remove`), `file`
  (`legacy | account`, never the file name), `rows`, `removed_rows`, `already_on_phone`, `left_in_file`, `elapsed_ms`,
  and `exception_class` on a failure. Sent once per file that held rows, and per failure.

## Proven (tests)

- App, real Room (Robolectric), `AReceivedInvoiceBelongsToThePhoneTest` (15): the move from three files, the token
  merge, a crash at each of the three steps, a rerun, a row opened mid-move, the kill switch, the list from two
  accounts, a decision attributed and read by the other account, the legacy account removed with its received rows kept,
  and kept while its rows cannot move or a guest's work is inside.
- App, receiver screen, `ADecisionNamesItsAccountTest` (3): the decision recorded with its account, "by …" for the
  other account, `decided_as` on all three events.
- Red first: the test commit alone does not compile, 187 errors, all in those two files. With four rules broken on
  purpose (first opening, remove before copy, decider ignored, other owners ignored), 7 of the 15 failed.
- Whole unit suite 1047/1047 (182 classes), `:composeApp:assembleDebug`, `:composeApp:compileKotlinIosSimulatorArm64`.
- Backend: `ADecisionNamesTheAccountThatMadeItTest` (6, through the real security chain). The full suite first failed on
  `AClosedAccountIsErasedAfterItsWindowTest`: the new column names an account, so the account erase (0111) must deal
  with it. It now sets `decided_by_user_id` to NULL by its index before deleting the account's own shares; the
  sender's share and the decision stay (a new case there). Full suite **1408/1408** (260 classes).

## Rejected

- **Received invoices bound to the open account** (as since 0146). A PDF on the phone does not disappear when another
  account is opened, and it tied the legacy account to the phone for ever.
- **Global for actions too** (one phone-wide decision with no account). An approval is a business act: "who approved
  this?" must have one answer, and a future "record as expense" must land in one account's books, never in all of them.
- **Copying the rows into every account file.** Five copies drift apart, and a decision would have to be written five
  times.
- **A Room migration moving the rows at the update.** It cannot be switched off, runs before any screen, and a failure
  there stops the app from opening (0153's reason).
- **Dropping `received_invoices` from the account files.** Destructive; invariant 5. It stays, empty.
- **Sending the account id in the body** (`decidedBy`). Anyone holding the link could type any id; only a pass proves
  the account.
- **Showing the decider's whole email.** 0144 §1: the drawer never shows one, and neither does this.
- **Letting another account decide again.** The server has always locked a link after its first decision.

## Open

- **Deploy order** (the owner's go): the backend migration alone first, then the backend code, then 1.4.9. The app
  works against today's server: the pass is ignored and nothing is stored.
- **Run on a real phone of each platform** with two accounts and received invoices in both, before 1.4.9 ships
  (0146 and 0153 have the same item).
- **After 1.4.9:** `received_invoices_move` by outcome per phone (`failed` and `left_in_file > 0` are the ones to
  read); `decided_as` split; `shared_invoice.decided_by_user_id` filled on app decisions.
