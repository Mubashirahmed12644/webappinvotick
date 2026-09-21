# 0155 — The paywall names its door, and each Continue names its result

**Date:** 2026-09-22
**Status:** **Built** for **1.4.9**. App `VC_108_VN_149` `630bba25`, pushed. **Nothing released, nothing deployed.**
The backend needs nothing: `params` is stored whole, and a coded event ignores the denylist.
**Tier 3** (analytics). The purchase flow is Tier 1, and **no purchase behaviour changed**: the only new read is
`launchBillingFlow`'s return value, and it is read only to report it.
Owned by the user-journey agent. The billing rules (`.claude/agents/billing.md`) apply to the code this touches.
**Related:** 0023 (one event, the variation is a parameter), 0061 (a failed show names who refused), 0064 (a coded
event where nothing is pressed), 0112 (StoreKit 2 on iOS), 0151 (the preview footer ×).

## What the data said (production, 30 days to 2026-09-22, release builds, test phones excluded)

| Door (tap in the 10 s before `premium_scr`) | Views / phones | Continue pressed (phones) | Bought |
|:--|--:|--:|--:|
| Save ad dialog (`ad_dailog_premium_click`) | 325 / 287 | 46 (16%) | 1 (AU, annual) |
| Invoice-list crown (`tap:dashboard:InvoiceListScreen.go_premium_4`) | 404 / 275 | 17 (6%) | 1 (MV, monthly) |
| Drawer (`tap:?:NavigationDrawerContent.go_premium_1`) | 115 / 86 | 8 (9%) | 1 (ET, annual) |
| **All** | **847 / 555** | **70** | **3** |

- **67 of the 70 phones that pressed Continue had no recorded result.** Nothing records whether the purchase sheet
  opened, or whether the purchase was cancelled, declined, pending or refused by our server.
- **The door could only be reconstructed.** `prev_screen` (1.4.6+) says `dashboard` for both the crown and the
  drawer. One coded tap covers the ad dialog on the invoice screen (Save) and on the saved-invoice screen (Share).
- Continue is the auto tap `tap:premium_scr:PremiumPaywallSheet.checking_plans_6`. Its label comes from the
  "Checking plans…" text. It is a stable identity and is **not** renamed (§1.8).

## Decided (the owner, 2026-09-22, both proposals for 1.4.9)

### (b) `entry` on `premium_scr`'s `screen_view`

- Values: `save_ad_dialog | share_ad_dialog | invoice_list | drawer | preview_footer`.
  - `share_ad_dialog` is the ad dialog before sharing, on the saved-invoice screen. It is a different place from Save,
    and today they share one tap.
  - `preview_footer` is 0151's ×. It shows on three screens, and the event's `prev_screen` says which one.
- **A parameter on the existing screen event, never a new event** (§1.1, §1.2).
- **The press says which door it is.** `onRequestPremium` carries a `PaywallEntry` (domain) from the button that
  opened the paywall. `AppViewModel` holds it beside `showPremiumPaywall`. The sheet passes it to the gateway's new
  `trackScreen(name, params)`.
  - The gateway adds those parameters first and its own stamps after them, so a caller can never replace
    `build_type`, `prev_screen` or `prev_screen_ms`.
- A paywall opened some other way sends no `entry`. Absent means unknown (§1.7). Codes are stable identities: a new
  door is a new value, never a renamed one.

### (a) Coded `premium_purchase_result`

| Parameter | Values | When |
|:--|:--|:--|
| `outcome` | `success`, `user_cancelled`, `failed`, `pending`, `already_owned`, `launch_failed` | always |
| `plan` | the product id: `yearly_subscription`, `monthly_subscription`, `life_time_purchase` | always |
| `response_code` | Play's `BillingResponseCode`, as text | only where Play gave one |
| `failed_at` | `store`, `acknowledge`, `server` | only on `failed` |
| `reason` | `no_store`, `no_screen`, `plans_not_loaded`, `no_offer` | only on `launch_failed` from our own check, before any store sheet |

