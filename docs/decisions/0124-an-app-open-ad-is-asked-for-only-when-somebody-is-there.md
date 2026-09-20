# 0124 — An app-open ad is asked for only when somebody is there, and that rule now has a test

*Decided 2026-09-20. Technical, except the one question at the bottom, which is the owner's.*

## What the owner saw

> "bohat sary ads request ho rhi hain and i think wo app band hony ky baad hoti hain, app open ki shayed."

He was right, and the dump he sent proves it. Invotick ID 903623205, 2026-09-06: the app was closed
at 06:19:27 (`app_exit_confirmed`) and about 60 more `ad_request` rows for `type=app_open` followed,
from 06:19:38 to 15:31 that day and one more the next morning — 10 to 20 minutes apart, every one
with an empty screen, `ms_since_start` of 0 or 1, no `open_count`, and no `process_id`.

## The cause, named exactly

A fresh process with no screen in it. `MyApplication.onCreate` runs on **every** process start,
including the ones WorkManager makes every 15 minutes to sync a phone nobody is holding; it called
`MobileAds.initialize`, whose callback called `appOpenAdGate.preload()`, which asked AdMob for an ad.
Nothing in that path knew whether a person was there.

The 10-to-20-minute spacing is the sync wake. `ms_since_start` 0–1 is the request landing in the
first millisecond of the process. The absent `open_count` is the proof that no cold start was ever
recorded in it — nobody opened anything.

Call path: `WorkManager wake → MyApplication.onCreate → MobileAds.initialize{} →
AndroidAppOpenAdGate.preload() → AppOpenAdManager.loadAd() → AppOpenAd.load()`.

## How much it wastes — measured, not estimated

Production, `analytics_events`, Android release, the 7 days to 2026-09-20, windows bounded on both
sides, counts only.

| | Requests | Filled | Shown | Loaded and never shown |
|---|---:|---:|---:|---:|
| **No foreground** (empty screen + `ms_since_start` ≤ 1) | **5,976** (32.3%) | 2,511 | **1** | **99.96%** |
| A person was behind it | 12,510 | 8,276 | 4,690 | 43.3% |
| All app-open requests | 18,487 | — | — | — |

293 phones produced the 5,976 — an average of 20 each, a maximum of **315**. One ad, out of 2,511
that AdMob actually served, was ever seen by anybody.

## It is already fixed, and that is the point of this decision

`everForegrounded` — a latch raised at the first `ProcessLifecycle` ON_START and never lowered —
was added on 2026-08-31 (`aac47fd9`) and shipped in versionCode 97. Every one of those 5,976 rows
is from **build 92 or 94**. Builds 101, 105 and 106 produce none.

So nothing was broken. What was true is that the rule lived as a bare `Boolean` inside one method,
with no test anywhere, in a file where the same class of mistake has already happened twice — the
preload firing from `onCreate`, and `core:camera` later adding two activity launchers that neither
knew about `InAppExcursion`, so the camera permission and the gallery each earned an ad. A rule
everybody must remember holds until the next person.

**Decided:**

- `AppOpenRequestRefusal` (commonMain) holds `preload()`'s seven checks in `preload()`'s own order —
  `never_foregrounded`, `premium`, `disabled`, `no_play_services`, `no_network`, `already_loading`,
  `already_cached` — and `preload()` calls it for that order rather than keeping a copy. This is the
  same arrangement `show()` already has with `AppOpenShowRefusal` (0061).
- `EveryAppOpenRequestPassesTheGateTest` fails the build when a new call site asks the SDK for an
  app-open ad without being reviewed, when `preload` stops consulting the decision, or when the
  foreground latch is lowered anywhere. Same shape as the backend's `RoutesDeclareWhoMayCallThemTest`
  and `WebpanelReadsAreBoundedTest`. Proven red by adding a third call site.

## The offline refusal is built, and it is OFF

"A request with no network cannot be filled, so refusing it costs nothing" looked obvious. The data
refused it.

| Requests on builds 101+ | Count | Filled | **Shown** | Earned |
|---|---:|---:|---:|---:|
| `net_online = false` at request time | 897 (8.1%) | 362 | **220 (24.5%)** | **$0.62** |
| `net_online = true` | 10,222 | 7,245 | 4,201 (41.1%) | — |
| All app-open, that week | 11,119 | — | 4,427 | **$26.32** |

