# 0229 — The Release Impact mockup is approved, and four product goals lead every release reading

**Date:** 2026-10-19 · **Owner:** the owner, in chat · **Follows:** 0228

## Decided

1. **The Release Impact panel mockup is approved as published** (Artifact `JX9hmrQuGHjjppQeJfvAuM`, six frames). Build round 1 as
   designed: no new table, 1.5.3 against 1.5.2 first. The ten things frame 6 lists as "the design owner decided" stand
   until the owner says otherwise ("agar changes ki zaroorat hui to bataunga").
2. **Four product goals sit above every release reading.** The owner's words: engagement up, uninstalls down, retention
   up, LTV reached, so that a strong base makes a long-lasting profitable product. Every feature section, and the
   release scorecard, must say which of the four the change moves and by how much, next to its own primary KPI:
   - **Engagement** — active days per phone per week, invoices created per active phone, share of active phones that
     did a real action (invoice, share, payment).
   - **Uninstalls** — Play's uninstall figures by version, where we can read them (source pending the owner's
     permission, 0228); until then the proxy is phones that were active and then never again within 14 days, labelled
     as a proxy.
   - **Retention** — day 2-7, day 7, day 30 return of new installs (already in the plan), per version.
   - **LTV** — revenue per install over 30 days (ads from `ad_impression_value` plus premium net of store fee), with the
     buyer count beside it. Premium buyers are few (8 so far), so LTV is read as ad revenue per phone-day first, premium
     as a second line, and both say "data kam" until the counts allow.
3. **Rule for the verdict.** A change that raises its own primary KPI but lowers retention or LTV is not "Better": the
   release-impact agent writes it as ITERATE and names the trade, as a question to the owner. This does not touch the ad
   and paywall rule: no recommendation to remove an ad or paywall.

## Rejected / not done

- A fifth "overall score" number mixing the four goals: it hides which one moved.
- Reading LTV from premium alone: eight buyers cannot carry a verdict.

## What it asks of the build

The four goal KPIs are rows in the scorecard (frame 1) and in the KPI table of every section, each with n, minimum n and
the 95 % interval, like every other row. Definition of done is 0228 / `docs/measurement-definition-of-done.md`.
