# 0223 — The phone's own save and delete errors, traced to their roots

**Date:** 2026-10-16. **Status:** three app fixes built under the owner's rules *every error a user sees is reported*
(2026-09-27) and *a crash or error is fixed at the root, never hidden*. **Gradle not run, nothing pushed, nothing
released.** App `fix/153-sync-defects` (1.5.3, worktree `kaam/worktrees/invoice-kmp-app-153`): `7160a34d5`,
`a31f80cae`, `3ede093d2`. No schema change, no migration, no new event, no new string. One new value for an existing
parameter: `error_shown.kind=refused`.

**Related:** 0068 (a client in use is refused), 0011 (a closed sheet keeps its draft), 0163 (first Save seeds
templates), 0197 (`pdf_download_result`), 0215 (errors-users-saw card), 0216 (stranded record, §5 Q2).
**Evidence ledger:** `kaam/research/local-save-errors-2026-10-16.md`.

## Context

Health Centre, 2026-10-16 12:26 UTC: `errors-users-saw` CRITICAL ("Saving (business, payment_method) failed on the phone
itself for 3 phones in 24 h"), `stranded-work` WARNING (1 operation, account `d587ff1e`). Read with the admin API only:
543 `error_shown` rows over 14 days, plus `first_screen_reached`, `pdf_download_result`, one phone's whole trail, and the
sync-health signatures.

## What each one is

| Card line | Verdict | Root cause (evidence) | What was done |
|:--|:--|:--|:--|
| save `payment_method` · local · IllegalArgumentException | **Already fixed in 1.5.1** | Save on an untouched Cash dialog threw "Payment fields cannot be empty". 94 events / 53 phones in 14 days, **all on 1.5.0**; 0 on 1.5.1 and 1.5.2 (~2,280 phones) | `9b5ed953a`, in release 1.5.1 and 1.5.2. Nothing new |
| save `business` · local · IllegalStateException | **Real.** Two faults | (a) the phone had **no session**: `AddBusiness` throws "No active session" when `ownerId` is null. One phone (`4bd89783`, 1.5.2): two cold starts restored past the splash, `userId` null on every row, 4 refused Saves. Why its stored session vanished is not in the data (43 silent hours). (b) **the draft was cleared at the press of Save, before the write**, in the business, client and item sheets: the phone closed the sheet and lost what it typed | (b) fixed: `a31f80cae`, `*FormDraft.letGoAfter`, test `AFailedSaveKeepsWhatWasTypedTest`. (a) open, below |
| delete `item` · local · ArithmeticException | **Real, fixed** | Remove rebuilt the line from the fields and parsed them: an emptied quantity or price threw ionspin's "Empty string is not a valid decimal number", "1,5" a NumberFormatException. 24 events / 20 phones in 14 days, against 235 Remove presses in 7 days | `7160a34d5`: Remove sends the line as opened; test `RemovingALineNeverReadsItsFieldsTest` |
| delete `client(s)` · ClientInUseException | **Expected rule, not an error** | 0068's refusal; the sentence is already true. 148 + 35 events, 65 + 14 phones in 14 days, counted as `kind=local` | `3ede093d2`: `kind=refused`. Still sent — it is the evidence for 0068's open question |
| export `invoice` · unknown | **Real.** Download PDF never works on Android 7–9 | All failed invoice/estimate downloads in 7 days are Android 7.1–9 (7 of 7); **0 saved on Android ≤ 9** against 641 saved on 10+. The legacy saver writes to public Downloads, which needs a storage permission the app never asks for; it swallowed the exception, so `error_shown` had no class (53 events / 24 phones in 14 days). 90 of 2,897 active Android phones (3.1 %) are on 7–9 | `3ede093d2`: the savers throw, so the cause reaches `error_shown`. The cure is a decision, below |
| stranded-work · `d587ff1e` · 1 operation | **Known, owner decision** | One invoice line whose subtotal is over `DECIMAL(21,4)` (> 10¹⁷); MySQL 1264, refused since 2026-10-06, retries spent 2026-10-14. Still calling us, so recoverable | Nothing: already 0216 §5 Q2 (cap money input in the app, or widen the column) |

## Decided

1. **A draft is let go only after its write returned.** `BusinessFormDraft`, `ClientFormDraft`, `ItemFormDraft` gain
   `letGoAfter(write)`; the three view models wrap their write in it and set `savedSuccessfully` after. A save that
   throws keeps the draft, so reopening the sheet gives back what was typed (decision 0011's promise, now true on a
   failure too).
2. **Remove on the line sheet removes the line it was opened on.** The sheet keeps the opened `InvoiceItemDetails`; the
   document removes by id, so nothing typed over the line is read.
3. **A rule of ours that said no is `kind=refused`, not a failure.** Only `ClientInUseException` today. It stays in
   `error_shown` (one door, one event), so 0068's question keeps its evidence.
4. **A PDF that could not be saved names why.** The two Android savers throw instead of returning null.

## Rejected

- **Stopping `error_shown` for the client refusal.** It is the only count of people meeting 0068's rule (65 phones in
  14 days) — the owner's evidence for that open question.
- **A new event for refusals.** One action, one event (AGENTS-EVENTS §1.1); a parameter value says it.
- **Guarding the item parse with a try/catch or defaults.** The delete does not need the numbers at all; a guard would
  hide the same parse elsewhere.
- **Hiding the Remove button while a field is empty.** Removing a line must always work.
- **Writing the draft to storage.** 0011 keeps drafts in memory on purpose.
- **Asking for the storage permission, or switching Android 7–9 to the system "Save to" picker, in this change.** Both
  change what the person sees: a design decision, not a bug fix.
- **Building the no-session route (below) here.** It is auth/navigation (Tier 1), and the cause is not proven.

## Open

1. **Android 7–9 cannot download a PDF (owner, through the design agent).** (A) ask for the storage permission once,
   with the system's own dialog, then save as today; or (B) let the person pick where to save (system "Save to", no
   permission). Recommended: (B) — no permission screen, works on every version. 3.1 % of active Android phones.
2. **A start restored past the splash with no session (sync/auth owner).** The splash is the only place that turns "no
   session" into a guest or the sign-in screen; Android's restore skips it, and `AppViewModel.observeSessionState` only
   reacts to a session ending in the same process. Recommended: the first resolved `Unauthenticated` outside the
   sign-in screens takes the splash's own route, plus a coded event with what the store held, so the vanishing session
   can be explained. 1 phone in 7 days.
3. **Card rules (backend, `ErrorsUsersSawCheck`).** (a) leave `kind=refused` out of red/amber; (b) a local-save class
   seen only on builds older than the newest, never on the newest, reads amber "fixed in a later build" — today 1.5.0's
   payment-method fault (fixed in 1.5.1) keeps the card red while 644 phones still open 1.5.0.
4. **Estimate line Remove (to verify).** `EstimateScreen` sends every line-sheet result to `UpdateEstimateItem`, which
   keeps the old action, so Remove on an estimate line may not remove it. Read from code only.
5. **Ledger PDF on Android 10** writes to public Downloads with the File API (needs `requestLegacyExternalStorage` on 10);
   1 phone, 11 failures on 2026-10-14. Same family as Open 1.

## Gradle (the caller runs it; never two at once)

```
./gradlew :core:analytics:testDebugUnitTest :feature:document:invoice:testDebugUnitTest :feature:document:estimate:testDebugUnitTest :invoicePdf:compileDebugKotlinAndroid --rerun-tasks
./gradlew testDebugUnitTest nonAndroidTests :composeApp:compileKotlinIosSimulatorArm64 --continue --rerun-tasks
```
