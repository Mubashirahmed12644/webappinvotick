# 0173 — The iPhone asks Google's consent question, and it asks it before Apple's

- **Date:** 2026-09-26
- **Status:** built, not merged, not released. App `invoice-kmp-app`, branch `feat/ios-gdpr-consent` off
  `VC_113_VN_149` (with `feat/consent-gate-kill-switch` merged in, because iOS honours the same switch and that
  one commit was not yet on the release branch). No schema change, no server change, no new server call, no new
  dependency. **No new Remote Config key** — iOS reads Android's `consent_gate_enabled`, and its own ATT switch
  `ios_att_prompt_enabled` already existed.
- **Asked by:** the owner, 2026-09-26, directly. Android has had GDPR/UMP consent since 2026-09-23 (`0f939c55`
  foundation, `0288eb7e` wiring, `d127c97a` kill-switch); the iPhone had nothing.

## The gap

Consent files before this: `commonMain` 11, `androidMain` 9, **`iosMain` 0**. The shared contract
(`ConsentEvents`, `ConsentOutcome`, `ConsentEntry`, `ConsentSignals`, `ConsentKillSwitch`,
`PrivacyOptionsLauncher`, `GatewayConsentEvents`) was written so iOS could follow it, and `7d3bee8f` had already
touched iOS once — only to stop the drawer crashing on a `PrivacyOptionsLauncher` that did not exist.

So on an iPhone, iOS AdMob (fully built since `ec5a0c67`: 11 ad files, GMA 13.9.0) served ads in the EEA/UK with
no consent gathered at all. That is a Google AdMob EU-consent-policy violation, with the ad account as the stake,
and it is also the one part of GDPR the app could not honestly claim.

**The AdMob GDPR message is published for iOS** — the owner created it on 2026-09-23 and sent the screenshot. It
is not an open action and must never be put back on his list. If a build behaves as though no message exists, the
fault is ours: check the app id, the bridge registration, the debug geography and the form-available state first.

## Decided

**1. iOS mirrors Android, class for class.** The way `IosAppOpenAdGate` mirrors `AndroidAppOpenAdGate`, not a new
design. `IosConsentController` ← `AndroidConsentController`; `IosConsentGate` ← `ConsentGate`;
`IosPrivacyOptionsLauncher` ← `AndroidPrivacyOptionsLauncher`. No Android file changed.

**2. No new dependency, and this was checked rather than assumed.** The app links the `GoogleMobileAds` SPM
product; that package's `GoogleMobileAdsTarget` already depends on `GoogleUserMessagingPlatform`. 3.1.0 is in
`Package.resolved` and `UserMessagingPlatform.framework` is already produced by the existing build. Swift only
adds `import UserMessagingPlatform`. The project file needs nothing either — `iosApp` is a
`PBXFileSystemSynchronizedRootGroup`, so a new `.swift` file in the folder is compiled on sight.

**3. The same shape of bridge as every other iOS SDK here.** Kotlin declares `UmpBridge` and a settable
`var umpBridge`; Swift implements it and `iOSApp.swift` registers it in `didFinishLaunching`, beside
`AdMobBridgeKt.adMobBridge` and `StoreKitBridgeKt.storeKitBridge`. Callbacks are **interfaces, never Kotlin
function types**, because an exported function type boxes its arguments — `(Int, String?) -> Unit` reaches Swift
as `(KotlinInt, String?)` and nothing conforms (the trap `RemoteConfigFetchCallback` was written for).

Swift asks; **Kotlin decides**. The IAB TCF strings are read in Kotlin from `NSUserDefaults.standard` (UMP writes
the same `IABTCF_*` names there that Android gets in SharedPreferences) and interpreted by the one shared
`ConsentSignals`. Nothing about consent is parsed in Swift, so the two platforms cannot drift.

