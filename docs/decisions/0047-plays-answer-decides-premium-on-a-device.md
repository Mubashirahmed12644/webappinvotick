# 0047 — Play's answer decides premium on a device; only the ad's show waits for it

**Status:** decided, built (app 1.4.6, not yet released) · **Date:** 2026-09-11 · **Goals:** G3 (trust),
monetisation · **Related:** [0041](0041-premium-is-a-date-on-the-device-refreshed-daily.md) (planned —
the server half)

## What happened

The first premium customer (2026-09-10, annual, a guest in Australia) had premium and saw no ads. Reading
the code around him found three ways a paying user could still be shown ads:

1. **Restore on another account.** Our server binds each purchase to one Invotick account. When Play held
   a purchase bound to a different account — a guest who reinstalled, a user who signed out — the app
   granted *nothing*, so a customer who paid was shown ads on the very phone they paid on.
2. **The window after paying.** The premium flag was written only after the purchase was acknowledged
   *and* our server answered: two network round trips during which ads kept showing.
3. **Premium phones kept requesting ads.** Every app-open preload call site passed `isPremium = false`.
   Nothing was shown, but requests went out and `ad_request` / `ad_loaded` rows were written for paying
   users.

## The owner's rule, in his words

> "premium same device main chaye guest id ho yan login id ho usko play store ky premium status ki
> respect ko kerny pary gi … playstore ki premium checks ko verify kerna lazmi ho koe bhi non premium
> decision ky liye, but … user ko splash per wait ziyada naa kerna pery and non premium user ko first
> ads dikhany yani ky timely ad network ko request kerny main koe delay add na ho."

Play's answer decides premium on a device, guest or signed in. No ad is shown on the strength of "not
premium" until Play has confirmed it. The splash must not grow, and a free user's ad request must never
be delayed.

## Decision

- **Play's verdict is a first-class input.** `BillingRepository.storeVerdict` is one of `UNKNOWN`,
  `NONE_RECENTLY`, `ACTIVE`, `NONE`, `UNAVAILABLE` (`core/common/StoreVerdict.kt`):
  - `ACTIVE` the moment Play reports a purchased item, from a purchase or a restore — before the
    acknowledgement and before the server;
  - `NONE` when Play answers and holds nothing: premium off, and the time recorded;
  - `UNAVAILABLE` when the device has no Play billing at all, so nothing can have been bought through it;
  - a launch starts at `NONE_RECENTLY` when Play said "nothing" within the last 24 h, so a returning free
    user's first ad does not wait on Play.
- **One pure policy:** `adVerdictOf(savedFlag, storeVerdict)` → `PREMIUM` / `ALLOWED` / `UNVERIFIED`
  (`core/ads/AdEligibility.kt`, six tests). The saved flag alone is enough for premium; "not premium"
  needs Play. The app binds it once (`StoreAwareAdEligibility`), so `core/ads` still knows nothing about
  billing.
- **Requests never wait; only a show does, briefly.** Every gate requests unless `PREMIUM`. A show needs
  `ALLOWED`:
  - **splash** — waits for Play at most **1.5 s counted from the splash's start**. That overlaps the
    ad's own load, so in practice it adds nothing. Past it the ad is kept and the splash ends as
    `store_unverified`. If Play says premium while the ad is still loading, the splash ends there as
    `premium`;
  - **resume and landing** — no wait: `store_unverified`, and the ad is kept for the next resume;
  - **interstitial** — waits up to 1.5 s behind the spinner already on screen; without an answer the save
    goes ahead with no ad;
  - **banner** — keeps its slot and requests nothing until `ALLOWED`.
- **Another account's purchase makes this device premium.** The server binding does not move — the web
  and other platforms still read the purchase from its owner's account — so a purchase still cannot be
  handed between accounts. Only this phone, which Play says has paid, is premium. The paywall tells the
  user so: *"Premium is active on this phone. Your purchase is saved to Invotick ID …"*.
- **A server refusal brings the ads back and leaves the saved flag alone.** Google would not confirm the
  purchase → verdict `NONE`. The flag is not cleared, because a misbehaving server must not take premium
  from every paying user at their next launch.
- **Billing answers first.** The purchase query runs beside the price fetch instead of after it — a slow
  network price fetch used to hold up the answer the splash waits for. A transient setup failure is
  retried three times (2 s, 5 s, 15 s) instead of ending billing for the launch.

## Rejected

- **Grant only after the server confirms.** That is window 2: a paying customer shown ads while two
  round trips complete.
- **Wait for Play before requesting the ad.** The owner ruled out delaying a free user's ads, and a
  request is not a show.
- **Trust the saved flag alone.** It cannot tell "not premium" from "not known yet" — a fresh install, or
  another account's purchase.
- **Keep refusing another account's purchase.** Directly against the owner's rule. The protection against
  sharing lives in the server binding, which is unchanged.
- **Revoke the flag on a server refusal.** One server misconfiguration would take premium from every
  paying user at their next launch.
- **Hold the splash until Play answers, however long.** An unbounded splash — the owner's first
  constraint, here and in 0041.

## Measure

- `app_open_decision` with `outcome = store_unverified`: ready ads held back only because Play had not
  answered. Expected near zero. If it is not, the 1.5 s and the 24 h are the knobs. Count it per
  `(foreground_id, path)`, like every other outcome.
- `outcome = premium` now also covers premium that only Play knew about.

## Consequences

- **Health Centre "Enabled without payment"** will count an account that is premium on a device through
  another account's purchase. The server does not record the restore answer, so it cannot tell that
  case from a tampered build. The warning threshold is 5. Telling them apart needs the restore answer
  stored — a schema change, so the owner's go first.
- **0041 stays planned.** This is the device-and-store half. 0041 is the server half: premium on a device
  signed into a different Google account, and expiry as a date. When it lands, the server's answer
  becomes a third input to `adVerdictOf`.
