# 0222 — An A/B Tests page that only reports

- **Date:** 2026-10-16
- **Status:** built, **not pushed, not deployed**. Backend `feat/ab-tests-endpoint` (worktree
  `kaam/worktrees/invotick-apis-abtests`), panel `feat/ab-tests-page` (worktree `kaam/worktrees/invotick-admin-abtests`).
  Gradle not run by the builder (the session that owns Gradle runs it).
- **Owner's order (2026-10-16):** one page in the admin panel that lists every A/B / holdout test the app runs, with
  the result of each in plain words. Mockup approved the same day (`kaam/research/ab-tests-page-mockup.html`).
- **Spec:** `kaam/research/ab-tests-page-spec.md`. **Numbers it must reproduce:** `kaam/research/ab-tests-status-2026-10-15.md`.

## What was decided

**Phase 1 is reporting only.** One read-only endpoint and one read-only page.

- `GET /v1/webpanel/ab-tests?platform=&from=&to=`, `@RequireRole(ADMIN)`, no write route anywhere (a test fails if
  one appears). Codes and numbers only; the panel writes every sentence in Roman Urdu, so wording never needs a
  backend deploy and the backend never states an opinion about an ad.
- The tests come from a catalog in code (`ExperimentCatalog`): tour holdout, French UI, translated UI,
  returning-splash wait. A new test is one entry plus a deploy; every test needs an app release anyway.
