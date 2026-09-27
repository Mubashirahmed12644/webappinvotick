# 0178 — An error a person reads is a plain sentence, and it is counted

**Date:** 2026-09-27 · **Owner:** G3 rule ("nothing may make the app look careless or broken"), and the same day:
*"ye issues report bhi hony chahye, yan isko events side per kerwa do, and jin events ko healthcentre main jany ki
zaroorat hy to usko bhi daal do."* · **App:** `invoice-kmp-app` `fix/plain-error-text` off `VC_113_VN_149`
(`8d22bff2`). Follows 0177, which did the save forms.

## Decision
- **No screen shows an exception's text.** Every failure a person reads is one plain sentence in one voice:
  "Couldn't load your clients. Please try again.", "Couldn't delete this invoice. Please try again.",
  "Couldn't create the PDF. Please try again."
- **One door.** Screens get the sentence from `ShownError` (`domain/model/form`); the few helpers below `domain`
  (WhatsApp, camera, speech input) use `ErrorReport.shown` (`core/common`). The same call:
  1. returns the sentence;
  2. logs the exception's class and message for us, never the person's data;
  3. reports **`error_shown`**. A screen cannot show one without the other.
- **`error_shown`** — coded, so it always sends. One row per failure a person saw. The gateway stamps `screen`,
  platform and build. Parameters are codes only:
  - `action`: `load | save | delete | share | export | send | other`
  - `subject`: `clients | client | invoice | invoices | estimate | estimates | tax | terms | unit | category |
    header | background | template | currency | onboarding | business | item | expense | merchant | signature |
    stamp | payment_method | ledger | account | other`
  - `exception_class`: the thrown class's simple name; absent when nothing was thrown
  - `http_status`: only when a server answered
  - `kind`: `network | server | local | unknown`, decided in one place (`ErrorShown.kindOf`, `core/analytics`)
- **Not reported:**
  - a cancelled coroutine: the screen is gone (§1.19). A timeout is still reported;
  - a second showing of the same failure: state plus snackbar, or a retried state update;
  - a sentence a screen keeps in its state but never draws (`drawn = false`). Found at: the drawer, the exit
    dialog, the dashboard, customer details, both ledgers, both currency dialogs, the estimate and invoice
    previews, the translation, the language sheet, custom templates.
- **A client still used by an invoice says why**, not "try again": "This client has invoices, estimates or
  payments, so it can't be deleted."
- **`ErrorTextNeverReachesThePersonTest`** (app, `data/androidUnitTest`) reads the source. It fails on:
  - exception text handed to anything the person sees;
  - a sentence written in place inside a `catch` / `onFailure` / `…Result.Error` branch.
  It was red on `8d22bff2` with 146 + 36 findings.

## Why
- About 130 places showed `Failed to …: ${e.message}`, SQLite's words included. A person reads that as the app
  being broken with their data (G3).
- Nobody counted what people saw. A screen that failed told the person and nobody else.

## Changed from the brief
- `subject` gains `signature`, `stamp`, `payment_method`, `ledger` and `account`. Without them those screens could
  only say `other`.
- `drawn = false` exists because a message stored and never drawn is not "shown". Counting it would make the Health
  Centre's number lie (§0: a number that can lie is worse than none).

## Left as they are (the guard lists each)
- **Payments.** Everything under `feature/paymentForm` and `PaymentBottomSheetViewModel` waits for the owner's
  review of that form.
- **Debug-only screens.** Sync diagnostics and the analytics events screen.
- **Not shown to anyone.** The sync workers and an ad event parameter.
- **The server's own sentence, shown as it comes.** Sign-in, sign-up, OTP, e-mail change, device link, and the
  receiver's approve/reject.
  - Open: those flows also show a network exception's text when there was no answer. The profile screen does too;
    it mixes server and validation sentences, and needs its own pass.
- **Already counted elsewhere.** The offline guest sign-in's `AuthResult` sentence is counted by
  `guest_login_failed`. Its text is now plain.

## Rejected
- Reporting at render time from each screen: 40 screens to touch, and every new screen would have to remember it.
- A second event per screen (`clients_load_failed`, …): one action, one event (§1.1).
- Putting the exception's message into the event: free text, possibly the person's data (§1.22, §7.9).

## Open
- Health Centre card: by another agent, on these names.
- iOS: the same code ships in the shared modules. `domain`, `core/common`, `core/analytics` and `invoicePdf` compile
  for iOS (Kotlin). The app's iOS build was not run.
- Sign-in, sign-up and OTP: `AuthRepositoryImpl` still turns a thrown exception into `AuthResult.Error(ex.message)`,
  which those screens show as the server's sentence. That needs its own pass, with a way to tell the two apart.
