# 0141 — Muqabla says why it is empty, reads the index built for it, and every filter on the page stays chosen

- **Date:** 2026-09-21
- **Status:** built and pushed, **not deployed**. Backend `fix/muqabla-reads-the-covering-index`
  (`d404abf` + `9d96b5c`, on `stage` 6bf2d78), panel `fix/muqabla-empty-says-why` (`2352ed8` + `71e201d`,
  on `main` c5a27fe). No migration. The first commit of each branch says "0140" in its message; that
  number went to billing's daily Play check the same day, and the follow-up commit renumbers the code.
- **Asked by the owner, 2026-09-21**, with a screenshot of Muqabla (compare by tier, 7 days, 1.4.7
  fixed, release, last 30 days — every cell 0): *"ye version apply kerny ky baad koi data nahi aya —
  isko set kero, aur is terha ky sary bug aur testing khud kero ky sary filter kaam kerny chahiye.
  Dosra, check kero ky jo ham ny isko fast kerny ka kaam kerna tha wo ho gaya hy ya nahi."* Then, on
  24 h: *"sab sy last text line 'invoice share ki' wali Tier 3 ka figure hide ker rhi hy"*.

## 1. The empty table was right; the page could not say so

Production, 2026-09-21 07:27 UTC, release, `is_first_open='true'` cold starts:

| build | devices | first first-open | done 1 h | 24 h | 3 d | 7 d |
|:--|--:|:--|--:|--:|--:|--:|
| 1.4.7 (106) | 1,212 | 2026-09-17 12:18 UTC | 1,189 | 862 | 226 | **0** |
| 1.4.6 (105) | 470 | 2026-09-15 10:27 UTC | 470 | 468 | 457 | **0** |

No 1.4.7 user can have had 7 days before **2026-09-24 12:18 UTC** (17:18 PKT). The backend's own query,
re-run by hand for the owner's view, gives 7 d waiting T3 962 / T1 137 / unknown 104 / T2 11 (his
screenshot: 950 / 134 / 103 / 11, a few hours earlier) and 24 h cohorts T1 113 / unknown 64 / T2 8 —
**exactly his 24 h screenshot**; T3 693 against his 666, more devices having crossed 24 h since. The
endpoint returned the right numbers.

**Built:** each group carries `nextReadyAt` (when its first waiting device will have had its whole
window) and `readyByWindow` (for 1 / 24 / 72 / 168 h, how many already have), counted from rows the read
already holds — no new read. When no column has anyone ready, the page replaces the table with one
paragraph: *"Is waqt (7 din) ke liye abhi koi user tayyar nahi … Pehla user 24 Sept, 17:18 ko tayyar
hoga"* and buttons *"3 din — 226 log · 24 ghante — 862 log · 1 ghanta — …"*. A column under 50 is named
with its count, how many are still waiting, and the shortest window in which every thin column has 50.
A zero column in a table that has others says *"abhi koi tayyar nahi — pehla <date>"*.

## 2. The overlap