- **Coded, because nothing is pressed when the store answers** (0064's reasoning). A coded event always sends and is
  never denylisted.
- **One press, one result.**
  - Android holds the open attempt and takes it exactly once. Play can report a refusal both as `launchBillingFlow`'s
    return value and through the listener, and it is sent once.
  - A restore, a launch's look at what is already owned, or a pending purchase that completes later is not an attempt
    and sends nothing.
- **`success`** means the store took the money. It includes a purchase our server could not be asked about, because
  premium stands on the store's word (0070).
  - A purchase the server refused after the store said paid is `failed` with `failed_at=server`. That is a G3 case:
    Google took the money and we said no.
- **`plan` is the product id, the same text as `purchase_identity.product_id`**, so a result joins the server's
  record directly.
- **iOS:** StoreKit 2 is real, not a stub (0112). `AppStoreBillingRepository` reports from the same shared types.
  - Apple gives no response code, so `response_code` is absent on iOS.
  - StoreKit's failure text is a sentence, not a code (§1.14), so it stays out of the event.
  - `already_owned` does not occur on iOS.
- **Collected at the app root** (`App.kt`), not in the paywall, so a result that arrives after the sheet has closed is
  still sent.

**Added beyond the three approved parameters:** `failed_at` and `reason`. Each is absent except on the outcome it
explains. Without them:
- a card decline, a failed acknowledgement and our server refusing a paid purchase would all read as one `failed`;
- "the plans had not loaded" would read the same as Play refusing to open its sheet.

The coordinator can drop them before release. Nothing else depends on them.

## Rejected

- **`entry` from `prev_screen` or the preceding tap.** `prev_screen` cannot separate crown from drawer, the tap
  cannot separate Save from Share, and the 10-second pairing is inference, not a record.
- **A new event per door, or `premium_scr_<door>` screen names.** That is one screen as several events (§1.2).
- **Five events, one per outcome** (`purchase_success`, `purchase_cancelled`, …). One action, one event, and the
  variation is a parameter (0023).
- **Reporting from `PremiumViewModel.purchaseState`.**
  - It is a `StateFlow`, so two equal errors in a row collapse into one.
  - It is also set by restore, so a restore would read as a purchase.
  - It has no response code for a cancel, and it cannot tell our own refusal (`-1`) from a server refusal (also `-1`).
- **Emitting from inside the paywall's composable.** A result that arrives after the sheet closes would be lost.
- **`entry` on `premium_purchase_result` as well.** It is not approved, and the result joins its paywall view through
  the session and `event_timestamp`. It is worth adding only if that join proves unreliable.
- **Renaming `checking_plans_6`.** Auto-captured ids are identities.

## Verification

- `testDebugUnitTest` **1,061/1,061**, `jvmTest` **196/196**, `iosSimulatorArm64Test` **136/136**.
  - New tests: `PurchaseResultEventTest` (names, codes, what is absent), `AppStorePurchaseAttemptsTest` (each StoreKit
    answer gives one result; a server refusal is `failed_at=server`; no store is `reason=no_store`; launch and Restore
    send nothing), and the gateway test that `entry` rides on `screen_view` without replacing the gateway's stamps.
  - The App Store attempt test is red with the report removed (2 of 4).
  - `APushTokenFollowsTheSignedInAccountTest` timed out once in the first full run, and passed on the rerun. That code
    is untouched here.
- `:composeApp:assembleDebug` and `:composeApp:compileKotlinIosSimulatorArm64` pass.
- **Not yet verified on a device** (§2.3: compiling is not verifying). The debug-build check, with counts from both
  gateway log channels, is owed before 1.4.9 goes wide: one paywall per door, one cancel, one test purchase.
  - After release, count first (§2.1): `screen_view` rows for `premium_scr` with `entry` present on
    `app_version_code >= 110`, and `premium_purchase_result` by `outcome`.
- The Android purchase listener paths (`onPurchasesUpdated`, the acknowledgement) have no unit test. Play's
  `BillingClient` is not reachable from shared tests, and the mapping they call (`PlayResponseCode`) is tested.

## Known gaps, left open

- A `pending` purchase that completes later sends no second result. Its completion is visible only in `entitlement`.
- `premium_scr_close.method` was `swipe` on all 582 rows in 30 days, and never `scrim_or_back`. This is not proven
  to be a defect, and it is not changed here.
- `9caef5a2` and `5144be8f` made the short test purchases in `entitlement`. Whether they are the owner's phones is
  the coordinator's open question to the owner.
