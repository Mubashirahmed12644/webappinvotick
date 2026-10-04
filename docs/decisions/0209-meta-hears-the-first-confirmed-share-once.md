# 0209 — Meta hears the first confirmed invoice share, once per install, and nothing else about it

- **Date:** 2026-10-05
- **Status:** decided — built on `feat/meta-first-invoice-shared` (app repo, off `release/1.5.1`), rides **1.5.1**, not released
- **Decision:** The Android app tells Meta **one** app event, `first_invoice_shared`, the first time a device's user completes
  a **confirmed** invoice share (the OS chooser pick — the same moment as `invoice_shared_success`, decision
  [0006](0006-g1-real-invoice-metric.md)), then never again on that install. No parameters, no amounts, no invoice data.
- **Why (owner's words, 2026-10-05):** Meta can only optimise for what it hears. Today it hears installs, activations, ad
  impressions with value and purchases — **nothing for G1**. G1 (a share within days of install) is ~200 a week, which is
  enough volume for Meta to learn on (Ad A ~150-200/week); premium purchases are 0-2 a week and cannot be optimised for
  (research `report-3-optimise-for-premium.md`, route (a): cheapest, one release, existing consent gate, no new data category).
- **This is a Meta SDK event, not one of ours.** It is **not** a new `analytics_events` name and there is **no coded twin**
  of `invoice_shared_success` in our own pipeline (AGENTS-EVENTS.md: one action, one event). Our pipeline already counts
  the share; this only forwards the *fact* to a partner, through the same shape as `MetaPurchaseReporter`.

## The design

| Question | Answer |
|---|---|
| Moment | `ConfirmedInvoiceShares.events` (core/common) — already emitted beside `invoice_shared_success`, only on a confirmed pick. Opening the chooser, or cancelling it, emits nothing. |
| Once | A flag in the app's own preferences (`meta_first_share`), written **on the first confirmed share a release build sees**, whatever the gates then say. It survives restarts, is per phone (never per account), so login, sign-up, guest merge and account switch cannot repeat it. Cleared only by clearing app data / reinstall — a new install is a new install, which is what Meta's attribution counts. |
| Why the flag is spent even when the send is blocked | The event is named *first*. A user who refused consent, then consents and shares a fifth invoice, must not be reported as a first share. Likewise a kill switch pulled at the time. |
| Existing users | Without a rule, every user who updates and shares again would fire a "first" share. At the first launch of a build that carries this feature the flag is **pre-spent** when the install is more than 7 days old (`firstInstallTime`). Meta's window is 1 day (89 % of G1 happens within a day) and G1 itself is "within 7 days". Installs 7 days or younger keep it: Meta never heard their first share, so reporting it, slightly late, is true. |
| Consent | The same gate as the other reporters: `MetaSharing.mayShare()` — outside EEA/UK on; EEA/UK only with a consent that names Meta (Google Additional Consent id 89) and TCF purposes 1, 3, 4, 7; kill switch of the consent layer steps aside as before. Unchanged; nothing new to consent to, because no new data goes out — only a new *name* for an app event Meta already receives under the same consent. |
| Build | Only the Play release (not debuggable **and** package `invotick.invoicemaker`) — `MetaSharing.isReleaseBuild`. Debug, benchmark and non-minified builds log `[Meta] first_invoice_shared NOT sent (not a release build)` and send nothing; the Facebook SDK is not even started in debug (`src/debug/AndroidManifest.xml`). The debug flag is not spent, so the wiring can be re-tested. The existing debug protections are used as they are; nothing is widened. |
| Platform | Android only. There is no Meta SDK in the iOS app; an iOS twin would need the SDK, an ATT decision and an App Store privacy change — out of scope. |
| Kill switch | Remote Config **`meta_first_share_enabled`**, String parameter, default `true`, read as text (`false`/`0`/`off`/`no` turn it off; absent, empty or unreadable keep it on) — the shape of `own_footer_enabled`, `legacy_guest_move_enabled` and `store_nothing_watch_enabled`. Off: nothing is sent and the flag is still spent (see above). Pull it only if Meta's count looks wrong. |
| Threading | Handed to a single background thread like the other reporters; every send is wrapped — analytics may not crash the app. |
| PII | None. No advertising id handling of our own (the SDK's, under the existing consent), no user id, no invoice id, no amount, no currency, no parameters. |

## The event name

Chosen: the **custom** event `first_invoice_shared`.

- **Standard alternative considered:** `fb_mobile_achievement_unlocked` ("Achieve"). Standard events are the ones Meta's own
  pickers are built around, so they are the surest to appear in the "conversion event" list without any setup.
  `fb_mobile_complete_registration` is rejected outright: a share is not a registration, and a sentence that is not true
  at the place it is read is exactly what the owner's no-false-claim rule forbids — in Events Manager as much as on a screen.
- **Why custom anyway:** the name says what happened, so the number in Events Manager can be read without a legend. `Achieve`
  would be a generic bucket that any later feature could silently share. Meta's documentation allows optimising a campaign
  for a custom app event once Meta has received it (it must be received before it can be chosen), so the default stands.
- **What is not proven:** whether the custom event shows in the *owner's* app-campaign picker was not testable before a
  build with it is live. If it does not, the fallback is a one-constant change to `fb_mobile_achievement_unlocked`
  (still one event, no parameter change) in the next release. The owner's check is in the section below.

## Owner's actions once a build carrying it is live (Meta Events Manager)

1. Wait for the first real event: Events Manager -> the app's data source -> **Test Events / Overview**; `first_invoice_shared`
   appears after the first confirmed share from a Play-release phone outside the EEA (or with consent).
2. Once it appears, mark it as an **event used in ads** if Meta offers that switch, then in Ads Manager create/duplicate **one**
   ad set on Ad A and choose it as the **conversion event**.
3. Compare cost per G1 **and** ad revenue per install against the install-optimised set (research path step 4). Ad B untouched.

## Rejected

- **A Conversions API event from our backend** (route b): 6-9 days, needs the advertising id sent to our server (a new
  privacy flow) and a token that earlier attempts could not obtain.
- **An MMP** (route c): vendor, cost, new data processor — not now.
- **A coded `invoice_shared_success` twin in `analytics_events`:** forbidden by AGENTS-EVENTS (one action one event).
- **Sending the event on every confirmed share:** would make G1 a count of shares, not of people who reached it, and
  flood Meta's learning with repeats from a few heavy users.
- **Not spending the flag when blocked:** makes "first" false later (see above).
- **Counting the user's earlier shares from the database:** per-account Room files and an async mark-as-sent path make it
  slow and fragile; the install-age rule is one read and honest about what it is.
- **A second Meta app for debug:** better in principle (research report), but a separate task; this change adds no debug leak.

## Consequences

- One new reporter in the app (`MetaFirstShareReporter`, androidMain/ads) and one new Remote Config switch
  (`meta_first_share_enabled`, documented in `RemoteConfigKeys`).
- **Parameters absent on purpose:** if Meta later wants a value, that is a new decision, not an edit here.
- Meta Events Manager will show a number that is *this device's first share since the build*, not total G1 — the admin
  panel's funnel (our own pipeline) stays the source of truth for G1. Expect Meta's figure to be a little lower: EEA users
  without consent, installs older than 7 days at the update, and the kill switch are all deliberately silent.
- Privacy policy / Data Safety: no new category. Meta already receives app activity under the same consent; confirm the
  Play Data Safety wording about "app interactions shared with third parties" already covers it before release (owner's
  existing declaration for AdImpression/Purchase covers app activity).
