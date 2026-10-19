# A feature is not done until the panel can measure it, and that was tested with made-up numbers

**Standing instruction from the owner, 2026-10-19:** every feature we want to measure on the admin panel gets its
measurement code written **in the same breath** as the feature, is tested with **invented numbers**, and the whole
road the data travels is tested end to end, so that no bug first shows up on live data.

This is a rule about when work counts as finished. A release that ships a feature whose number nobody can read has
shipped half a feature. (1.5.3 shipped four events nobody reads yet; that is the debt this rule stops.)

## The seven things, in order, for each feature that is to be measured

1. **Write the question down first.** In the decision file: the ONE number the owner will read, its denominator,
   the declared expectation ("this should raise X, and must not hurt Y, Z"), and the guardrails. The page later
   shows expectation against result, so a result is never explained after the fact.
2. **The events** follow `AGENTS-EVENTS.md` (one action one event, parameters, ids are join keys, absent = unknown).
3. **The measurement code ships with the feature**, in the same set of branches: the backend query or rollup
   (bounded, with a date range, counted in SQL, see section 5a of `AGENTS.md`), the panel endpoint and the page or
   card. Not "later".
4. **A synthetic data set with a known answer.** A generator inserts invented events for the feature (several
   devices, versions, countries, platforms, our own test devices that must be excluded, duplicates, late and
   out-of-order batches, an old build under the version floor). It also writes the numbers the panel must show,
   worked out by hand or by an independent second implementation, never by calling the code under test.
5. **The data-travel test.** The invented events are sent through the REAL road, on a throwaway backend and
   database (the harness of decision 0141: the branch jar against a throwaway DB, real Chrome for the page):
   app-side payload shape -> `POST /v2/analytics/track` -> stored rows -> the panel endpoint -> the page. The test
   asserts the exact numbers at the endpoint and on the page. It must be able to fail (break one step on purpose and
   see it go red; `a-check-that-cannot-fail`).
6. **The silence check.** A Health Centre check says whether the feature's event is arriving (zero rows = "no data
   yet", never OK), per version, so a feature that stopped reporting is visible the day it stops.
7. **Small numbers are labelled.** Every figure shows n; below the threshold the panel says "not enough data" in
   grey and never a green or red verdict. An experiment arm shows both arms and the confidence interval.

## What "done" means in a release gate
- The decision file names the number, the denominator, the expectation and the guardrails (item 1).
- The measurement tests (items 4 and 5) are part of the gate and pass; the synthetic expected numbers are in the repo.
- The panel page or card for the feature exists, reads real endpoints and shows an honest empty state before data.
- The silence check exists (item 6).
- Anything not measurable is written in the decision as a limit, in plain words.

## Who does it
Each owner agent (user-journey for funnels and events, billing for premium, sync for sync) writes the measurement
spec; the panel work and the harness test go to the agent that builds the feature, in the same work order, so the
brief for every feature that can be measured carries items 1 to 7.
