# 0062 — A request whose screen closed is not a failed open

- **Date:** 2026-09-12
- **Status:** decided (owner, 2026-09-12, on the user-journey agent's recommendation); built for 1.4.6
  on `invoice-kmp-app` `feat/146-journey-instrumentation`, not merged.
- **Decision:** `SharedInvoiceRepositoryImpl.getPublic` and `decide` let a `CancellationException`
  travel up instead of handing it back as `Result.failure`. `shared_invoice_open_failed` and
  `shared_invoice_decision_failed` stop carrying `exception_CancellationException`.

## Why

The first `shared_invoice_open_failed.reason` values on 1.4.5 were `exception_CancellationException`
×2 and `revoked` ×1. Both cancellations were read event by event:

1. the sender confirmed a share (`invoice_shared_success`), then tapped their own link;
2. the app resumed, `received_invoice` was viewed, and `dashboard` replaced it **225 ms** and **316 ms**
   later;
3. the request still in flight was cancelled with its screen;
4. the repository's `catch (e: Exception)` caught that cancellation, and the screen reported it as a
   failed open 0.6–0.7 s after it had already gone.

The ratio of 138 failed opens to 70 opens (30 days to 2026-09-09) included this shape.

## Rejected

- **A `reason=cancelled` value.** A closed screen is not a link that failed to open, and the failure
  count would stay inflated. What happened is already recorded by the two screen views.
- **Filtering at query time only.** Every reader would have to remember, and the app would keep
  sending the noise.
- **A guard in the ViewModel only.** The repository is where the cancellation became a failure, and it
  did the same to `decide`.
- **Changing `createShareLink` and `getDeliveryStatuses` in the same change.**
  `invoice_share_link_fallback` counts `cancelled` on purpose (2026-09-10). That is a different
  decision, not reopened here.

## Consequences

- Builds up to 1.4.5 still send `exception_CancellationException`. A ratio that spans builds excludes
  that value or splits by version.
- Test: `SharedInvoiceCancellationIsNotAFailureTest` failed on the old repository (2 of 3 red, "was
  completed successfully with the result Failure(CancellationException)") and passes on the new one; its
  third case keeps a real failure a failure.
- **Open question, not a finding (G2):** in both cases a warm resume from a link replaced
  `received_invoice` with `dashboard` before the invoice loaded. These were the sender's own link. If a
  real receiver's warm open is replaced the same way, they never see the invoice. Unmeasured.
