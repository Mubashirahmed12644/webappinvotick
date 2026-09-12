# 0070 — A confirmed grant stays confirmed; a refusal counts only when the server names it Google's

**Status:** decided (the owner's go, 2026-09-12: "pending work start kro apni tarteeb sy", on the
recommended fixes). The app half is merged into `VC_102_VN_146` for 1.4.6 (`b9669f53`). The server half is
built on `invotick-apis` `fix/purchase-refusal-names-itself` (`0de08c7`, `26913d8`), not deployed · **Date:** 2026-09-13 · **Goals:** G3 (trust), monetisation ·
**Related:** [0047](0047-plays-answer-decides-premium-on-a-device.md),
[0048](0048-the-paywall-says-what-google-charges.md)

## What happened

Checking 1.4.5 for the first paying customer on 2026-09-12 found that it breaks 0048 #4 in one path
(billing.md, Known gaps #1):

- A restore that got no answer marked the purchase **unconfirmed**, even when our server had confirmed
  it before.
- A later register failure was read as **Google's refusal** unless it was a 503. A 401, the error
  handler's 400 and a 500 all counted, and a refusal takes back an unconfirmed grant.
- Premium then stayed off — and the ads came back — until some later register succeeded.

The server cannot be told apart today. Its 401s (`JwtAuthenticationFilter`, the entry point), the
error handler's 400s (`No user for …`, a body it cannot read) and its 500s all send the same
`{success: false, message, data: null}` as Google's refusal. Only the sentence differs, and 0048
already rejected reading sentences.

## Decision

1. **Only a grant that was never confirmed may be marked unconfirmed.** A grant the server confirmed
   stays confirmed through any number of unanswered calls, so no refusal can take it back (0048 #4).
2. **A register refusal is final only when the server names it:** HTTP 400 with `code: "NOT_VALID"`.
   Everything else is "could not ask" and premium stands on Play's word:
   - `UNVERIFIED` (503);
   - a 401;
   - the error handler's 400;
   - a 500;
   - a body the app cannot read.
3. **A restore's `NOT_VALID` is Google's refusal.** The app acts on it without registering.
4. **Billing calls send `X-Device-Id`**, as sync does, so the server's one row per purchase, account and
   device (0048 #6) has its device.
5. **The paywall prints no blank price.**
   - A one-time product is priced from its one-time offer. When Play sends none (Billing 8+ products
     with several purchase options), it is priced from the cheapest listed offer, and the purchase buys
     that same offer.
   - A plan Play sent no offer for keeps the dash and is not launched.
   - A subscription with no offer is no longer launched with an empty offer token, which Billing 8+
     rejects by throwing.

## The server half (for the lead)

`EntitlementController.purchase` answers a refusal with a body carrying `code`:
- `NOT_VALID` when `e.definitive`;
- `UNVERIFIED` otherwise.

These are the words the restore answer already uses. Built as `0de08c7` and `26913d8`:
- **The statuses stay 400 / 503.** Every installed build acts on the status. Turning the 503 into a 400
  would make 1.4.5 take back grants it holds on Play's word whenever we cannot reach Google.
- **Old builds are unaffected.** Every build since billing began ignores unknown JSON fields (app
  `161a9d10`), so the added `code` changes nothing for 1.4.4 or 1.4.5, and the deploy can go in any
  order.
- **A restore's second ask no longer escapes as a 500.** This is the ask for a purchase new to the
  server. It now answers the same named outcome.

Until it ships, 1.4.6 reads Google's register refusal as "could not ask". A faked purchase then holds
premium on Play's word until the next launch, whose restore says `NOT_VALID` and takes it back.

## Rejected

- **Reading the refusal from its message.** Rejected in 0048 already. There are four different
  sentences today, and any of them can change.
- **Every 400 is Google's.** The error handler's 400 is ours.
- **`code` on the app's shared `ApiResponse`.** That puts a billing word on every endpoint's envelope.
  A billing-only response type is used instead.
- **Registering after a restore said `NOT_VALID`.** Under rule 2 the register would read today's
  unnamed 400 as "could not ask", and hand premium to a faked purchase.
- **Asking the restore again after an unclear register 400.** It costs a second round trip, for a case
  the server can simply name.
- **Hiding a plan Play sent no price for.** That weakens the paywall; a dash is honest.
- **Changing the statuses** (a new status for our own errors, or 503 → 400). It is a behaviour change for
  every installed build.
- **`code` on the backend's shared `ApiResponse`.** That puts it on every endpoint's envelope. A billing-only
  `PurchaseRefusal` is used instead.

## Consequences

- Apps up to 1.4.5 keep reading a 401, a 400 or a 500 as a refusal until they update.
- **Lifetime depends on the server setting.** While `GOOGLE_PLAY_LIFETIME_PRODUCTS` is empty (Known
  gaps #2), a Lifetime buyer on 1.4.6 gets premium on Play's word at purchase:
  - the buyer loses it at the next launch, when the restore says `NOT_VALID`;
  - once the server names its refusals, they lose it at once.

  Only the setting gives them premium.
- The first customer's exact path is a test: `FirstCustomerStaysPremiumTest` (data).
