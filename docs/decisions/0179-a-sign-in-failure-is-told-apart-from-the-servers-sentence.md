# 0179 — A sign-in failure is told apart from the server's sentence

**Date:** 2026-09-27 · **Follows:** 0178 (its "Open" item on sign-in, sign-up and OTP) · **App:** `invoice-kmp-app`
`fix/149-auth-failure-plain-text` @ `fbe945f4`, off `VC_113_VN_149` (`48db1417`); not merged. Auth is Tier 1 C: only the text changes. Unit suite 1615 passed + 1 skipped of 1617 (baseline 1604 + 12 new); the one failure was a 5 s timeout under another build's load, green 3 of 3 alone.

## Decision
- **Every account answer says which kind it is.** `AuthResult.Error`, `AccountResult` (e-mail change, device link),
  `ChangePasswordResult` and `AccountDeletion.Refused` / `DeleteAccountOutcome.Failed` gain `failure: Throwable?`:
  - `null`: the server answered, and `message` is its own sentence ("Invalid email or password"). Shown as it comes.
    Not counted: a refusal the server explained is an answer, not a fault.
  - set: nothing came back that could be read (offline, a timeout, an HTML error page). The screen shows a plain
    sentence and counts one `error_shown` with `subject=account`.
- **The profile's `Result` failures** tell the same apart by type: `PlainRefusal` (domain) carries the server's
  sentence or our validation sentence ("Passwords do not match"); anything else thrown is a failure.
- **One door on the screen:** `ShownError.account(…, step, where)`. `AccountStep` gives the sentence and `action`:
  sign in, sign up, send code, check code, reset / change password, load / save profile, profile picture, change
  e-mail, approve / remove a device, delete the account ("Couldn't sign you in. Please try again.").
- **No answer at all reads "Couldn't reach Invotick. Check your connection and try again."** — decided by
  `ErrorReport.isNoConnection` (`core/common`), the same list `error_shown`'s `kind=network` reads. The sentence
  and the count cannot disagree.
- **The data layer fills `message` with the same plain sentence**, so a caller that still shows it directly shows a
  plain sentence, uncounted, never exception text.
- **Unchanged:** `code` stays `-1` on a failure; nothing after the error (retry, navigation, 403 → code screen,
  session, closed-account question) changes.

## Exceptions, on purpose
- **The server guest sign-in keeps its words** ("Network connection failed"). Nobody sees them. They are
  `sync_failed.reason` for `stage=guest_auth`, and changing them would break that series. It carries `failure` too.
- **The offline guest's own sentence** ("Couldn't continue as a guest…") has no `failure`. It is shown as it is and
  counted only by `guest_login_failed`, never twice.
- **Apple's failure text** (on iOS, the system error's description) goes to the log; the screen shows the sign-in
  sentence.

## The guard
`ErrorTextNeverReachesThePersonTest` gains a third rule. `result.message`, `refusal.message`, `outcome.message` or
`answer.message` handed to the screen bare fails the build: only `ShownError.account` tells the two kinds apart.
`handleError(…)` / `handleLoginError(…)` now count as handing text to the person. `UserProfileViewModel`,
`EmailChangeViewModel` and `DeviceLinkViewModel` leave the skip list. The first run found one more place: Apple's
failure on the sign-in screen.

## Rejected
- **Reporting in the repository.** The guest sign-in and the splash call the same code without showing anything,
  so a report there would count failures nobody saw.
- **A flag `isServerSentence`.** The exception itself is needed for `exception_class` and `kind`, so the field
  carries it.
- **Parsing the message to guess.** A sentence cannot tell "the server said" from "an exception said".

## Still open
- The device link's "Could not get a code. Check your connection." is already plain, but not counted.
  `requestDeviceLink` returns null for a refusal and for a failure alike.
- The receiver's approve/reject (`ReceivedInvoiceViewModel.decisionError`) is not an account call. It stays on the
  skip list.
