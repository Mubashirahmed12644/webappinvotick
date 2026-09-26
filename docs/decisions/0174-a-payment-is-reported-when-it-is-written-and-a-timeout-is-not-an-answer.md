# 0174 — A payment is reported when it is written, and a timeout is not the user's answer

- **Date:** 2026-09-26
- **Status:** built, pushed, not merged, not released. App `invoice-kmp-app`, branch
  `fix/149-payment-and-consent-events-tell-the-truth` (`5f575013`) off `VC_113_VN_149` (`9d072965`). No schema change, no server
  change, no new event name, **no change to any payment or consent behaviour or screen**.
- **Owner:** user-journey (`.claude/agents/user-journey.md`). Two numbers that could not be trusted: half of the G1
  metric, and the whole consent funnel.

## 1. `payment_added` had never fired

**Measured on production, 2026-09-26, read-only:**

| | |
|:--|--:|
| payment rows created in the last 30 days | 419 (228 accounts) |
| — of which one receipt split over several invoices on the Payments screen | 33 receipts = 73 rows |
| payment rows ever | 1,113 |
| `payment_added` rows since 2026-01-01 | **0** |

(The "958 payments" quoted when this was raised was not reproduced: by `created_at` it is 419 in 30 days, and 1,113
ever. The conclusion does not change: zero events against hundreds of payments.)

**Why.** The one sender was `EditInvoiceViewModel.addPayment`, on an in-memory list change, reached only through
`EditInvoiceUiIntent.AddPayment` — an intent **nothing in the app dispatches**. Payments are actually written in
three places, and none of them reported anything:

| Where the payment is written | Code (at `9d072965`) |
|:--|:--|
| New invoice: Save, the draft kept at the Save gate, or the draft on leaving | `CreateInvoiceViewModel.saveInvoicePayments` |
| Edited invoice: Save | `EditInvoiceViewModel.onSaveClicked` |
| Payments screen (Tools → Payments): one receipt allocated over a client's unpaid invoices | `PaymentFormViewModel.onConfirmAllocationClicked` |

All three go through `CreatePaymentUseCase`, the only road to `PaymentRepository.createPayment`.

**Decided.**
- `payment_added` fires **after the write succeeded**, from those three places, through one helper
  (`core/analytics` `PaymentAdded.report`). A failed write sends nothing.
- **Parameters:** `source` = `create_invoice | edit_invoice | payments_screen`, and `invoice_count` (how many invoice
  payment rows the write produced). Nothing about the money: no amount, currency, reference, note or id.
- **One press, one event.** The Payments screen's split receipt is one row with `invoice_count = N`, not N rows in
  the same millisecond. On the invoice screens each payment the user entered is one row with `invoice_count = 1`.
  So `SUM(invoice_count)` reconciles with the `payments` table, and `COUNT(*)` counts what users did.
- The dead in-memory sender is removed; the name is now spelled in one file only.
- **Not a coded twin of a tap (§1.11).** The sheet's `+` is the auto tap `add_payment_success` — pressed possibly
  minutes before, and a payment added there can still be thrown away with the invoice. The Payments screen's
  confirm is `tap:create_payment_form:AllocationDialog.confirm_3`, and `payment_added` follows it within
  milliseconds **only when the write succeeded**. That is a press and its result, the shape §1.23 allowed for
  `premium_purchase_result` after the paywall's Continue. If `DuplicatePressCheck` pairs them, it is that shape.
- **Guard:** `EveryPaymentWrittenIsReportedTest` walks the repository: a file that writes payments N times must
  report at least N times, and no file but `PaymentAdded.kt` may spell `"payment_added"`. The fourth place that
  writes a payment fails the build the day it is written.

**Rejected.**
- *Firing inside `CreatePaymentUseCase`.* One gate, but it cannot tell the screens apart and would send N rows for
  one split receipt. `domain` also has no analytics dependency, and should not get one.
- *Firing on the sheet's `+` or on the in-memory list.* That is exactly the defect: a payment typed and then
  discarded with its invoice would count as G1.
- *Sending the amount.* It is the user's client's business, and "did this person record a payment" does not need it.
- *A `payment_record_failed` event* (drafted in `docs/analytics/event-catalogue.panel.json`). A real gap — a failed
  write is only a `println` today — but it belongs to the Payments review the owner has postponed (2026-09-13).

**Payment behaviour is untouched.** Only lines that report were added; the one structural edit is that
`PaymentFormViewModel`'s list of created payments is declared above its `try`, so a receipt that fails halfway
still reports the rows that were written. The screen's message, its error, its `throw` and its order are the same.

## 2. The consent form recorded "dismissed" for people who answered

**The defect.** The first-ad-moment consent flow gives UMP 4 s (`CONSENT_TIMEOUT_MS`). The clock starts when the flow
starts — **before the form appears, and through the time the person spends reading it**. When it ran out, the flow
wrote its one `consent_decision` row with what UMP held at that instant. On a first launch nothing had been chosen
yet, so `ConsentSignals.outcome` read it as `dismissed`. The form stayed up; the person pressed **Consent**; and the
row that would have said `granted` was dropped as a second one. Found by the iOS consent agent and reproduced on the
Simulator: the only `consent_decision` row production holds is that one (`iOS`, build 26, debug, `dismissed`,
`elapsed_ms = 4003`).