**4. Land-first placement, unchanged from Android** (the owner's decision of 2026-09-23). No form on the splash.
`warmUp` — a status lookup that can never show anything — runs at `IosAds.start`; the form comes at the first
ad-moment after the user has landed, which in practice is the banner composing. Every iOS ad path now asks first,
in Android's order and with Android's words:

| Path | Reads consent | Runs the flow | Records |
|:--|:--|:--|:--|
| `showOnSplash` | yes | **no** | `app_open_decision outcome=consent_pending` |
| `preload` (app-open, interstitial) | yes | no | the shared `AppOpenRequestRefusal.CONSENT_PENDING` |
| `showOnLanding`, `showOnResume` | yes | yes | `consent_pending`, then asks |
| save interstitial | yes | yes, **behind the save** | the save never waits |
| banner | yes | yes — this is the form's usual door | the slot is reserved, so no layout moves |

**5. Firebase Consent Mode v2, as on Android.** `Analytics.setConsent` through the bridge, so ad signals read
`source=API` instead of the weak `source=MANIFEST`. Non-GDPR regions grant all four explicitly — otherwise the
signal would never be strong for the ~97% of this app's users who were never asked.

**6. The same events, and no new ones.** `screen_view` for `consent_form` with `entry`, and one `consent_decision`
per resolved flow with `outcome`/`entry`/`elapsed_ms`/`error_code` — the existing `ConsentEvents` contract,
through the existing `GatewayConsentEvents`, which is `commonMain` and was already bound on iOS by
`consentEventsModule`. The outcome words come from the same `ConsentSignals.outcome`, so an iPhone row and an
Android row are comparable. **Nothing was added to the event vocabulary.**

**7. The same kill-switch, and no second one.** Remote Config `consent_gate_enabled`, read as **text** through
`ConsentKillSwitch` — off only when the console says the word. An absent key, a blank value, a word nobody can
read, a failed fetch and a phone that has never reached Firebase all leave it **on**, so shipping this changes
nothing until somebody deliberately types `false`. Off, `IosConsentGate` steps out of the path entirely: every ad
allowed, UMP not asked, no form, no status lookup, no drawer entry — 1.4.8's behaviour, with no third state.

**8. The drawer's "Privacy options" entry becomes real on iPhone.** Google's UMP requires the entry wherever a
form was shown, so shipping the form without it would be a policy problem of its own. `7d3bee8f`'s **optional**
Koin lookup in the drawer is kept as it is, and now finds `IosPrivacyOptionsLauncher` — the cost of being wrong
there is a crash in a menu, and the cost of being right is a hidden row.

## The order: Google's form first, Apple's ATT after

This is the one genuinely iOS-only decision, and it is the reason this file exists.

An iPhone has **two** questions, and until now they were placed at the same moment. The UMP form arrives at the
first ad-moment after landing; `IosTrackingPrompt` asks Apple's 1.5 s after a returning user's splash, once that
splash's ad has closed. On an EEA iPhone, left alone, they land together.

**Decided: UMP first, ATT second, and ATT waits — it never overtakes and never cancels.**

- It is Google's own documented order.
- It is the only defensible one in the EEA: the GDPR question is whether we may process this person's data at
  all; Apple's is the narrower question of the advertising identifier. Asking Apple's first would be asking to
  track somebody who has not yet been asked whether they consent to anything.
- Waiting costs nothing. iOS keeps the ATT status at "not determined" until somebody answers, so a splash where
  consent has not resolved simply does not ask, and the next splash does (`scheduled` is cleared).
- The wait is bounded at 20 s, then abandoned for this splash. Long enough for a form somebody is reading (the
  form's own budget is 4 s and a person takes longer), short enough not to keep a coroutine alive for a form that
  is not coming.

**"Resolved" is not "allowed."** ATT waits for UMP to have *had its say* — answered, not required, or the
kill-switch off — not for a yes. Somebody in the EEA who refused every ad purpose has answered Google, and Apple's
question is a separate question to a separate regulator with its own switch. Reading a denial as "not resolved"
would mean ATT was never asked of anybody who said no.

**Nobody outside the EEA waits.** UMP answers NOT_REQUIRED within a few hundred milliseconds of the app starting
and stores it, so from the second launch onwards it is resolved before the ATT coroutine begins. For ~97% of this
app's users the ATT behaviour is exactly what shipped before this decision.

**They do not fight over `AdVisibilityController.fullScreenAdShowing`, and neither may raise it.** That flag means
"an ad SDK screen is up" and the app acts on it: banners collapse and pause themselves for AdMob policy, and the
app-open manager refuses to stack. Raising it for a consent form would hide the banner — and the banner's own
composition is what raises the form under land-first, so the form would remove its own reason for existing and the
slot would move on screen while the question was open. Both questions **read** that flag and neither writes it.
What they share instead is `IosSystemPrompt`, a main-thread-only holder of the one screen a system question of
ours may occupy: consent claims it before presenting, ATT refuses when it cannot claim it, and a late callback can
only release its own claim.

The order itself is `TrackingPromptRefusal` — pure, in `commonMain`, and tested, for the reason `ConsentKillSwitch`
is there: `IosTrackingPrompt` needs `UIApplication`, UMP and the AdMob bridge, so it cannot be unit-tested, and
the part worth pinning is the decision.

## A missing bridge means no ads, on purpose

`IosConsentController.canRequestAds()` answers **false** when `umpBridge` is null. A build that registered
`adMobBridge` but forgot `umpBridge` would otherwise serve personalised ads to EEA users with no consent at all —
the exact violation this work closes. No ads is loud and is found in one test run; a silent policy breach is found
by Google. It also matches `PROJECT_RULES.md` Tier 3 F.3, *on doubt, don't show an ad*, and Android's own
`canRequestAds` fails the same direction. And if it ever reached production, `consent_gate_enabled=false` puts
every ad back with no release — which is what the kill-switch is for.

## Rejected

- **A shared `expect`/`actual ConsentGate`.** It would mean rewriting Android's working `ConsentGate` and
  `AndroidConsentController` to fit a common signature, on a branch whose job is iOS. The codebase's own answer to
  this is the `IosAppOpenAdGate` / `AndroidAppOpenAdGate` pair: mirror the class, share the pure parts. The pure
  parts are already shared.
- **ATT first, then the consent form.** Against Google's guidance, and it asks to track somebody before asking
  whether they consent to anything.
- **Asking both and letting iOS sort it out.** Stacked, the one underneath is answered by nobody, and ATT asked
  while the app is inactive is answered "not determined" *without being shown* — the single attempt spent for
  nothing.
- **Reusing `AdVisibilityController.fullScreenAdShowing` as the mutex.** It would collapse the banner that raises
  the form. Reasons above.
- **`att_prompt_shown` / `att_decision` events.** Proposed in the feature's memory note, and still a good idea —
  nothing currently records what Apple's question earns, only an `NSLog`. Not added here: it is new event names,
  which is the user-journey agent's call and the owner's, and this branch's job was the consent flow. Flagged,
  not shipped.
- **A separate iOS kill-switch key.** One switch that moves both platforms is what `d127c97a` already built the
  iOS read for, and two keys is two things to remember in an emergency.
- **A constant for the EEA debug override.** Android has `FORCE_EEA_IN_DEBUG = false` in source, which has to be
  edited to test and can be committed as `true`. iOS reads a launch argument instead —
  `-InvotickForceEeaConsent`, debug builds only, the shape `-InvotickRunBackgroundSyncPass` already uses — so
  nothing has to be edited and nothing can leak into a release.

## Consequences

- **An EEA/UK iPhone will now see a consent form**, once, at its first ad-moment, and can change the answer from
  the drawer. Nobody else sees anything new.
- **iOS gives up some app-open impressions on a fresh install's first cold start**, counted as
  `app_open_decision outcome=consent_pending` on the `splash` path — the same measurement Android has, so what
  land-first costs is readable rather than assumed. Outside the EEA it should be near zero.
- **`consent_form` and `consent_decision` will start arriving with `platform=iOS`.** Any funnel reading them must
  split by platform, or a European iPhone and a European Android phone will be added together as one population
  with two different app versions.
- **A future iOS consent change must ship with the Android one**, or the `ConsentSignals` / `ConsentKillSwitch`
  behaviour diverges between two classes that are supposed to mirror.
- **`d127c97a` must reach the release branch** either with this or before it; on this branch it is merged, not
  cherry-picked, so no duplicate commit.

## Still open

- **Not verified on a real EEA device or a real iPhone** — there is neither on this Mac. What was and was not
  exercised is in the branch's report, and a reasoned verdict is not a measurement.
- `att_prompt_shown` / `att_decision`, above.
- Whether this goes into 1.4.9 is the owner's call. Nothing is merged.

## The owner's rules, 2026-09-26 (added the same day)

Three things the owner decided while this branch was being made ready for 1.4.9. His words, then what was built.

**1. "lets start and add business ki tooltip consent ky uper aa rhi hy isko fix kero."** A coaching tooltip must
never draw on top of Google's consent form or Apple's tracking alert.
- Both are native, so no composable can call `CoversTheScreens()` for them (decision 0171). They now take the
  cover through **`SystemPrompt`** (`core/ads` commonMain, `SystemPromptScreen.kt`): held → one `ScreenCover`,
  free → released. It replaces `IosSystemPrompt` and is shared with Android, whose SDK shows the form in a
  dialog window of its own.
- Every ending releases it: answered, closed, failed, thrown. The 4 s wait does not, because the form is
  still up.
- `ACoachTooltipNeverDrawsOverACoverTest` fails the build when a native question is presented from a file that
  never claims `SystemPrompt`.
- Simulator, before: the tooltip sat over the form and hid its "Learn more" row. After: the form alone, and the
  tooltip back on Create Invoice once the form is answered.

**2. "gdpr ka consent world wide country main nahi ana chahye, just required countries main aye."** The form
appears only where the law requires it.
- The one thing in our code that can make Google ask everybody is a debug geography. It is now chosen by
  **`ConsentDebugGeography.forBuild`**, where the build type decides. A release gets `NONE` on both platforms,
  and `ConsentDebugGeographyTest` pins that. On iOS the Swift side also compiles the override only under
  `#if DEBUG`.
- The launch arguments are `-InvotickForceEeaConsent` and `-InvotickForceNotEeaConsent`, in debug builds only.
- Simulator, fresh install each time:
  - EEA: form shown.
  - Not EEA: no form, and the splash ad was shown.
  - No override, from Pakistan: no form, and ads were shown.
- One cost was seen, and it is not a form. On a fresh install in Pakistan the status lookup answered at 3.3 s,
  0.9 s after the splash had decided. So that first cold start's splash ad was skipped (`consent_pending`).
  Android is designed the same way, and the owner can weigh it.
- The AdMob console message's targeting cannot be seen from here. It is the owner's check.

**3. "consent ads ko band nhi kerta, ye sirf personalized ads lany ki ajazat leta hy — is sy match rate acha hota
hy and quality ads milty hain."** Consent decides personalised or not, never ads or not.
- **Any answer allows ads**: yes, no or partial. The gate follows Google's `canRequestAds()`, and nothing reads
  the choice for gating.
- **A banner already showing when the answer lands is left alone.** Its next request is the normal refresh.
- **An empty banner slot loads on the answer**, whenever the answer lands, before or after the 4 s wait.
- That is **`ConsentAdsSwitch`** (commonMain). It only ever opens, and it is fed by `ConsentFlowRecord`'s real
  end (0174), not by the wait.
- The request is the existing `ad_request type=banner trigger=new_view`. No new event, and no new value.
- Simulator: the person refused 49 s into the form, and the row said `outcome=denied timed_out=true`. 120 ms
  later there was one banner request, and the banner was shown on the same screen. Before, the slot stayed
  empty and the row said `dismissed` at 4,002 ms.
- iOS now writes 0174's row the same way Android does.

Branches (`invoice-kmp-app`), not merged:
- `fix/149-consent-form-covers-the-screens` is common + Android only, on top of the release.
- `feat/ios-gdpr-consent` contains it, plus iOS.
