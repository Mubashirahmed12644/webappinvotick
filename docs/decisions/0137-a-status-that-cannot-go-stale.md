# 0137 — A status that cannot go stale, and the sweep that finds the rest

- **Date:** 2026-09-20
- **Status:** proposed. Nothing built, nothing deleted, nothing deployed. Written as an answer to the
  owner's question; the three guards below need his word before anything is written.
- **Asked by the owner, 2026-09-20:** *"exchange ka wo code jo tm ny daikha ky push nhi howa, jabky
  exchange wala sara kaam already ho raha tha — to is terhan ky kitny or code hain jo bekaar pary
  hain? … Un sab ko achy sy check kero, phir achy sy confirm bhi kero, aur batao ky us code ka kia
  kerna chahiye taky next confusion na ho."*

Findings live in `memory/pending-work-queue.md` → **DEAD CODE AUDIT 2026-09-20**. This file is only
about the last part of his question: **how it stops happening.**

---

## 1. What the audit actually found, in one line

Very little of the code is dead. Almost all of the confusion is **writing that describes the system
wrongly** — a Status line, a comment, a version stamp, a branch name — and every one of them was
written by hand and then left behind by the thing it described.

The counts:

| kind | how many | worst example |
|:--|--:|:--|
| A decision that says "not deployed" about code that is **live in production right now** | **15** | 0131 says "Not deployed"; its commit `779e2d74` **is the image the container is running** |
| A comment, README or memory line that states something no longer true | **12** | `WEBPANEL_API.md`: *"Auth: **Not required** … intentionally public"* — those routes have been **admin-only since 2026-09-14** |
| Repo setting overridden in production with nothing in the repo saying so | 3 | splash ad wait: repo **6000 ms**, live **4000 ms** (Firebase Remote Config) |
| Branch that is finished and merged but still sitting there | 36 legacy + 10 worktrees | app `origin/main` — the repo's **default branch** — is **645 commits behind** the live code |
| Code that looks live and is not | 8 | `payment_added` — **half of the G1 definition** — has **0 rows in 30 days** while 958 payments sit on the server |
| Backend route with **zero calls in 8 days** of every vhost's logs | **20 base paths** | `POST /v1/billing/play/notifications` — Google Play's cancel/refund/expiry messages reach us **never** |

## 2. The shape of every one of them

The owner's own example says it best. `invotick-exchange`:

- the repo's `application.yml` says `frequency: daily` **and** `jitter-minutes: 5–15`;
- the **jar running in production** was built on 2026-01-03 and says `frequency: hourly`, `jitter: 0`;
- a systemd file nobody reads sets `EXCHANGE_FETCH_FREQUENCY=daily`, so **half** the fix is live and
  **half** is not;
- and the previous audit read a local `main` that had not been fetched, so it reported the branch as
  unmerged for 55 days when GitLab had merged it.

Four sources of truth for one setting. **Nothing lied. Everything was written once and then never
asked again.** That is the disease, and a rule that depends on a person remembering to update prose
is the same disease with a nicer name.

**So the principle: a fact that a human types is a fact that will go stale. The fix is to stop
typing facts and start computing them.**

## 3. Decision — three guards, cheapest first

### G1. The sweep script — `kaam/ops-scripts/sweep.sh` *(about half an hour to write, seconds to run)*

One read-only script, run whenever anyone wants, that prints for all five repos:

- every remote branch, marked **MERGED** (safe to delete) or **AHEAD n**, with its age;
- every worktree in `kaam/worktrees/` whose branch is already merged;
- every repo whose **default branch is not the deployed branch**.

It changes nothing and deletes nothing — the owner reads the list and says what goes. Today it would
print 36 legacy app branches, 10 finished worktrees and 2 wrong default branches in one screen.

**Cost:** one file, no deploy, no runtime, no risk.

### G2. A decision's status is computed, never typed *(1–2 hours)*

Every decision file gains one machine-readable line and **loses the words "not deployed"**:

```
<!-- ships: invotick-apis@fix/client-ip-trust=ebec825, invotick-admin-panel@feat/admin-devices=3ac91f2 -->
```

`docs/decisions/status.sh` reads those lines and answers from git alone —
`git merge-base --is-ancestor <sha> <deployed ref>` — printing **LIVE** or **WAITING** per decision.
The same check runs in the backend's CI, beside the 18 guard tests that already exist there
(`RoutesDeclareWhoMayCallThemTest`, `WebpanelReadsAreBoundedTest`, …), so a stale status becomes a
red build rather than a wrong sentence.

A status that is computed **cannot** go stale. That is the whole point, and it retires the single
largest source of confusion found today (14 documents).

**Cost:** one script, one trailer line per decision, one test. No production change.

### G3. A Health Centre card: *"the repo says X, production does Y"* *(about half a day)*

For the settings that live **outside** the JVM — systemd `override.conf`, Firebase Remote Config,
Vercel environment variables — no test can see them. A running check can.

One new `HealthCheck` component (per the owner's standing rule: **every check is a check in the
Health Centre, never a new page**) that, for a short declared list of settings, compares **the value
production is actually using** against **the repo's default**, and reports:

- **OK** — they match;
- **WARNING** — they differ **and** the difference is written down in `config/production-overrides.md`
  with its reason and date (e.g. the exchange frequency);
- **CRITICAL** — they differ and **nothing explains why**.

That last row is exactly the exchange bug, and it would have shouted on the day it was created
instead of waiting 55 days for someone to notice.

**Cost:** one `@Component`, one small markdown file, no migration, no schema change.

## 4. Rejected

- **A rule that says "always update the doc when you deploy."** Rejected: that rule already exists in
  spirit and was broken 14 times in six days, by careful sessions. A rule enforced by memory is not
  a guard.
- **Deleting the 36 legacy app branches now.** Rejected here: deleting is always the owner's word
  (`no-archive-verify-then-delete`), and the sweep script is what should hand him the list.
- **A dashboard page listing dead code.** Rejected: it would be read once. The value is in the check
  that fails, not the page that waits to be opened.
- **Rewriting the exchange jar's config into the repo and redeploying it.** Not rejected — just not
  this decision. It is a deploy, and deploys are the owner's word.

## 5. What this decision does not touch

The findings themselves. Nothing was deleted, no branch was removed, no comment was corrected and no
config was changed. Every item in the audit waits for the owner, one question at a time.
