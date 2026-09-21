# 0150 — A failed ad load says the SDK's own sentence, and the banner joins our pipeline

- **Date:** 2026-09-21
- **Status:** built and pushed. App `invoice-kmp-app` `VC_108_VN_149` @ `d4751550` (ships in 1.4.9).
  Backend `invotick-apis` `feat/event-detail-reads-40-keys` @ `04ae889`, **not deployed**: it waits
  for the next backend batch.
- **Decision:** this is measurement only. No ad is removed, delayed or weakened, and nothing on screen
  changes.
  1. `ad_load_failed` gets new parameters, on every format, on the event that already exists (§1.1):
     - `message` and `cause_message`: the SDK's own sentence.
     - `adapter_count`: how many ad networks the SDK's response lists.
     - `adapter_source`, `adapter_reason`, `adapter_domain`, `adapter_message`: the first network in
       that list that refused.
  2. The banner sends the same chain as the other two formats, with `type=banner`:
     `ad_request → ad_loaded | ad_load_failed | ad_load_crashed → ad_shown → ad_impression_value`.
     `placement` is the slot's tag, and `ad_request_id` is on every row.

## What the data said (production, 2026-09-21)

| Fact | Number |
|---|---|
| 1.4.7 (106) app-open requests, ~4.2 days | 5,944 |
| … that failed | 1,685 (28 %) |
| … of those, `reason=internal_error` | 86 % |
| Failures from phones that have never loaded **any** ad (interstitial included) | 72 %, from 311 phones |
| Banner rows in `analytics_events`, last 30 days | **0** (any `type`, `format` or banner placement) |
| `ad_impression_value` rows, last 30 days | app_open 10,849 · interstitial 1,753 · banner 0 |
| Keys on `ad_load_failed` (1.4.7, three commonest shapes) | 22 / 23 / 21 |

The code agreed:
- The banner's load and impression reached Firebase only (`All_CB_*`).
- Its failure was written to logcat only.
- Its paid event reached Meta only, through `AdRevenueReporter`.

`internal_error` is `code=0`. Once the integer has a name, it has nothing more to say. What the SDK
does say (its message, and what each network answered) stayed on phones we will never hold.

## Reversal: 0043 rejected `message`

0043 gave four reasons. Each one is answered here, not ignored:

| 0043's objection | Answer in 0150 |
|---|---|
| Unbounded length | Capped at 200 characters, whitespace collapsed; a cut message ends in `…` |
| Not groupable | It sits **beside** `reason` and `code`, never instead of them. `reason` is still the count. `message` is what a reader opens once `internal_error` is the biggest bucket. |
| May carry an id or a URL | The query string is dropped from every URL. Host and path stay, so AdMob's help links still name the error. |
| Versioned by a third party | True. That is why `reason` stays the grouping key. |

What decided it: for the largest failure bucket, the message is the only evidence there is, and
without it the "unknown" row cannot shrink.

## Choices made

- **One network, not a list.** We report the first network in the SDK's own order that answered with
  an error. A list inside a params row cannot be grouped.
- **Each network's code is read in its own code space** (§1.15). Meta's `1001` stays `unknown_1001`.
- **`adapter_count` is present only when the SDK returned a response.**
  - `0` is a finding: the request reached no network at all.
  - No response means the keys are absent. It is never `0` (§1.7).
- **Banner `trigger`** (`new_view|reattach|refresh`) is not called `path`, because `path` belongs to
  the app-open ad's code space (§1.15).
- **Banner `ever_loaded`** on `ad_load_failed` comes from the slot's lifetime flag (`hasEverLoaded`,
  commit `f10efede`).
  - `true`: the SDK kept the previous ad on screen through this failure.
  - `false`: the slot has never shown an ad.
- **Banner `ad_shown`** is the SDK's `onAdImpression`, because a banner has no full-screen moment.
- **Which request an impression belongs to.** Impressions and paid rows join to the request whose ad
  is **on screen**, not to a refresh still loading.
- **The banner's paid event feeds two places.** `BannerAdHolder`'s paid listener now writes our
  `ad_impression_value` and also calls `AdRevenueReporter`, like the other two formats.
- **iOS gets `message` only.** The Swift bridge does not pass the list of networks yet, so `adapter_*`
  is absent on iOS (unknown). The iOS banner sends the same chain.
- **Backend.** Nothing changes for ingestion: `params` is JSON and there is no list of allowed keys.
  The app drops null values before sending. One change was needed: Event detail read only the first
  30 keys. A new build's keys sort last, so exactly the new ones were cut, with nothing on the page to
  say so. The limit is now 40.

## How many rows (§5a)

- **Today:** Android sends about 44.5k rows/day, from 1,050–1,190 users (2026-09-17..20).
- **Visits to banner screens:** about 2,160 a day (dashboard 885, create 616, saved 348, estimate 160,
  preview 103, received 50).
