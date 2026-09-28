# 0183 — The Screen Map measures the tour, dead taps and ad clicks, and holds 20 % of new users out of the tour

**Status:** decided by the owner (Screen Map review, 2026-09-28/29); app side built on
`feat/screen-map-app-signals` off `VC_113_VN_149` (`cb014bb8`, `05f88f46`, `74085f25`), **not merged, not released**.

## Why

The Screen Map (`kaam/screen-map/screen-map-mockup.html`) draws Create Invoice with every control's
share of visits. Four things could not be drawn from the data we had:

1. **Which rows happened under the tour.** The tour (the onboarding overlay) lives only on Create
   Invoice and ends with the first item. Nothing on an event said whether it was up, so "tour" and
   "normal" visits had to be told apart by guessing from `invoice_overlay_clicked`.
2. **Whether the tour helps at all.** Every new user gets it, so there is nothing to compare with.
3. **Taps that nothing took.** The logo box on Create Invoice looks editable and is not. A tap there
   left no row.
4. **Ad clicks.** No format reported one, so a user who left from an ad could not be told from one who
   left on their own.

Plus one naming gap: the Payment Method card reported under `tap:create_inv_scr:card`, the fallback
every unnamed `InvotickCard` shares (AGENTS-EVENTS §1.4).

## Decided

1. **`screen_mode`**, a parameter stamped by the gateway on every event while Create Invoice (and its
   sheets) is on screen: `tour_business | tour_client | tour_items | none`. Absent = the screen is not
   showing, or its draft has not loaded (§1.7). Resumed only: an ad's own screen pauses Create Invoice,
   so ad events are never stamped with it. Edit Invoice (same composable) never stamps it.
   - **The end of the tour is observable without a new event.** The tour ends only with the first
     line item, and `Item_added` (`source=create_invoice`) is reported before the screen redraws, so
     the row that ends the tour is `Item_added` with `screen_mode=tour_items`. Any other end (an
     account's first-invoice flag arriving from another phone) is the first `none` after a `tour_*`
     with no such `Item_added` between them. An event was not added: nothing is pressed at that moment
     that `Item_added` does not already carry (§1.1).
2. **Overlay A/B test.** A NEW install is dealt `on` or `off` once, deterministically from its device id
   (FNV-1a over the salted id → bucket 0–99; `off` when bucket < share). Remote Config
   **`onboarding_overlay_holdout_percent`**, read as a **string** (a missing number reads 0 on the SDK,
   and 0 is this key's kill switch): blank/absent → the owner's **20**; not a whole number 0–100 → 20;
   **`0` → everybody gets the tour**. The stored arm never flips, whatever the key says later.
   - **Who is new:** the splash marks an install eligible only on its first open *and* only when it
     sends that person to Create Invoice (no invoice yet); the arm is dealt after the splash's ad gate,
     before navigating, and only if `hasMadeADocument` is false. An update from an older build is never
     a first open, so **existing users are never assigned**.
   - **`overlay_variant=on|off`** is stamped on every event of an assigned install (so
     `create_inv_scr`'s screen view, `invoice_created_success` and `invoice_shared_success` carry it),
     and **`onboarding_overlay_assigned`** (coded, once per install: `overlay_variant`, `bucket`,
     `holdout_percent`, `percent_source=remote|missing|invalid`) records the moment.
   - `off` sees Create Invoice without the tour: no spotlight, no step tooltips, no step celebrations.
     Nothing else changes; the Save nudge and the first-invoice celebration follow their own rules.
3. **`dead_tap`**, one **auto-channel** event (the denylist can switch it off) for a tap no control
   took: `cell` (`c<col>r<row>` on a 6 × 12 grid of the window, never finer), `scroll_bucket` (quarter
   window heights scrolled, 0–12, only where the screen registers its scroll — Create Invoice does),
   `layer` (`screen|sheet|dialog`), `taps` (one event per burst in one cell, ≤ 1.5 s between taps),
   `window_class` (`compact|medium|expanded`). No coordinates, text or screenshots. A passive observer:
   it never consumes or delays a touch.
4. **`ad_clicked`**, coded, from the SDK's own click callback on every format: `type`, `placement`,
   `ad_request_id`, and `path` on app-open. No change to any ad.
5. **`create_inv_payment_method_click`** is the Payment Method card's own id.

## Rejected

- **A `tour_ended` event.** The first item already carries the end (`Item_added` + `screen_mode`).
- **Assigning at Create Invoice's first composition.** The first `create_inv_scr` screen view is sent
  before the screen composes, so it would never carry the arm.
- **Assigning on the splash itself.** Remote Config may not have landed yet; after the ad gate it has
  had the longest time to, which is what makes `0` a kill switch in practice.
- **`String.hashCode()` for the bucket.** Not promised across platforms; FNV-1a is pinned by a test.
- **Reading the holdout as a number.** Missing reads 0, which would hold nobody out *and* look like a
  deliberate kill.
- **Stamping `overlay_variant` on the three named events only.** Every event is the same cost and lets
  any funnel split by arm (the shape of `ui_mode`).

## Costs to measure, stated

- **Banner impressions rise for `off` users on Create Invoice.** The banner is hidden while the tour's
  overlay is up (owner, 2026-09-04); with no overlay it shows from the first frame. Read banner
  impressions on `invoice_screen` by arm beside the G1 rate.
- **`dead_tap` volume is unknown until it ships**; the denylist is its switch.
- A tap on a sheet that is still animating closed is a `dead_tap` in that sheet (`layer=sheet`): nothing took it.
  Fast testers make more of these than users will.

## History splits

- The Payment Method card: `tap:create_inv_scr:card` (and `tap:<edit screen>:card` in Edit Invoice)
  until this build; `create_inv_payment_method_click` after, in both modes (the Terms card's shape).
  Any query for the card spanning the release reads both names.

## Verified (debug build, iPhone 17 Pro Simulator, 2026-09-29)

No Android emulator or phone was reachable, so the device run is iOS; Android is covered by the unit suite and a
Compose UI test on the JVM. Each row below arrived exactly once where it should.

- Fresh install → splash (`splash_ready destination=directly_to_create_invoice`, `is_first_open=true`) → app-open ad
  → `onboarding_overlay_assigned` (`overlay_variant=on`, `bucket=55`, `holdout_percent=20`, `percent_source=missing` —
  the key is not in the console yet) → `screen_view create_inv_scr` carrying `overlay_variant=on`. A second launch
  re-stamped `on` from storage and dealt nothing.
- `screen_mode`: `tour_business` → `tour_client` → `tour_items` on the tour's own taps; `Item_added` carried
  `tour_items`; the next rows `none`; absent on the Invoice Created screen.
- `ad_clicked` once for each format, joined by `ad_request_id` to its `ad_shown` / `ad_impression_value`: app-open
  (`path=splash`), banner (`placement=invoice_screen`), interstitial.
- `invoice_created_success` and `invoice_shared_success` (`target=…CopyToPasteboard`) carried `overlay_variant=on`.
- `dead_tap` on sheets (`layer=sheet`, the sheet's screen), on Create Invoice (`layer=screen`, `scroll_bucket` 0 and
  2), none for control taps, the tour's overlay (`invoice_overlay_clicked` instead), the banner or the WebView.
- `create_inv_payment_method_click` for the Payment Method card; no `tap:create_inv_scr:card`.
- The `off` arm was not seen on a device: this Simulator's id deals bucket 55. It is covered by
  `OverlayHoldoutTest` / `OnboardingOverlayAssignerTest` and the pure `showsOnboardingTour` rule.
