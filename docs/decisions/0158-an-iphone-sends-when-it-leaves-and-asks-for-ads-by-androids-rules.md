# 0158 — An iPhone sends its work when it leaves, and asks for ads by Android's rules

- **Date:** 2026-09-22
- **Status:** built. App `invoice-kmp-app` `VC_108_VN_149` `86ef1628` (sync) + `8b4565c9` (ads) (for 1.4.9 on iOS). Not released, not run on a
  phone. No schema change, no new event, no new Remote Config key.
- **Asked by:** the owner, 2026-09-22: "iOS should have everything Android has for 1.4.9." This is the parity audit's
  one design choice set; the audit itself is in the report of the same day.

## What the audit found

Most of 1.4.9 is shared code and already reaches the iPhone: the account switcher and its Keychain passes (0146),
stage 3 (0153), received invoices on the phone (0154), returning accounts and the Keychain device id (0144), the QR
link question (0145, and the iPhone scans with its own camera), premium moving (0143), the footers (0147/0151/0152,
renderer bundle byte-identical on both), the celebration (0149), the drawer X, the received-link fix (`e43043ae`,
universal links publish to the same `DeepLinkBus`), the OTP resend, the sync fixes 0124–0136, StoreKit's
`entry` + `premium_purchase_result` (0155) and the 30-minute window (0157).

Four things were Android-only:

| Gap | Android | iPhone before this |
|---|---|---|
| Sync on returning / leaving | `AppLifecycleObserver`: push + pull on ON_START, push + **parked accounts** (0146) on ON_STOP, full sync when another owner signs in | none: a push at launch and in the rare `BGAppRefreshTask` only. A parked account's work left only when iOS woke the app |
| The open account's services at start | `AccountServices.startForOpenAccount` in `onCreate` (`GuestAuthRestorer`, stage 3) | stage 3 only; `GuestAuthRestorer` started only after a switch, so an offline guest was retried only by sync |
| App-open request rule (0124) | `AppOpenRequestRefusal` order, `had_network` on `ad_request`, `skipRequestWhenOffline` read from Remote Config | its own copy of the checks; no `had_network`; the switch was not read at all |
| A failed load's detail (0150) | `message`, `cause_message`, `adapter_*` | `message` only; the banner had no cause |

## Decided

1. **One copy of "what happens on returning and leaving": `AppSyncLifecycle` (domain, commonMain).** Each platform only
   says *when*. Android's `AppLifecycleObserver` now delegates to it (same calls, same order); iOS's
   `IosAppLifecycleSync` drives it from `willEnterForeground` / `didEnterBackground`.
   - One change from Android's old code: a failed own-account push no longer skips the parked accounts' push on
     leaving. Each step is tried on its own.
2. **On an iPhone the leaving push runs inside `beginBackgroundTask`** (about 30 s), ended exactly once — when the push
   ends or iOS says the time is up. A cut push loses nothing: the queue waits in the account's file, as offline.
3. **It sits behind the existing switch `ios_background_sync_enabled`**, because sending on the way out is background
   sync. The return's push + pull is not switched, exactly as on Android and as the launch sync already is.
4. **`AccountServices.startForOpenAccount` starts once per process from the iPhone's UI start**, as in Android's
   `onCreate`. `GuestAuthRestorer.start()` is now once per instance, so no path can watch the network twice.
5. **The iPhone's app-open preload asks `AppOpenRequestRefusal`**, with a missing AdMob bridge in the `no_play_services`
   slot, and stamps `had_network` from its own path monitor — **absent until the system has answered**, never "offline".
   `skipRequestWhenOffline` is read on iOS too, default off, so nothing changes until the owner turns it on.
6. **The Swift bridge hands over the cause's message and the first refusing network** (plain values, not a list — one is
   all a params row holds). `AppleAdErrorReason.bridgedAdapters` rebuilds what Android's full list reports, and a test
   proves the two give the same keys. The banner now reports its cause, as the other two formats do.

## Rejected

- **A second copy of Android's observer in iosMain.** The analytics lifecycle was unified for the same reason (0085).
- **A new Remote Config key for the leaving push.** It is background sync; the existing switch already means that.
- **Treating "no answer yet" as offline for `had_network`.** §1.7: absent is unknown.
- **Passing the whole adapter list through Swift.** Kotlin objects in a Swift array are awkward, and the row keeps one.
- **The notice that names its account on iOS** (`accountId` on a tapped notification). It comes only by remote push, and
  the iPhone has no APNs yet. Wiring a handler for a notification that cannot arrive is dead code; it goes in with APNs.

## Waiting on the owner (not code)

APNs key into Firebase + `aps-environment` + FirebaseMessaging (then the token registrar and the account notice work
unchanged), the AdMob iOS ad units, the App Store products, and the App Store listing (`app_store` destination on the
web, 0110).

## How many rows (§5a)

No new event. `ad_request` gains `had_network` on iPhones; `ad_load_failed` gains up to six keys there. iOS sends
tens of rows a day today.