- **Who is counted:** release builds, one platform (filtered on the event, AGENTS-EVENTS 3.8), never the all-zero id;
  our own phones (`testing_devices` **and** the Health Centre's `health.our-own.*` list) set aside and counted;
  each phone once per test, at its first assignment in the range (`t0 = LEAST(event_timestamp, created_at)`, trap
  3.14); new installs only (a first-open cold start within 24 h of `t0`), except the splash wait (returning opens);
  a language phone with `released=true` counted apart, never as an assignment.
- **Outcomes** as the 2026-10-15 report: saved = `invoice_created_success`; G1 = `invoice_shared_success` or
  `payment_added` (decision 0006); return = a cold start in days 2–7. A phone counts in a window only once that
  window has fully passed (trap 3.15); the rest are shown as pending.
- **Confidence:** Wilson 95% per arm, Newcombe hybrid score interval on the difference, pooled two-proportion z (the
  Screen Map's own formula, held equal by a test), valid only with 200 finished phones a side and 10 of each outcome.
- **The badge reads G1 only** (PROVEN / LEANING / NOT_ENOUGH_DATA). About 20 numbers sit on a card and one p of 0.03
  among them can be luck. Saved and return are shown beside it and never move it. "About N more days" is planned at
  80% power on G1 7 d when valid, else 24 h, at each arm's recent daily intake; the slower arm sets it.
- **The tour leak** (Remote Config 0 since 2026-10-04, still ~4.5% of new installs without the tour) is shown as its
  own fact: since the first phone that reported Remote Config's 0, how many phones, per day, and share. The sentence
  says only an app release closes it, and only when the phones' own `percent_source=missing` rows show the app
  default in force.
- **Remote Config, read only:** the live value of each test's key through the push code's own service account and
  Firebase app (`push-<projectId>`), one call, `getTemplate()`. No new secret, no new scope. Any failure is `unknown`
  with a reason, and the page still shows what phones reported (`percent_source`, the app default per build).
  Note: Google has no read-only Remote Config scope and this key wrote the template on 2026-10-04, so "read only" is a
  property of the code, not of the key. `abtests.remote-config.enabled=false` turns the read off.
- **Safety:** every statement carries `MAX_EXECUTION_TIME(15000)`; one computation at a time on one worker thread
  (trap 3.5: a slow read plus a poll once took all ten pool connections); a caller waits at most 12 s, then gets the
  previous answer marked stale or a 503 `computing`/`busy`; a read MySQL stopped is 503 `too_slow`, never a partial
  number; cached 20 minutes per (platform, from to the hour, to to 20 minutes). A bare-date `from`/`to` is a 400
  (trap 3.13). At most 92 days. The page never polls: one retry after the 15 s the server asked for, then a button.
- **The splash-wait test touches the app-open ad.** Its card shows assignments only, asks the owner, and never
  recommends. Its outcome set (pass-through with earnings beside it) is agreed with the ads/billing owner before it
  is switched on, then built.

## Phase 2 is NOT built

Changing a test's share from the panel (spec §6: allow-list in code, ETag, single-key diff, passkey per change, audit
table, undo, Slack) is **designed only**. Nothing of it exists: no write endpoint, no audit table, no migration, and
**no button on the page, not even a disabled one**. The approved mockup showed a disabled "Hissa badlein" with a
"Phase 2 · baad mein" tag and an "Ad se juda: panel se kabhi nahi badlega" tag; all three were left out on purpose.
The owner's open questions from the spec (request button first, narrowing the push service account) stand.

## What it costs (§5a: how many rows does this touch?)

- **Assignments:** the four `*_assigned` events of the range through `idx_analytics_events_name_ts`, each row fetched
  for `params`: about 6,500 rows for the 16 days to 2026-10-15, about 12,000 for 30 days. Estimated 1–2 s.
- **New-install check:** per cohort phone through `idx_ae_instance_ts_cover` (ICP on name and time), fetching only
  that phone's cold starts of two days for `is_first_open`: two or three rows a phone.
- **Outcomes:** per cohort phone through `idx_ae_instance_ts_cover`, a covering index lookup (no row fetch), named by
  FORCE INDEX (decision 0141's trap; `AbTestReadsUseTheCoveringIndexTest` holds the join to covered columns). The plan
  is a lookup on `app_instance_id` with the 7-day window filtered inside the index, the same shape as Muqabla's
  measured read. **Estimate: about 1 million index entries for 30 days / ~7,000 phones, 4–8 s** (same index measured
  2.1–3.0 s for 5,131 phones over 24 h on 2026-09-21). A LATERAL form was tried and did not get a range access either;
  the plain join was kept.
- **Status:** the last 72 h of assignments (~1,000 rows) and four index-order walks with `LIMIT 1`.
- Answer: one small row per phone, capped at 30,000; all groupings made above the database, because each grouping
  in SQL would be another pass over the expensive join.
- **Not measured on production.** The builder had no read access. `EXPLAIN ANALYZE` on production (or the timing in
  the `[ab-tests] computed ... in N ms` log line after deploy) is owed before the page is relied on. **Plan B** if the
  read measures over 10 s: a rollup table `experiment_device`, like `device_journey` (0142).

## Rejected

- **A Health Centre card instead of a page.** This is analysis the owner opens on purpose, not a check that fails
  silently. A later check "a test meant to be off is still dealing phones" with this page as `detailPath` is a
  proposal; it was not added now because it would hang this 4–8 s read on the alerter's 15-minute cadence.
- **A badge from any metric** (the report's "one p of 0.03 among 30 numbers can be luck").
- **The Wald interval** the report used: it misbehaves at small counts.
- **Discovering tests from the events** (a parameter name is not a test; `splash_btn_variant` and others have one
  value): the catalog is explicit, and the non-tests are listed in a footnote so nobody re-asks.
- **Aggregating every grouping in SQL** (spec §3's "outer GROUP BY, ~40 rows"): five groupings would be five passes
  over the join. One capped pass of small per-phone rows instead, the shape `JourneyComparisonRepository` already uses.
- **A new or narrower Firebase credential for the read** (out of scope for phase 1; the owner's decision in spec §8.3).
- **A pre-computed rollup now** (§5a: pre-compute only what cannot be produced otherwise; it can be stale).
- **Auto-refresh / polling.**

## Deviations from the spec and mockup

- No phase-2 controls at all (above).
- `ui_translated`'s arm A is labelled `translated` (it pools every language); the per-language breakdown sits in a
  collapsed table, "too few to read" under 100 phones a side.
- The status pill shows the split the test is *set* to deal (e.g. 50/50) only when one value is in force and it is
  between 0 and 100; the arm boxes show what was actually dealt.
- "About N more days" takes the slower arm (spec: the smaller arm). French on the report's counts reads about 30
  days at 25 a day, not the report's 36: both arms need about 951 phones and English has 205.
- Phones needed per arm: French 951 (spec 949), translated 578 on whole-phone counts (spec 587, report about 580).

## Verification

- Backend unit tests (run outside Gradle with the project's Kotlin 1.9.25, 39/39): Wilson against textbook values;
  tour G1 24 h +4.0, z 2.39, p 0.017 and Newcombe within 0.5 of the report's intervals; French and translated LEANING,
  tour PROVEN; the z equal to `ScreenMapReads.compare`; the range rules (bare date 400, Web refused, 92 days); admin
  only, no write route; the Remote Config snapshot from a template shaped like the live one.
- The real SQL (`AbTestReads`) run through `NamedParameterJdbcTemplate` against a local MySQL 8.4 copy with synthetic
  rows: every exclusion (debug, iOS, ours by prefix, `testing_devices`, all-zero id, before the range, a second
  assignment, a released phone, an outcome before `t0` and after 7 days) behaves.
- `AbTestsOnARealDatabaseTest` (real MySQL, a tenth of the report's cohorts: French 92 / 76 new = 42 + 34; translated
  86 / 72; tour 381 / 39 with saved-24 h 21.3% / 12.8%) — written and type-checked, **to be run by Gradle**.
- Panel: `npx tsc --noEmit` and `npx eslint` clean; `npm run check:ab-tests` holds every sentence to the mockup on the
  report's numbers; checked in a local dev build against a mock of the endpoint at 390 px (page `scrollWidth` 390, no
  horizontal scroll) and at 1280 px, dark and light.