- **30-second refreshes:** about 860 a day. That is 1,035 heartbeats a day on those screens, times
  25 s, divided by 30 s.
- **Requests:** about 3,000 a day. Each request makes about 3.5 rows (request, outcome, and shown +
  paid at an assumed ~75 % fill).
- **Result:** about **10,500 rows/day (+24 %)**.
- **Upper bound,** if every foreground second were on a banner screen: about 20,600 rows/day (+46 %).

## Rejected

- **A new `banner_*` event family, or `ad_failure_detail`.** One action gets one event (§1.1). A
  second name means every query has to OR the names together.
- **A list of every network's answer.** It cannot be grouped, and its length has no limit.
- **Putting the message in place of `reason`.** The count must keep a closed vocabulary.
- **Letting the denylist switch off the banner's events.** These are coded events, and coded events
  always send (§1.5). Making them obey the denylist would change the channel rule for every coded
  event, so it is question 1 below, not something done quietly here.
- **Fixing the two banner faults found on the way.** Both would change what the user sees:
  - Android: a `loadAd` that throws leaves `isLoading=true`, so that slot never refreshes again.
  - iOS: `InvotickBannerAd.ios.kt` still hides a loaded banner on any failure. That is the fault
    `f10efede` fixed on Android only.
  Both are listed for the owner.

## Open questions for the owner

1. The banner adds about 10.5k rows/day, and the panel cannot switch them off without a release. Do
   we build a kill switch for coded ad events? (That changes the rule in §1.5.)
2. The iOS banner still disappears after a failed refresh (the Android fix `f10efede` was not carried
   over). Fix it in 1.4.9?
3. On Android, a `loadAd` that throws stops that banner slot for the rest of the screen's life. Fix
   it? It means more requests, so it counts as an ad change.

## Addendum, 2026-09-21 (late) — the banner is refreshed twice: an open question for the owner

**Nothing was changed.** A change here changes ad requests and impressions, so it is the owner's decision.

**What the rows show.** `analytics_events`, `type=banner`, 2026-09-21 17:57–18:29 UTC. These are the 1.4.9 device
tests: 37 requests from a debug build (Google's test unit `…/6300978111`) and 9 from the 1.4.9 release build (our unit
`…/2035355170`).
- Our 30 s timer's `ad_request` rows are followed by more `ad_loaded` / `ad_load_failed` rows that no request of ours
  asked for.
- They arrive under the previous request's id, 5–187 s after it.
- In the half hour there were 46 requests of ours and 63 answers: **about 17 of the answers came from the SDK's own
  refresh.**
- Their rhythm is fixed per AdView and does not reset when we load. On the test unit it is every ~72 s, for example
  save_screen 18:11:53 and 18:13:05 (the 23:11:53 / 23:13:05 PKT of the device logs), and invoice_screen 17:59:27,
  18:00:39.
- Our own unit shows the same thing at ~61–70 s: 18:27:09, 18:28:10 and 18:29:11 after a load at 18:25:59.
- Each SDK refresh that loads also counts an impression (`ad_shown` = `ad_loaded` = 53).
- So the unit's own refresh (set in the AdMob console) runs as well as ours. A creative is sometimes replaced 5–12 s
  after ours loaded, which is well under the 30 s AdMob allows between refreshes.
- Google's guidance: when the app refreshes in code, turn refresh off for that ad unit in AdMob.

**Options** (at about 60 s for the unit's refresh and 30 s for ours; today about 3 loads a minute per visible banner):

| | what | requests / impressions | cost |
|---|---|---|---|
| **A — recommended** | AdMob console: refresh **off** for the banner unit(s). Keep our 30 s timer. | about −33 % (3 → 2 a minute) | Every ad stays up ≥ 30 s. Our timer already pauses under a full-screen ad and when the screen is hidden, is set from Remote Config, and is measured (`trigger=refresh`). No release. |
| B | Remote Config `enableAutoRefresh=false`, and the console refresh stays on | about −67 % at 60 s (3 → 1). With the console set to 30 s, about −33 %. | No release, but the SDK's loads have no `ad_request` row, so fill rate reads wrong until the app writes one. |
| C | Leave both | unchanged | Some ads shown < 30 s: policy exposure and likely weaker viewability and eCPM. |

Fewer requests are not simply fewer money. Each ad stays up longer, so viewability and eCPM per impression may rise.
Measure revenue per session before and after (`ad_impression_value`) against impressions, not impressions alone.
Also seen: a debug AdView kept refreshing by itself for 3 minutes (`main_shell`, 18:24–18:27) after our timer had
stopped. Whatever held it was not a paused AdView. This is worth a look with option A or B.

