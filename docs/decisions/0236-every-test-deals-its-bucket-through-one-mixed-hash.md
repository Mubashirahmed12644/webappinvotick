# 0236 — Every test deals its bucket through one mixed hash; 1.5.5's forms and gate tests are read by cell

**Date:** 2026-10-27 · **Decided by:** the owner ("Bucket bug ka fix 1.5.6 ke liye tayyar karo, release mat karna") ·
**Applies to:** app 1.5.6 (branch `fix/156-independent-test-buckets` in `invoice-kmp-app`, cut from `release/1.5.5` @ `754d509db`,
**not released, not merged**) and to how everything dealt by 1.5.5 is read.

## What was measured
- On production (`analytics_events`, read-only, 2026-10-27): for **all 1,319 phones** that hold both a forms arm and a gate arm,
  `(gate bucket - forms bucket) mod 100` falls in **60 to 69**. The post-arm bucket against the forms bucket is spread evenly over
  all ten bins (126 to 157 each), so the query can tell the two cases apart.
- Consequence at a gate share of 50 %: forms `control` phones were dealt gate `move` about **70 %** of the time, forms `order_a`
  (tabs) phones about **30 %**. At 20 % (22 and 23 Oct) it ran the other way. The gate move itself adds about 16 to 24 points of
  "invoice created in 24 h", so the first read of the tabs (-8.5 points) was mostly the gate, not the tabs.
- The four cells (24 h, phones dealt before 2026-10-26 10:00 UTC; created / G1 as counts): control+move 226 (100 / 47),
  order_a+move 131 (45 / 19), control+show 299 (61 / 35), order_a+show 386 (70 / 43). Memory
  `forms-gate-buckets-correlated-2026-10-27.md` has the reading.

## Cause (reproduced, not guessed)
Every test dealt its bucket with the same loop: FNV-1a over `salt:id`, then `% 100`. The salt comes first, so it only moves the
starting point of the hash; the id's bytes are folded in after it, and the difference between two salts stays (almost) the same
for every id. Run offline over 20,000 random ids with the app's own arithmetic, forms to gate landed on **one** decade of offsets
for 100 % of the ids. Second flaw, found by the guard test: FNV-1a keeps its lowest bit as the xor of the input bytes' lowest bits,
and 100 is even, so **any two tests agree on odd/even for every id** (28 of 28 pairs, chi-square 30,000 on 30,000 ids).
Only forms x gate is tied at the level of an arm (decade); the other pairs are tied by parity only, which moves no arm cell at the
shares in use, but a future share at an odd number would have felt it.

## Decision
1. **One helper**, `ExperimentBucket.of(salt, id)` in `core/common` (`experiment/ExperimentBucket.kt`): FNV-1a 32-bit over the UTF-8
   bytes of `salt:id` (unchanged), then murmur3's 32-bit finalizer, then `% 100`. The finalizer is a bijection that carries every input
   bit to every output bit, so a fixed difference between two salts no longer survives.
2. **Every dealer goes through it:** forms and post (`FirstFormsSplit`), the gate (`FirstInvoiceGateSplit`), nudges, signup, the
   onboarding overlay, both interface-language tests (`UiLanguageHoldout`) and the returning-splash wait. Nothing else changes: same
   functions and signatures, 0 to 99, same thresholds, same salts (not re-versioned), same event parameters (`bucket` still 0 to 99).
3. **Three guards:**
   - `TheTestsDealIndependentBucketsTest` (domain): the same 30,000 invented ids through all 8 dealers' real bucket functions; every
     one of the 28 pairs must pass a decade chi-square, a fixed-offset chi-square and an odd/even chi-square, plus the four-cell shares
     for forms x gate at 20 % and 50 %. It **failed on the 1.5.5 code** (4 of 5 tests; forms to gate: 20,815 of 30,000 ids on a single
     offset) and passes on the fix.
   - `ExperimentBucketTest` (core/common): pinned values for every salt, computed independently in Python, so Android and iOS cannot
     drift apart.
   - `EveryTestDealsItsBucketThroughTheOneHelperTest` (composeApp, reads the source): the FNV offset basis appears only in the helper
     and in two things that are not buckets (the legacy-file row checksum, the runtime-text resource name); each dealer calls the helper;
     no bucket is made from `hashCode()`.

## Phones already dealt
**They keep their arm.** Every one of these rules returns the stored arm before it looks at a bucket (`Keep(stored)`); checked in the
code of all eight. So nothing a 1.5.5 phone sees changes. Two small things:
- A guest who has not yet been dealt the signup arm reads the arm its bucket would give (`armNow`, for the standing icon). After the
  update that bucket is a different one, so such a phone's icon can differ once from the day before; nothing is stored differently.
- Phones dealt by 1.5.6 onward are a **new population** with independent buckets. They are not comparable to the 1.5.5 phones as one
  pool unless the build is a stratum.

## How the tests are read
- **1.5.5 phones: forms and gate by the four cells, never by the per-arm totals.** The Release Impact panel's per-arm rows for those two
  tests are contaminated until 1.5.6 spreads, and every verdict on them must say so (registry rows 158 and 160 now say it).
- The post test (preview-first) was never tied to either; its totals stand.
- Signup and nudges against forms/gate were **not measured on production**; the offline replay says they are tied to them by
  odd/even only.
- 1.5.6 phones: read each test by its own arms, by build.

## Options considered and rejected
- **Reset or re-deal the stored arms of 1.5.5 phones.** Breaks "dealt once", throws away what is running, and a phone would meet a
  different screen from the one it learned.
- **Change only the salts.** A salt can only move the start, which is the flaw; no salt removes a constant offset or the parity tie.
- **Subtract the observed offset (about 65) from the gate bucket.** Mends one pair, hides the rest, and breaks the day any salt changes.
- **Deal the arms on the server.** Would work, but a phone needs the network at first open and the tests are dealt offline; a far
  bigger change than the fault.
- **Fix only in the panel (stratify) and leave the app.** Needed anyway for 1.5.5 phones, but it leaves every future test exposed.
- **Leave overlay, language and splash-wait on the old loop** (they are off or mostly finished). Leaves the parity tie in the code, and the
  next copy-paste would start from it; one helper, one guard is the point.

## Verified (2026-10-27, on the branch, build cache off)
- Tests that ran fresh and passed: `core/common` 132, `domain` 380, `core/ads` 214, `feature/document/invoice` 397, and the
  source guard in `composeApp` 3 (1,126 in all, 0 failed). `:core:common`, `:domain` and `:core:ads` also compile for the iOS simulator.
- Eleven old tests pinned bucket numbers or relied on one id landing in one arm (`device-a` was `move` at 20 %). They were moved to the
  new values, or to an id that lands in the same arm under the new hash (`phone-1` for `move`, `device-b` / `device-a` for the forms
  switches); no assertion was loosened.
- **Not run:** the full release gate (`testDebugUnitTest nonAndroidTests ... --rerun-tasks` across every module), because nothing is being
  released; it is the first step if the owner says go. No device check: the change has no screen.

## Not done, and what needs the owner's word
- **No release.** No version bump, no tag, no Remote Config write, no deploy, nothing merged into `release/1.5.5`. Releasing 1.5.6 is
  the owner's word (standing rule).
- The Release Impact panel does not yet show the four forms x gate cells as a table; it needs its own measurement work (decision first,
  invented numbers through the real road, per `measurement-definition-of-done.md`).
