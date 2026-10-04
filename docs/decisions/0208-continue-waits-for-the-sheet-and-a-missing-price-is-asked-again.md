# 0208 — Continue waits for the purchase sheet, a missing price is asked again, and the paywall says what it had

**Date:** 2026-10-05
**Status:** **Built** on app branches off `release/1.5.1` (`4ffe740c7`), stacked:
`fix/paywall-continue-stays-busy` (`7e626df3c`) → `fix/billing-prices-retry` (`6a7bdd2de`) →
`feat/paywall-measures-plans-and-declines` (`672d800cf`).
**Not merged, not released.** The backend needs nothing: `params` is stored whole, and a coded event ignores the
denylist.
**Tier 1** (the purchase flow) and **Tier 3** (analytics). No price, product, offer, Remote Config value or paywall
sentence changed. Owned by the billing agent (`.claude/agents/billing.md`); the events follow `AGENTS-EVENTS.md` §1.36.
**Related:** 0024 (a double tap is stopped at the button), 0070 (a plan with no offer is not launched), 0112 (the
paywall is never a dead end), 0155 (`premium_purchase_result`, the paywall's `entry`), 0199 (the tap gate reads the
finger's time).

## What the data said (billing diagnosis, production + source at `780a48b26`, 2026-10-04)

**A. A second press read as a failed purchase, and swallowed the first press's answer.**
- Play's `launchBillingFlow` returns as soon as it has asked for the purchase sheet. The paywall freed its button right
  then (`PremiumViewModel`: `isLoading = false` after the launch returned).
- On a slow phone the sheet appears about a second later. A second press 0.9–1.2 s after the first found no screen of
  ours (Play's own transparent screen had taken it) and answered **"Purchase failed (-1). Please try again."**
- That press also took over the open attempt, so the **first** press's real answer was never reported.
- **3 phones in 8 days**, `premium_purchase_result` `reason=no_screen`. `app_open_decision`'s `excursion_return` proves
  the sheet did open. A purchase made on that sheet was still granted (`handlePurchase`): nobody lost money, but the
  user was told they had failed while the sheet was coming up.

**B. A failed price lookup was never asked again.**
- Android asked Play for prices once per billing connection; the paywall's retry (`reloadProducts`) did nothing on
  Android.
- A lookup that priced some plans and not the chosen one still said "Continue" (the button only checked that *some*
  plan had loaded). The chosen plan showed a dash, and Continue answered "Purchase failed" (`plans_not_loaded`, a
  phone in Zimbabwe).
- iOS had the retry line, but a partial App Store answer was never asked again either.

**C. What we could not see.**
- The paywall's `screen_view` did not say whether its plans had loaded when the user arrived.
- `premium_purchase_result` cannot tell "payment declined, not enough money" from "user cancelled". **27 of 27 Google
  sheets that opened ended cancelled**, and we cannot tell a price problem from a missing payment method. Billing 8+
  gives a sub-response code for exactly this, and we dropped it.

## Decided

### 1. One press at a time; the button waits for the sheet

- **The press stays busy from Continue until the store answers, or until the app is back on screen after the sheet.**
  Not a timer: the phone's speed is not ours to guess.
- **A press while an attempt is open is ignored** — no store call, no message, no second attempt, no row (a
  suppressed press is silent, §1.9a). It can never replace the first press, so the first press's answer is always
  the one reported.
- **One shared rule, `PurchaseAttemptGate`** (`domain/billing`), used by Play and StoreKit alike. On Android, our own
  screen pausing marks the sheet covering the app and our screen resuming marks the return; Play's own transparent
  screens (`com.android.billingclient.*`) are not counted as either.
- **The one way an attempt can end without an answer:** the app has been back from the sheet for **10 s** with nothing
  from Play, and the user presses again. The old attempt is then reported as the new outcome **`no_result`** — never
  as a failure, because nobody said no — and the new press opens. Without it, a Play that never answers would leave
  the purchase button dead until the app is closed.
- **An exception from Play's launch** (Billing 8+ throws on a malformed request) now ends that press as
  `launch_failed`, where it used to end the app.

### 2. A missing price is asked again; Continue only for a priced plan

- **`PlanLookup`** (`core/premium`, shared by Play and StoreKit): asked at once, then after **2, 5, 15 and 30 s** until
  every plan has a price. Bounded: five asks per start.
- **Every paywall opening, and the existing retry line, asks again at once** and starts the schedule over. A new
  billing connection asks afresh. An ask already out is never doubled.
- **A plan priced once keeps its price**; a later, worse answer never blanks it.
- **On Android, a lookup made while billing is still connecting waits up to 5 s for the connection** rather than
  answering "no plans" at once; a paywall opened after this launch gave up connecting starts a new connection.
- **While the last answer leaves the chosen plan unpriced, the paywall shows its existing retry line** ("Plans aren't
  available right now. Tap to try again."). While asking, "Checking plans…". **Continue is offered only for a plan the
  store has priced.** A priced plan can be bought while another is still missing.

### 3. Measurement — parameters on existing events, no new name

| Event | Parameter | Values | Absent means |
|:--|:--|:--|:--|
| `screen_view` for `premium_scr` | `plans` | `loaded` (every plan priced) · `partial` · `none` — what the paywall had when it opened | not a store that reports (desktop) |
| | `plans_ms` | how long the last price lookup took, from ask to answer (good or failed), in ms | no lookup has finished in this run |
| `premium_purchase_result` | `outcome` | adds **`no_result`** (above) | — |
| | `sub_response_code` | Play's `OnPurchasesUpdatedSubResponseCode`, as text | the answer did not come through Play's purchase listener (our own checks, the launch's return, the acknowledgement, the server; and every iOS row) |
| | `sub_response` | Play's word for it: `not_applicable` (0) · `insufficient_funds` (1) · `user_ineligible` (2) · `unknown_<n>` | as `sub_response_code` |

- **`plans_ms` with `plans=none` says the store was asked and failed**; `plans=none` without it says the first ask was
  still out. Read `plans` and `plans_ms` together.
- **The integer and the word ride together** (§1.15): `sub_response_code` is the ground truth, `sub_response` is the
  table that integer belongs to. An unknown code keeps its number.
- **A decline stays an outcome Play named.** `outcome` is still Play's response code's word (a decline arrives as
  `failed` or `user_cancelled`, whichever Play said); the sub-response sits beside it and is never folded into it.

## Rejected

- **A fixed busy time after the press** (say 3 s). A guess at the phone's speed; too short on the slowest phones,
  needlessly long on fast ones.
- **A longer tap-gate window** (0199's 400 ms). The gap here is 0.9–1.2 s and is not a bounce; a gate long enough would
  eat genuine presses everywhere else.
- **Letting the second press replace the first** (the old behaviour). It loses the only answer that was real.
- **An event for the ignored press.** A suppressed press is silent (§1.9a).
- **Retrying prices on a timer for ever.** Unbounded traffic to Play from every phone that cannot reach it. Bounded
  retries plus every paywall opening cover the user who is looking.
- **Hiding a plan card that has no price.** It changes what the paywall shows and claims — the owner's decision, not a
  fix. The dash stays; only the button changes.
- **`plans_ms` as "time since the paywall opened until prices arrived".** Unknowable at the moment the screen event is
  sent.
- **A new outcome `declined` derived from the sub-response.** It would translate one vendor's code into our verdict
  (§1.14, §1.15).
- **A Remote Config kill switch for these fixes.** The brief excluded Remote Config changes, and "off" would bring back
  a false "Purchase failed". Rolling back is the release. *Open for the owner below.*

## Open — the owner's

1. Should these fixes carry a kill switch anyway (PROJECT_RULES universal rule 1)? Recommendation: no — off is the bug.
2. After 1.5.1 has been out a week: read `sub_response` on `user_cancelled` and `failed`. If `insufficient_funds` is
   common in some countries, that is a price question for the owner, never a finding (`monetisation-measure-never-assume`).