One in four requests made while the phone read as offline was shown and paid. That is 2.34% of the
placement's weekly revenue. A hard offline guard would have taken 220 real impressions from real
people this week.

Two explanations fit, and they need different answers: either `net_online` is stale at request time
(it is the last reading the network monitor published, and at a cold start that can still be the
initial one — the same defect already recorded on iOS, where 48 s of events read `net_type=none`
while those very events were uploading), or a preload's request and its show are far enough apart
that the connection comes back in between. Nothing in the data tells them apart.

**Decided:** `AppOpenAdConfig.skipRequestWhenOffline`, **false** in the bundled default and in the
Remote Config parser, pinned by two tests. Every `ad_request` now carries **`had_network`** — what
`ConnectivityManager` said at that instant, a live reading rather than the gateway's stamp, absent
when the system would not say. A parameter on an existing event, never a new event (§1.1); absent
means unknown, never offline (§1.7). A week of it answers the question, and the switch can then be
turned on from Remote Config with no release.

The refusal, when it is switched on, is deliberately **not** `NET_CAPABILITY_VALIDATED` — a hotel
portal, an office firewall and a connection still being checked all read as not-validated while
traffic may still flow, and those can fill. It asks only whether there is a connection at all.

Nothing here touches **showing**. An ad fetched while online is still shown and still paid for when
the phone has since gone offline — 321 of 5,438 `ad_shown` rows that week were offline, which is
also the answer to the `ad_shown` + `ad_impression_value` at 06:16:36 in the owner's dump: that ad
was fetched earlier, while the phone had a connection.

## What AdMob thinks of it

Requests without impressions are the shape AdMob's own guidance warns about: the ad unit's match
rate and show rate feed what networks bid, so a unit that asks 20 times per phone and shows once
teaches the mediation stack that this inventory is not worth much. The policy line the app already
respects is the other one — an app-open ad must not be shown when the user did not open the app
(`InAppExcursion` exists for exactly that) — and nothing here was a policy breach, because nothing
was ever **shown**. It was waste: AdMob's servers, the user's battery and the user's data.

## Rejected

- **A cap on requests per day or per hour.** It hides the number instead of removing the cause, and
  it would also cut the requests a real person is waiting behind. The same argument that killed
  "cap the cache age" in `app-open-ad-measured-facts`.
- **Moving the preload from ON_START to ON_RESUME**, so the lock screen cannot raise the latch. It
  would delay the first request on a genuine cold start, and the reason it sits at ON_START is
  measured: in 1.4.4, 120 of 218 first opens made their first request after 3 s and 51 after 6 s,
  against a splash that waits 6 s. That is an impression cost for a case nobody has counted.
- **A hard offline refusal.** See above: 220 impressions and 2.34% of the placement's revenue a week,
  on today's numbers.
- **Guarding `showOnSplash`'s request as well.** A person is on the splash waiting for that exact ad.
  The switch deliberately does not reach that call site; only the measurement does.
- **Recording every preload skip as an `app_open_decision`.** Its contract is "how this foreground's
  app-open ad ended", a preload is a decision about the cache, and it runs at every ON_START and
  ON_STOP — roughly doubling the event and changing what it means, for about +6% on
  `analytics_events`. The proof this change works needs no new row: `ad_request` rows with an empty
  screen and `ms_since_start` ≤ 1 should stay at zero on builds 101+, and they already are.

## State

Branch `feat/146-app-open-requests-need-a-person`, commit `20e832ea`, pushed, **not merged**.
620 unit tests green (`./gradlew testDebugUnitTest`), `:composeApp:compileDebugKotlinAndroid` green,
iOS compiles. No schema change, no version bump, no release.

Android only. iOS's `IosAppOpenAdGate` carries the same `everForegrounded` latch on
`VC_107_VN_147`, untested there in the same way — worth the same treatment when that branch is next
touched.

## The one question for the owner

The offline switch is off and costs nothing while it is off. In a week, `had_network` will say
whether turning it on is free or whether it costs about 220 impressions. **Nothing needs deciding
today** — the question comes back with the number.

Related: [0043](0043-an-ad-failure-is-named-in-the-sdks-own-words.md),
[0061](0061-a-failed-app-open-show-says-who-refused-and-in-what-words.md),
memory `app-open-ad-measured-facts`, `app-open-excursion-exceptions`,
`monetisation-measure-never-assume`.
