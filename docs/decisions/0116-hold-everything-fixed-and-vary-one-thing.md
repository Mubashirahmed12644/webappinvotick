# 0116 — Hold everything fixed and vary one thing; a Meta install names its campaign only through Meta's key

- **Date:** 2026-09-19
- **Status:** built by the user-journey agent on branches, not deployed. The owner asked for both parts on 2026-09-19:
  - "3 dino sy high tier countries per alag sy campaign start ki hy fb per — kia hamary admin main alag campaign ki
    id sy tracing nhi ho sakti";
  - "sari cheezain same rakh ker kisi aik cheez ko compare kerny wala mechanism banao — for example country wise
    different versions ka kia result hy".

  Branches: backend `invotick-apis` `feat/journey-compare-by`, panel `invotick-admin-panel` `feat/journey-compare-by`.
  The choices marked *(agent)* are the owner's to confirm.

## Decision

1. **Funnel Analysis' second tab becomes "Muqabla".** It has one "compare by" selector: version, country, country
   tier, install source, ad campaign or platform. Every other dimension can be held at one value.
   - It is served by `GET /v1/webpanel/analytics/journey-compare` (`@RequireRole(ADMIN)`).
   - It keeps 0114's rules: each device is read over the same window from its own first open (1 h, 24 h, 3 d or 7 d).
     A device whose window has not passed is counted apart. Wilson intervals are shown. "Behind" or "ahead" is marked
     only when |z| ≥ 1.96 and both groups have at least 50 devices.
   - It shows at most six groups side by side. By default these are the six largest cohorts.
   - The same dimension cannot be varied and held fixed at once (400).
   - `journey-comparison` (0114) is kept for the panel build that still calls it. It is now served by the same read,
     and its real-database test passes unchanged.
2. **The calendar is reported, not only warned about.**
   - For each group, the panel shows what share of its cohort first opened inside the stretch that every shown group
     shares.
   - The warning says `apart` when there is no shared stretch, and `partly` when a group has under half of its cohort
     inside it.
3. **One ladder.** The step CASE is `JOURNEY_STEP_CASE`, which the journey uses. 0114's copy is gone, and
   `JourneyComparisonStepsMatchTheJourneyTest` now fails the build if a copy comes back.
4. **The install source is found by the device and the time, not by the window.**
   - The source is the device's earliest `install_referrer` between one hour before its first open and the end of the
     window.
   - It is the `utm_source` value exactly as sent (AGENTS-EVENTS 1.16).
5. **Campaign = Meta's campaign id, read with Meta's key; or our own three tag values together.**
   - Meta's payload is opened in the backend (`MetaInstallReferrer`, AES-256-GCM). The key is read from
     `META_INSTALL_REFERRER_DECRYPTION_KEY` in `.env.prod`. Nothing decrypted is stored.
   - With no key, every Meta install shows as one group, "campaign locked".
   - Our own tags are `utm:<source>|<medium>|<campaign>`.
6. **Country tiers are defined in one place**, `CountryTiers` in the backend, and the panel prints the list next to
   every tier comparison. *(agent: the list)*
   - T1 = US CA GB IE AU NZ DE FR NL BE LU AT CH DK SE NO FI IS.
   - T2 = IT ES PT GR MT CY PL CZ SK SI HR HU EE LV LT RO BG JP KR SG HK TW MO IL AE SA QA KW BH OM BN.
   - T3 = every other known country.
   - `unknown` is never folded into T3.

## Why

**What production says about the two campaigns (read-only, 2026-09-19).**

| install_referrer, 09-10..19 | rows |
|:--|--:|
| `apps.facebook.com` · `fb4a` | 2,358 (plus 1 with `referral`) |
| `apps.instagram.com` · `ig4a` | 56 |
| …with Meta's encrypted `utm_content`, app id 27910947588558378 (ours) | 2,414 of 2,415 |
| `(not set)` | 481 |
| `google-play` · organic | 130 |
| ours: `facebook · cpc · android_installs_2026q3` | 2 |
| ours: `google_ads · cpc · android_installs_2026q3` | 1 |

- The new campaign produced **no new plain value**. Every Meta install says `fb4a`, before 09-16 and after it.
- By every field the app reads in plain text, the two campaigns are one.
- The only thing that names the campaign is the encrypted payload, and it is already stored whole on every row since
  July. That makes the key retroactive.
- The indirect trace is visible. T1 first-time devices went from **2–8 a day** (09-10..16) to 11 on 09-17, **59** on
  09-18 and 17 on 09-19 (to midday). Of the 59, 55 were `fb4a` and 2 `ig4a`. France alone went from 12 in eight days
  to 35 in a day and a half, and DE, GB, SE, IE and NL rose with it. So the new campaign's installs began arriving on
  09-17/18, and they land on 1.4.7 (vc106).
  This is a correlation. Only the key turns it into a count per campaign.

**The first answer to "country wise different versions".** Release builds, first opens 08-20..09-19, and every
device read over the same window from its own first open. The metric is "made an invoice" (rung 8).

| tier | 1.4.2 (94) | 1.4.4 (97) | 1.4.5 (101) | 1.4.6 (105) | 1.4.7 (106) |
|:--|--:|--:|--:|--:|--:|
| T3, 1 h | 157/822 = 19.1 % | 217/1136 = 19.1 % | 202/1019 = 19.8 % | 70/407 = 17.2 % | 74/478 = 15.5 % |
| T3, 24 h | 176/834 = 21.1 % | 237/1158 = 20.5 % | 225/1022 = 22.0 % | 79/410 = 19.3 % | 41/236 = 17.4 % |
| T1, 1 h | 1/19 | 3/25 | 6/18 | 1/5 | **6/82 = 7.3 %** |
| T1, 24 h | 1/19 | 3/25 | 6/20 | 2/5 | 4/41 (+41 not yet) |
| unknown, 1 h | 8/78 | 9/134 | 9/111 | 2/43 | 4/48 |

