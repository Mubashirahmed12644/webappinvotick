# 0203 — Every line of an invoice is on exactly one page

- **Date:** 2026-10-03
- **Status:** built, not deployed. Web `fix/paged-frame-never-drops-a-line` (off `main`); app
  `fix/renderer-bundle-no-dropped-lines` (off `release/1.5.1`, the two bundle copies only). The app's bundle is built
  from `fix/paged-frame-bundle-source` = `feat/overpaid-balance-in-brackets` (`b20b72d`, where the shipped bundle
  `b9ac2f81` came from) + the same fix, md5 `cae51ddb039a08e130f4b9687ada8acd`.
- **The defect (G3):** a 45-line invoice whose lines wrapped showed lines 1–21 on page 1 and 26+ on page 2; lines
  22–25 were on no page — on screen, in the received invoice's PDF and on paper — while the total still counted them.
  Found by the Print work (0202), present on the baseline build.
- **Root cause:** `A4PagedFrame` measured one table row, the first, and took its height for every row. A line whose
  description wraps is taller. A tall first line made every page look roomier than it was: the page was given more
  lines than fit, and the ones past its bottom were cut off by the sheet's `overflow: hidden`. A short first line made
  the opposite error: a page per line (a mixed 100-line invoice took 100 pages).
- **Decision:** pagination is decided from the height **every line actually rendered at** in the hidden measuring copy
  (`src/lib/paginate-rows.ts`, pure). Rules kept: pages without the summary are filled; the last page carries the
  summary; the summary is never alone **unless** the last line and the summary cannot share a page (a line of hundreds
  of characters), when the summary takes a page of its own rather than either being cut. Blank padding to the native
  nine rows only with rows that fit.
- **Also fixed, same root:** a measuring copy with no layout (hidden, or print media, which hides `.a4-measure`) no
  longer re-cuts the pages from zeros. Under emulated print media the old code read every row as 0 px and put the
  whole invoice on one page, cut at its bottom (248 of 266 documents in the check). Whether a real browser print
  re-measures before printing was not proven; the check now covers it either way.
- **Proof:** `scripts/checks/run-paged-rows-check.mjs` opens the real offline bundle in headless Chrome, sets each
  document through `window.__setInvoice`, and asks of every line which page shows it in full (inside every clipping
  box, clear of the footer band); every line once, in order, every summary block whole; screen and print media.
  266 documents (1–100 lines; short, wrapping, mixed, first-line-long; with and without totals rows, notes, terms,
  signature, header, premium footer; estimate; de, ar, fr, zh; the longest stored line, 746 characters):
  **532 readings, 0 fail with the fix; 269 fail on the old frame (21 screen, 248 print); 269 fail on the bundle the app
  ships today.** Documents whose lines do not wrap paginate exactly as before (166 of 166 identical splits); English
  golden 72/72; `paginate-rows.test.ts` +7. App gate (testDebugUnitTest + nonAndroidTests + iOS simulator compile, `--rerun-tasks`, every XML
  incl. `__TEST-*`): **2,875 tests, 0 failures, 2 skipped — the same as `release/1.5.1` (`d7579a1a1`) run the same way**;
  dark gate: dark defects 0 (baseline 0), 0 of 126 light pictures moved (the WebView is not drawn there).
- **Exposure (production, read-only, 2026-10-03, our test accounts excluded):** 9,286 invoices with lines; 204 have 15+
  lines (73 users), 106 have 20+, 14 have 45+; estimates: 9 with 15+. Shared links: 36 ever with 15+ lines (30 in the
  last 30 days, of 1,808). Only line-name **lengths** were read, never the text; each document was rebuilt with
  synthetic words of the same lengths and run through the old bundle: **0 of 213 documents and 0 of 36 links drop a
  line** in ordinary text; in an all-capitals worst case **1 invoice** (100 lines, first line 25 characters) drops 37
  lines. The defect needs the first line to wrap while later lines do not, which real invoices rarely do. With the fix
  those 213 documents keep exactly their page counts (468 pages before and after).
- **Where it lands:** the web share page and `/embed/render` draw with the deployed code, so **every existing shared
  link is fixed on the web deploy** — the snapshot is frozen, the frame drawing it is not. In the app (preview, saved
  invoice, received invoice and its PDF/Print) it lands with the release that carries the new bundle.
- **The native Compose renderer** (`invoicePdf`) still makes the sender's PDF, Print and share image. It already
  paginates from each row's own measured height (`ItemTableModule.computePages`) and draws each page's columns at least
  as wide as the ones it measured with, so it does not share this defect (code reading, not run against these
  documents).
- **Rejected:** a bigger safety margin or a capped rows-per-page (still an estimate that can disagree with the browser);
  truncating long descriptions (hides what the user wrote); a guard that hides a line it cannot place (a quiet loss is
  the defect itself); splitting one row across two pages (no real line needs it: the longest stored, 746 characters,
  fits a page).