`.live-table` is `table-layout: fixed; width: 100%`, which splits width equally, and the step name was
`white-space: nowrap`. Measured in Chrome (text right edge minus next cell's left edge, 11 rows):

| | 1440 px | 1024 px | 390 px |
|:--|--:|--:|--:|
| `main` | 2 rows over, share row **+124 px** | 7 rows over | — |
| this branch | 0 | 0 | 0 |

The ladder now sizes to its content, the name wraps inside its own cell, and the first column stays
pinned while the numbers scroll sideways on a phone.

## 3. Filters that did not stay — all found in a browser, all reproduced on `main`

| case | on `main` | now |
|:--|:--|:--|
| Muqabla: tab, compare-by, window, build, range, fixed filters after reload / Back / copied link | lost — plain `useState` | kept (URL names start with `c`) |
| Safar version picked → reload → screen funnel's App Version | **changed to Safar's build** (both wrote `ver`) | untouched (funnel uses `fver`, `fmode`) |
| screen funnel Mode "Strict" / "Any order" → reload | back to "Ordered" (codec allowed `UNORDERED`, a value the select never offers) | kept |
| Safar "All versions" → reload | newest build picked again | kept (`ver=all`) |
| a fixed campaign, or a version/source not in this range's list | applied while its select was hidden or read "sab" | the chosen value always shows |

Also: a fresh Safar open sent **two** 30-day reads (all versions, then the newest build): counted on a
production build, `main` 2, this branch 1. On production each is ~14 s of server time. And in Muqabla a
version says its platform: 1.4.7 is 106 on Android and 21 on iOS, and both columns read "1.4.7".

## 4. Speed — what the index work bought

Production, box quiet (load 0.26–0.9, no CI job), 30 days, release, the backend's own SQL, two passes:

| read | recorded before | after the 1 GB pool (0139) | **today** |
|:--|--:|--:|--:|
| Pehli invoice ka safar | 17.1 s | 14.3–15.6 s | **14.3–14.4 s** |
| Muqabla, compare by version, 24 h — as deployed | 10.8 s | 8.5–9.8 s | **7.0–10.8 s** |
| Muqabla, same, reading the covering index (this branch) | | | **2.0–3.0 s** |
| Live Events user list | 5.0 s | 4.3 s | **6.5–6.7 s** |

**The covering index delivered nothing on its own.** `idx_ae_instance_ts_cover` is on production (Flyway
V20260921_01, 21:15 UTC 09-20), but the query says `FORCE INDEX (idx_analytics_events_instance_ts)`, and
FORCE INDEX takes the choice away. EXPLAIN: *"Index lookup on e using idx_analytics_events_instance_ts"*
(one row fetch per event) today, *"Covering index lookup on e using idx_ae_instance_ts_cover"* with the
hint changed — same answer (5,131 devices, 4,776 judged, 974 made an invoice), **7.8–9.1 s → 2.1–3.0 s**.
0126 had said the code half ships separately; it never had. A test now fails the build if the hint goes
back or the join reads a column outside the cover (proven red with the old hint).

Safar does not use the cover (it reads `params`), so the index cannot help it; 14.3 s is the pool's
result and stays. The Live Events list is a full scan of 1.74 M rows (EXPLAIN: `Table scan on e`, 30 days
= 45 % of the table) and is slower than 0139's 4.3 s — not caused by this work, not fixed here; it is
now asked once a minute, not every 5 s.

## How it was tested, said plainly

No production admin credential exists on this Mac: the stored token answers 401, exactly as with no
token. So:

- **Numbers:** the backend's exact SQL, run read-only on production, for the owner's case and for
  every window.
- **Page:** a real Chrome (puppeteer), signed in through the panel's own login page, against this
  branch's backend jar on a throwaway local MySQL, filled with synthetic devices shaped like production
  (1.4.7 first opens from 17 Sep, the same tier / source / platform mix). A copy of production events on
  the Mac was refused, correctly. Results: **38/38** Muqabla cases (6 compare-bys × 4 windows, build
  release/debug/all, the owner's case at 7 d / 24 h / 1 h, version back to "sab", country only/except,
  tier, source, platform iOS/Android fixed, a 2-day range at 1 h and at 7 d); **11/11** sticky cases
  (reload, Back, a copied link in a fresh browser, the two collisions); Safar build/mode/version and a
  2-day range, Live Events build and version: **17/17** with a server call. Live Events role, sort and
  summary sort filter the loaded list in the browser, make no call, and survive reload (9/9).
- What this does **not** prove: the page against production's own response. That needs the owner's
  admin sign-in once the branches are live.

## Rejected

- *A per-device copy of production on the Mac* to test against real rows — refused by the permission
  system, and rightly: analytics rows are per-person.
- *Signing a token with production's `jwt.secret`* — forging an admin credential is not "signing in".
- *Hiding a window with no ready users from the picker* — the reader chose it for a reason; the page
  should say when it will fill, not take the option away.
- *Showing the steps with dashes under the notice* — rows of "—" are what read as "broken".
- *A default window of 1 h* so the table is never empty — a 1 h ladder is an early signal, not the
  answer, and the owner's question is usually the 24 h or 7 d one.
- *Letting the optimizer choose* (dropping FORCE INDEX) — this read has been mis-planned before without
  hints (0115); naming the cover is the same discipline with the right name.
- *Renaming the journey's URL names instead of the funnel's* — the journey's were first and are in links
  already sent.

## Open questions for the owner

1. Deploy both branches (backend first; the page explains without the date if the panel goes first).
2. The Live Events list is 6.5 s and scans the whole table. Worth a separate look (a `created_at`-led
   covering index, like this one), or leave it at once a minute?