- **Within T3, 1.4.7 against 1.4.5:** z = -2.02 at 1 h, which is past the line. At 24 h it is -1.57, which is not.
  1.4.7 against 1.4.6 is z = -0.69 (noise).
- The drop that 0114 saw is still there when the countries are held fixed. But the builds' calendars do not overlap:
  1.4.7's T3 users came on 09-17..19, and 1.4.5's on 09-12..19.
- **Within 1.4.7, T1 against T3:** 7.3 % against 15.5 % at 1 h, z = -1.95. That is just short of the line, with 82
  devices. The new campaign's users make their first invoice at about half the rate of the old audience, on the same
  build and on the same days. The confirmed-share rate follows the same pattern (3/82 against 32/478), z = -1.05.
- Every other T1 cell is under 50 devices: no verdict.

**Two facts found on the way, now rules:**

- **`install_referrer` is stamped before the first open.** Of 961 first-open devices of 09-15..17:
  - 597 had it after the first open;
  - 322 had it under a second before;
  - 3 had it under ten seconds before, 3 within the day, and 8 from an older install;
  - 28 never had it.

  A window that starts at the first open therefore reads 38 % of devices as having "no install referrer". Measured
  on the real-database test: without the one-hour lead, every seeded device fell into `no_referrer`.
- **The comparison read is cheap enough without a migration.** EXPLAIN ANALYZE on production, 30 days, every release
  build, 4,535 devices:

  | window | time |
  |:--|--:|
  | 1 h | 6.1 s |
  | 24 h | 7.8 s |
  | 7 d, all devices read to the end of the window | 12.1 s |
  | 7 d, too-recent devices read for their first hour only (built) | 9.8 s |
  | one build (620 devices) | 1.0 s |
  | the install referrers of the range (4,586 rows) | 0.07 s |

  A one-pass clustered scan was measured too (12–19 s) and was not faster.

## Campaign tracing: options weighed

| option | what it needs | what it gives | verdict |
|:--|:--|:--|:--|
| (i) URL parameters in Ads Manager (`utm_campaign=…`) | a field in Ads Manager | nothing for app-install ads: the Facebook app hands Play its own referrer. Measured: 0 non-`fb4a` Meta rows since the second campaign began | **rejected**: the data proves it does not arrive |
| (ii) Meta's install-referrer payload, opened in the backend | the owner's "Install Referrer Decryption Key" in `.env.prod`; the backend code (built) | campaign and ad set per install, for every stored install since July (retroactive), inside our own per-device funnel | **chosen** |
| (ii-b) Meta Install Referrer content provider (`com.facebook.katana.provider.InstallReferrerProvider`) read by the app | an app change and a release, plus the same key | also view-through and multi-session installs that the Play referrer misses (part of `(not set)`) | later, only if (ii) leaves too many Meta installs uncounted |
| (iii) Ads Manager's own reporting (the Facebook SDK is in the app) | nothing | installs and cost per campaign, in Meta's count | kept as the cross-check for (ii), because it cannot join our funnel per device |

## Rejected

- *A version-only endpoint with more filters.* The owner asked for "any one thing" to vary. Six copies of one idea are
  what one "compare by" replaces.
- *Grouping in SQL.* The campaign cannot be read in SQL, because MySQL's AES has no GCM mode. The install source comes
  from a second read. One small row per device, capped at 20,000, is what the journey page already reads.
- *Joining `install_referrer` inside the device window.* It misses a third of sources (see Why).
- *Matching `utm_content` by a leading `{`.* Hibernate reads braces in a native query as its own placeholders. The
  payload is matched with `JSON_VALID` / `JSON_CONTAINS_PATH`.
- *Storing the decrypted campaign on the event, or in a new table.* The first changes what the app sent. The second
  needs a migration. Decrypting at read time costs a few milliseconds for a month.
- *Folding `unknown` country into T3.* 355 of 4,535 devices (8 %) carry no country inside 24 h, and they convert at
  about half the rate. Folding them in would lower T3 by a bias of its own.
- *Asking for the key in chat.* It goes into `.env.prod` on the server.

## Cost

Two reads per request: first opens with their window (6–10 s for a 30-day, all-build range; about 1 s with a build
held), and the range's install referrers (under 0.1 s). No migration, no new index, and no app release.

## Open questions for the owner

1. Put the Meta "Install Referrer Decryption Key" into `.env.prod` as `META_INSTALL_REFERRER_DECRYPTION_KEY`?
   - Where to find it: Meta app dashboard (app 27910947588558378) → App settings → Basic → Android → "Install
     Referrer Decryption Key".
   - After the next deploy, "Muqabla: Ad campaign" splits the Meta installs by campaign, the old ones included.
2. Is the T1 list the one your high-tier campaign targets? If it is not, send the country list, and T1 becomes exactly
   that list.
3. The new audience makes its first invoice at about half the old audience's rate (7 % against 15 % in the first hour,
   82 users). This is not yet a verdict. Keep the campaign running until T1 on 1.4.7 has 200+ users, and then read it
   again?
