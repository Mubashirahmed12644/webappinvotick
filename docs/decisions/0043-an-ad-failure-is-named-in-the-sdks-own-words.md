# 0043 — An ad failure is named in the SDK's own words, on the event that already exists

- **Date:** 2026-09-07
- **Status:** decided, in app branch (`invoice-kmp-app` `VC_96_VN_144`, `core/ads` only)
- **Decision:** Add `reason`, `error_domain`, `cause_reason`, `cause_domain` to `ad_load_failed` and
  `ad_show_failed`; add `ad_request_id` + `elapsed_ms` to `ad_show_failed`; add `path`
  (`splash|resume|landing|preload`) to the App Open request/outcome chain. **No new event, and
  `code` is not touched.** Every `reason` value is the word the SDK uses for that failure — never a
  conclusion about what it cost the user.

## Why

Four separate things were unanswerable, all of them from data we were already being handed and
throwing away:

1. **`code` is two enums under one name.** `ad_load_failed` reads `AdRequest`'s table, where `3` is
   `NO_FILL`. `ad_show_failed` reads the full-screen show table, where `3` is `APP_NOT_FOREGROUND`.
   Both events carry the key `code`, so any panel row or `GROUP BY` spanning the two adds two
   different enums together. 5,668 rows, 100 % populated — a fill rate that reads as solved.
2. **`error_domain` and `getCause()` were dropped entirely**, and `code=0 INTERNAL_ERROR` is **70 %**
   of load failures: the largest bucket and the one that says the least. Under mediation the real
   refusal is in the cause, in the adapter's own domain, and we kept none of it.
3. **`ad_show_failed` had no `ad_request_id`.** Request → loaded → shown → paid → dismissed all
   carried it. The one row that says *the chain broke* could not be joined to the chain it broke.
   (`AppOpenAdManager.kt`, `InterstitialAdManager.kt`.)
4. **`placement` is the constant `app_open`** for every App Open request ever made, so grouping by
   it returns one row. `path` is what separates a splash the user is waiting on from a background
   refill fired at nobody — the distinction behind the fix in `aac47fd9` (show rate 5.4 % → 49.5 %),
   which nothing in the event stream could express.

## What each value is allowed to say

`AGENTS-EVENTS.md` §1.14 — **a name says what was seen, never why.** `no_fill` is AdMob's own word.
`ad_too_slow`, `user_gave_up`, `ad_wasted_the_open` are verdicts and do not exist here. Anyone may
still conclude an ad cost a session; they reach it from the counts, not from the label.

`unknown_<n>` keeps the number rather than folding an unrecognised code into `internal_error`. A new
SDK version can add a code; folding it grows the biggest bucket while every reader believes the SDK
said something it never said, and nothing ever catches it.

A code is named **only inside its own code space**: if the error's domain is a mediation adapter's,
the integer keeps `unknown_<n>` and `error_domain` / `cause_domain` say whose integer it was.

## Rejected

- **A new `ad_failure_reason` event.** §1.1 — one action, one event; the variation is a parameter.
  A second name for a failure we already record means every query ORs two names together and the
  first one anybody forgets lowers the number silently. It would also split the failure's history in
  two for no gain, since `ad_load_failed` already fires at exactly the right moment with exactly the
  right scope.
- **Sending `error.message`.** It is free-text from the SDK and from every mediation adapter: not
  groupable, unbounded in length, versioned by a third party, and the one field most likely to
  carry an id or a URL into `analytics_events`. The pair (`reason`, `code`) is the same fact in a
  form that can be counted. The message stays in logcat, where a person reads it once.
- **Reusing `placement` to carry the path.** `placement` is the ad unit's own identity and is
  already the join key to Remote Config and to `AdsAnalytics`' Firebase names
  (`ASE_AO_Imp_<tag>`). Overloading it would make the same key mean "which ad slot" on interstitials
  and "which moment" on App Open — the exact defect this decision removes from `code`, recreated one
  parameter over. `path` is its own dimension.
- **Removing or renaming `code`.** §1.8: it is a stable identity carried by 5,668 stored rows, and
  the raw vendor integer is the one field that cannot go stale when the SDK renumbers a name.
  `reason` sits beside it; both ship.
- **`path` on `ad_impression_value`.** The paid listener is registered at load time, so the only
  path in scope is the one that *requested* the ad — while what pays is the **show**, which is often
  a different path (preload fetches, the landing screen shows). Stamping the load's path would put
  two meanings under one key. `ad_request_id` is on both `ad_impression_value` and `ad_shown`, so
  revenue-per-path is a join and an honest one.
- **`path` on interstitial events.** There are no such moments there. `placement` already does that
  attribution, and `type=interstitial` is what tells a reader an absent `path` means
  *not applicable* rather than *unknown* (§1.7).
- **Changing `ad_load_crashed.reason`** (today a Java exception class, a different vocabulary from
  `ad_load_failed.reason` under the same key). Left alone: the two vocabularies never collide the
  way two integer tables did, and changing it would split a stored value's history. Open question
  below.

## Consequences

- `AGENTS-EVENTS.md` gains **§1.15 — one parameter name, one code space**, with the corollary that a
  constant `placement` is not attribution.
- `AGENTS.md` §5b: the build stamp was two releases stale (said 1.4.2 / vc 94, live is **1.4.4 /
  vc 97**); `app_open_ad_loaded` removed; `ad_impression_value`, `app_open_decision` and
  `ad_load_crashed` added.
- The backend needs **no** change: `AnalyticsEventRepository` matches these events by name and
  `placement` only, never by `code`, and the new keys land in the existing `params` JSON.
- Anything already reading `code` keeps working and keeps being wrong across the two events. The
  panel should group by `reason` (with `type`), and `code` becomes the raw backup.
- `unknown_<n>` is a row that must shrink release by release. If it grows, the SDK moved.

## Open questions for the owner

1. `elapsed_ms` on the ad events is `AppStartClock` — the **same number** the gateway already stamps
   on every event as `ms_since_start`. Keep the duplicate for a complete ads column, or drop it?
2. Nothing measures **time from request to failure**. That is the number the 6 s splash gate is
   really tuned against, and it needs a new parameter name (`ms_since_start` and `elapsed_ms` both
   already mean "since launch"). Add one?
3. `ad_load_crashed.reason` holds an exception class while `ad_load_failed.reason` holds an SDK
   error name. Rename the crash one to `exception` (splits that value's history) or leave it?
