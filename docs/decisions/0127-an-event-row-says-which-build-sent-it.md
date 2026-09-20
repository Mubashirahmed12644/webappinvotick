# 0127 — An event row says which build sent it, on screen and in the copy that gets pasted

- **Date:** 2026-09-20
- **Status:** built. Backend `invotick-apis` `feat/live-events-show-build` (`776506b`), panel
  `invotick-admin-panel` `feat/live-events-show-build` (`43b6571`, stacked on
  `feat/live-now-stream` because both change the Live Events page). **Not deployed.** No migration.
- **Asked for by the owner, 2026-09-20:** *"jo main ny tmhain event ki list bhaiji thi sync and ads
  ki, us per kia app version mention nhi tha? ager nhi tha to usko kero — ager wo mention hota to
  itna time zaya na hota."*

## Decision

**Every row the Live Events feed prints names its build — version name and build number,
`1.4.2 (94)` — on screen, on every exported line, and in the export's header block. When a device's
rows span several builds the header says so in capitals.**

## Why

On 2026-09-19 the owner exported a device's feed and sent it to be diagnosed. Every line carried the
build **type** — `release` or `debug` — and nothing about the build itself. A full measuring pass
ran before the behaviour turned out to belong to **1.4.2 / versionCode 94** and to have been fixed
two releases earlier.

This is the same failure as decision 0115's note on the feed's `userId`: *a row that cannot say
whose it is can only be trusted while nobody puts two of them side by side.* A row that cannot say
which build it came from can only be trusted while every row is from the same build — and nothing on
the page guaranteed that, because the feed is stitched across a device's whole history.

**The mixed case is the one that misleads**, so it is stated rather than left to be noticed:

```
# Live Events — Invotick ID INV-10293, user 8f1c-…-42ab
# filter: release · all versions
# build: MIXED — 1.4.7 (106), 1.4.2 (94), —. Read every line's own build before comparing them.
# 4 events, oldest first, copied 2026-09-20T12:00:00.000Z

  1  2026-09-19 13:15:04.123  [1.4.2 (94)]  app_cold_start
      screen=splash_scr  params={"is_first_open":"true","build_type":"release"}
  2  2026-09-19 13:15:09.880  [1.4.2 (94)]  sync_failed
      screen=db_scr  params={"stage":"push","reason":"invalid_token"}
  3  2026-09-19 13:16:00.000  [1.4.7 (106)]  ad_load_failed
      screen=splash_scr  params={"reason":"no_fill"}
  4  2026-09-19 13:16:30.000  [—]  shared_invoice_page_view
      screen=-  params={"link_state":"active"}
```

## How

- **Backend.** `LiveEventDto` gains `appVersion` and `appVersionCode`, read straight off the
  `AnalyticsEvent` the feed has already loaded. **No second query, no new index, no extra column
  read** — the columns were always there and were simply not passed on.
- **Two fields, not one.** Only the integer can be compared: `"1.4.10"` sorts *below* `"1.4.9"` as
  text, so any "this build or newer" question needs the code to ask it with.
- **Null is unknown, never a guess.** A row with no version prints an em dash. Web rows carry none
  (decision 0045), and neither do the oldest app rows.
- **Where it sits.** On screen, a `Build` column between the event and the platform. In the export,
  on the **first** line beside the time — not in the params blob, which is where things go to be
  scrolled past. The export is pasted into chat, so it has to read at a glance.
- **The event-totals Copy button gets a header block too** — build, versions, range, copied-at. It
  had none at all, and a table pasted with no build on it is the same trap in a different shape.
- **`buildStreamReport` and its helpers move to `lib/streamReport.ts`.** This is the copy that gets
  believed: the page can be re-read, the pasted text is what arrives in chat. A pure function with
  no component around it can also be run and its output read directly, which is how the sample above
  was produced.

## Verified

- `AFeedRowNamesItsBuildTest` holds both fields and the mapping, and was **proven red first**: with
  the two fields taken back out, both of its cases fail. Full suite **1,231 tests, 0 failures**.
- The panel has no test suite, so the exporter was run in a real browser against `next dev` on a
  throwaway page, since deleted, for both the one-build and the mixed-build case. The output above
  is that run.
- `tsc --noEmit` clean, `next build` green, lint unchanged at 27 problems / 7 errors, all
  pre-existing on `main`.

**One thing found and *not* a defect.** The first probe printed the body newest-first under a header
saying "oldest first". The fixtures were wrong, not the code: the page holds the feed newest-first
(it sorts descending on `eventTimestamp`) and the exporter reverses it. Written down so the next
reader does not re-find it as a bug.

## Rejected

- *Putting the version in the params blob.* It is already effectively there on some rows
  (`build_type`), and that is exactly where it was missed.
- *Showing only the version name.* `1.4.10` against `1.4.9` cannot be ordered as text, and every
  "which build" question is an ordering question.
- *Filling a missing version from the session, or from the device's other rows.* A guess that looks
  like data is what this decision exists to remove.
- *Only the header, not every line.* The mixed-build case is the expensive one, and a header alone
  cannot tell the reader which line belongs to which build.
- *A separate query for the version.* The event already carries it; a panel read that adds a query
  to print a column it already has is decision 0034 in miniature.

## Open questions for the owner

1. Deploy order: the panel commit needs the backend one. Sent alone, every row prints an em dash —
   honest, but useless. Ship `776506b` first, then `43b6571`?
