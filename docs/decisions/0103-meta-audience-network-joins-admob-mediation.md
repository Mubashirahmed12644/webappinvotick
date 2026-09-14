# 0103 — Meta Audience Network joins AdMob mediation in 1.4.6

**Status:** the owner's instruction, 2026-09-14:
> "is latest version main facebook montization ka mediation adapter lagwao and iky baad isko khud test bhi kerwao aik
> agent sy ky wo sahi kaam ker rha hy yaan nhi"

It is being built for Android first. iOS follows once its ads are live, since they wait on the owner's AdMob setup.

**Related:**
- AGENTS.md §1: monetisation is a requirement; measure the gain and the cost;
- `memory/monetisation-measure-never-assume.md`;
- `memory/admob-webview-crash.md`;
- `memory/app-library-audit-2026-09-11.md`.

## Decided

- **The app gains the Meta Audience Network adapter** for its AdMob mediation (Android, 1.4.6). With it, Meta can bid
  for the app's ad slots next to AdMob.
- **A separate agent tests it on a device** after the build. It checks:
  - the adapter starts;
  - AdMob ads still load and show as before;
  - nothing new crashes;
  - Google's mediation test tool shows Meta's state.
- **The console side is the owner's**, from written steps:
  - Meta's app and placements;
  - Meta added to AdMob's mediation groups;
  - Play's Data safety form;
  - an app-ads.txt line, if Meta needs one.
  Until that is done, the adapter sits idle, and nothing changes for users.
- **Both the gain and the cost are measured.**
  - The gain: Meta's share of impressions and revenue, through the existing `ad_source` on the ad events.
  - The cost: app size, start-up work and crashes.

## Rejected

- None was offered; this is the owner's instruction.

## Built on Android, 2026-09-14

Branch `feat/146-meta-mediation` in `invoice-kmp-app` (worktree `invoice-kmp-app-meta`): one commit on
`VC_102_VN_146` at `8f259399`. Not merged, not pushed.

**Decided while building:**
- **Adapter `com.google.ads.mediation:facebook:6.22.0.0`**, which brings Meta's SDK 6.22.0.
  - It asks for `play-services-ads` 25.4.0, the version the app already ships.
  - So the SDK under every ad format stays where it was: the release dependency report still resolves 25.4.0.
- **The kill switch is the AdMob console.**
  - No code of ours calls Meta. AdMob asks it for a bid only on ad units whose mediation group lists Meta.
  - Taking Meta out of a group stops it there from the next request, on every installed version.
- **Debug builds log each adapter's start-up state** to logcat (`InvotickAds`, `[Mediation] …`).
  - The Ad Inspector entry in the debug drawer already existed.
  - The log is gated by `BuildConfig.DEBUG`. The R8 build carries 0 copies of its text, against 2 in the debug APK.
- **No new event and no new parameter.**
  - `ad_loaded.ad_source` names the network that filled an app-open or interstitial ad.
  - `ad_impression_value` joins to it by `ad_request_id`.
  - Banners send neither event, so for banners AdMob's own mediation report is the only per-network number.
  - Match Meta's value whole, as it first appears in a row (AGENTS-EVENTS §1.16), never by a substring such as "Meta".

**Measured:**
- **Download size per phone**, with bundletool on the library audit's phone (arm64, xxhdpi, en, SDK 34), comparing
  an R8 build with and without the adapter: **15,627,722 → 18,270,689 bytes, +2.64 MB (+17%)**.
  - About 2.5 MB of it is one 5.5 MB file of Meta's code, shipped in the app's assets.
  - The app's own code grows by 0.13 MB.
- **Start-up work, read from Meta's compiled code:**
  - A start-up component (`AudienceNetworkContentProvider`) runs at every app start, before `Application.onCreate`.
  - It starts a thread that loads that file and then runs Meta's own start-up.
  - It runs whether or not Meta is in any AdMob group.
  - Neither the AdMob console nor a Remote Config switch can turn it off. Only a release removes it.
- **Start-up time: not measured.** The Pixel was not reachable over adb. The comparison waits for the device test.
- **Manifest:** it gains only Meta's activity and its start-up component, and exports neither. No new permission.

**Found, for the owner:**
- **App open:**
  - Google's format table for Meta lists banner, interstitial, rewarded and native, but not app open.
  - The adapter does have an app-open loader, so try adding Meta to the app-open group in AdMob.
  - If AdMob refuses, Meta competes on banner and interstitial only.
- **app-ads.txt:**
  - The Play listing's website is `https://vfddf94b4.app-ads-txt.com`, not invotick.com.
  - Its file already carries AdMob's line (`google.com, pub-4044711852555974, DIRECT, f08c47fec0942fa0`).
  - It also carries one Meta line (`facebook.com, 392071745451242, RESELLER, c3e20eee3f780d68`). Whether that
    Meta ID is the owner's is not known.
- **EEA consent:**
  - The app never runs Google's consent tool (UMP).
  - Meta is not on the IAB's vendor list, so in the EEA it needs Google's Additional Consent.
- **Data safety:**
  - The live form already declares Device or other IDs, App interactions, Diagnostics, Crash logs and Approximate
    location as shared for advertising.
  - That covers what Meta says its SDK collects.

## Rejected while building

- **6.22.0.1.**
  - It is on Google's Maven, but its changelog still says "In progress", with no tested-with line.
  - Its two changes (native ads, a Kotlin pin) are nothing the app uses.
- **6.21.0.0**, the version already in this Mac's Gradle cache. It pulls a code-coverage testing library (JaCoCo)
  into the app.
- **A Remote Config switch.**
  - The only thing it could call is `disableMediationAdapterInitialization`.
  - That turns off start-up for every adapter, and it does not stop Meta being asked for bids.
  - It would look like a switch without being one.
- **Google's Mediation Test Suite.** Its page now serves Ad Inspector, which the debug drawer already opens.