The logic was **duplicated per platform** (`AndroidConsentController.ensureConsent`, and `IosConsentController` on
`feat/ios-gdpr-consent` mirrors it on purpose), so it could not be fixed once.

**Decided.**
- The per-flow bookkeeping moves to `commonMain`: `ConsentFlowRecord`. Each controller tells it three things — the
  wait ran out, the form closed (with or without a UMP error), UMP refused — and it writes the one row.
- **The wait running out writes nothing.** It still releases the waiting ad-moment exactly as before
  (`onResolved(canRequestAds())`); only the analytics row waits for the real end of the flow.
- The row carries a new parameter, **`timed_out`** (`true | false`): whether the ad-moment had stopped waiting before
  the flow ended. Present on every `first_ad_moment` row; **absent** on `privacy_options`, which has no wait (§1.7).
- **No new `outcome` value.** `outcome=timeout` was considered and rejected: with one row per flow it would *replace*
  the person's answer, which is the loss being fixed. The timeout is recorded as what it is — a fact about our wait,
  on a parameter — and `outcome` keeps meaning what the person (or UMP) did.
- `dismissed` keeps its meaning: UMP says the form closed and nothing was chosen.
- A UMP refusal that arrives **after** the wait ran out is now recorded (`outcome=error`, `timed_out=true`). On
  Android it used to be dropped, because the timeout had already written the row.

**What it costs.** A flow that never ends — the app killed with the form on screen — now writes no row, where it used
to write a false `dismissed`. That flow still shows as a `consent_form` `screen_view` with no decision after it,
which is the honest shape of "we do not know".

**Old rows.** No store build has sent `consent_decision`: the consent code is on `VC_113_VN_149` (1.4.9) only, not on
the live `VC_107_VN_148` (1.4.8), and production holds **one** row in 30 days — the Simulator's. So there is no
history to correct. Should any build without this fix ever send rows, read `entry=first_ad_moment`,
`outcome=dismissed`, `elapsed_ms` between 4,000 and ~4,300 and no `timed_out` key as **the timeout, not the person**;
their real answer was never recorded. No backend query, panel page or Health Centre check reads `consent_decision`
today (searched `invotick-apis` `origin/stage` and the admin panel), so nothing needs a note.

**Found and not fixed — ad behaviour, not analytics.** When the wait runs out, `ensureConsent` calls `onResolved`
once with `false` and `ConsentGate` marks the flow resolved. When the person then consents, the form callback
returns early (`if (handled) return`), so the gate's `open` flow stays `false`. The banner reads that flow and only
asks again when the value changes or it enters a new screen, so **the banner on the screen where the person just
consented can stay empty until they move screens**. The app-open and interstitial paths call `allowed()` directly
and are not affected. This is the owner's call (monetisation), not an analytics fix.

## iOS: the equivalent change (for the coordinator; `feat/ios-gdpr-consent` was not edited)

In `IosConsentController.ensureConsent`, replace the local `decided` / `decideOnce` with the shared record:

```kotlin
val record = ConsentFlowRecord(
    entry = entry,
    events = events,
    elapsedMs = { started.elapsedNow().inWholeMilliseconds },
    answerNow = ::readOutcome,
)
```

- timeout coroutine: `decideOnce(readOutcome())` → `record.waitRanOut()` (keep `syncConsentToFirebase` and
  `finishOnce("timeout")` as they are);
- `requestConsentInfoUpdate` error: `decideOnce(ConsentOutcome.ERROR, errorCode)` → `record.refused(errorCode)`;
- form callback: the `if/else` of `decideOnce` → `record.formClosed(errorCode.takeIf { it != UmpBridge.NO_ERROR })`;
- `presenting the form threw` and `ensureConsent threw`: `decideOnce(ConsentOutcome.ERROR)` → `record.refused(null)`;
- `showPrivacyOptions` needs no change (no wait there, so `timed_out` stays absent).

The `promptBusy` path writes no decision today and still writes none.

## Proof

- Red first, production change only. `ConsentFlowRecordTest` against a faithful extraction of the old timeout
  handling: 5 of 6 fail, the key one `expected:<GRANTED> but was:<DISMISSED>`. `EveryPaymentWrittenIsReportedTest` on
  the unfixed tree: 2 of 3 fail, naming the three silent files and `EditInvoiceViewModel` as a second sender.
- `testDebugUnitTest` **1295/1295** = the 1283 baseline + 6 `ConsentFlowRecordTest` + 3 `PaymentAddedTest` + 3
  `EveryPaymentWrittenIsReportedTest`; nothing removed. iOS compile of `core:ads`, `core:analytics`,
  `feature:paymentForm`, `feature:document:invoice` green.
- **Not verified on a device.** Owed after merge, on a debug build: record a payment on each of the three screens and
  read both gateway log channels (§2.2) — expect exactly one `payment_added` per payment entered (one per receipt on
  the Payments screen) and none for a payment added and then discarded with its invoice.
