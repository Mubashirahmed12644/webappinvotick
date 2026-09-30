# 0197 — The PDF viewer records its taps, and a Download says how it ended

**Date:** 2026-09-30, the pending item "PDF viewer ke taps ki ginti" and memory's "download has no result event".
**App:** `feat/pdf-viewer-events` @ `de0df1c3a`, off `release/1.5.1` (`f0ba99de2`). Not merged, not released.
Gate (`--rerun-tasks`, every XML): Android 2387 (+16), jvm 130, iOS-sim 138 (+6), 0 failures. Red without the wiring:
the viewer's 3 of 3, the received invoice's 1 of 4. **Schema:** none.
**Backend / panel:** nothing needed — both are coded or auto events on the existing `/v2/analytics/track`.

## What production said (read-only, `event_timestamp` bounded on both sides, release builds)

| Question | Answer |
|:--|:--|
| Rows for any `PdfViewerActivity.*` identity, 60 days, every build, debug included | **0** |
| `screen_view` `pdf_viewer`, 60 days | **0** (added by 0190 on `release/1.5.1`; no shipped build has it) |
| The viewer's only trace on 1.4.9 | one `error_shown` `load/other` with `screen_name = NULL` (its load-failure sentence) |
| Download presses, 30 days | saved invoice `save_inv_download_click` **2,360 / 1,009 phones**; estimate 115 / 34; received invoice 61 / 26; ledger 55 / 32 |
| How many of those wrote a file | **not knowable**. On 1.4.9 the saved-invoice screen had 137 presses / 71 phones and 14 `error_shown export/invoice` / 6 phones — but that sentence is shared with the same screen's share-PDF path |

## Why the viewer sent nothing

`PdfViewerActivity` sets its own content. The auto-tap logger (`LocalUiActionLogger`) was a lambda inside `App()`,
which is `MainActivity`'s composition only. `guardedTrackedClick` found no logger in the viewer and recorded nothing,
in every build — while each of the four buttons carried a stable id. The system Back, which takes a receiver out of
the app, had no row at all.

## Decided

1. **One auto-tap logger for every window** — `AutoTapLogger.create` (`core/analytics`), used by `App()` and by the
   viewer. The viewer provides it and its own screen id (`pdf_viewer`, the name its `screen_view` carries, §1.2).
   Its taps arrive as `tap:pdf_viewer:PdfViewerActivity.close_1 | .share | .print | .create_yours_1`.
2. **The arrow and the system Back are one close event** (§1.1, §1.11): `tap:pdf_viewer:PdfViewerActivity.close_1`
   with `method` = `close_button` (into the app) | `back_press` (out, to wherever the PDF came from), plus
   `page_count` and `pages_seen` (the furthest page any part of which was on screen, from 1). Both absent until the
   PDF is drawn (§1.7). Back is passed on unchanged afterwards.
3. **`pdf_print_result`** — coded, one per press of Print (the viewer's only way to save: "Save as PDF"), read when
   the system dialog closes (§1.23): `outcome` = `sent|cancelled|failed|launch_failed|unknown_<state>`;
   `failed_at` = `write|print_service` on `failed`; `exception_class` on `launch_failed`. `sent` does not say
   whether it was "Save as PDF" or paper: the chosen printer's service package is hidden API, and its public local id
   is a string each print service picks — guessing from it would be §1.16's mistake.
4. **`pdf_download_result`** — coded, one per press of Download PDF, when the answer comes: `document` =
   `invoice|estimate|ledger|received_invoice`; `outcome` = `saved|failed|sheet_shown|refused`; `reason=not_loaded`
   on `refused` only; `elapsed_ms` from press to answer. Reported once per press; a cancelled screen sends nothing
   (§1.19). Android and iOS share the view models. `sheet_shown` is the iPhone ledger's Save to Files sheet.
5. **A failure keeps its `error_shown`.** `pdf_download_result=failed` counts the attempt; `error_shown` counts the
   sentence read. Same moment, same screen. The received invoice's "Could not save the PDF" did not go through
   `ShownError` and was never counted; it now reads the standard "Couldn't create the PDF. Please try again." (already
   in all 17 languages) and reports `error_shown export/invoice`.

## Rejected

- **A result parameter on the tap.** The tap is sent before the file exists; it cannot carry the answer.
- **One `pdf_viewer_*` event family** (`pdf_viewer_closed`, `pdf_viewer_back`). A second name for the close, or for
  its route, is the three-rows-per-dismissal shape of §1.1.
- **Folding Print into `pdf_download_result`.** Print can send to a printer and can be cancelled in a dialog we do
  not own; its outcome words are different, so it is its own event.
- **Deriving "saved" as presses minus `error_shown`.** Presses are auto (denylist-governed, and the release denylist
  is itself unverified); the sentence is shared with share-PDF; a cancelled screen is neither.
- **Payment slip's Download.** Everything tied to the Payments screen waits for its full review (owner, 2026-09-13).
- **`dead_tap` on the viewer.** Its root observer reads the main shell's published screen, which would file the
  viewer's taps under the screen behind it. Left out until that can be done without guessing.

## Open questions for the owner

1. The viewer's **Share and Print fail in silence** when the system refuses to open them (`runCatching`). A failed
   Print is now counted (`launch_failed`); a failed Share is not, and neither tells the person. Show a sentence
   (a user-facing change, new text in 17 languages)?
2. On **iPhone, the received invoice's Download PDF does nothing** (the platform half is a no-op) while the button is
   on screen. The press is recorded; no result ever follows. Hide it on iOS, or build it?
3. Should the viewer's Share report which app was picked, like `invoice_shared_success`'s `target`? It would be a new
   event (a received PDF is not the sender's own invoice, so it must not reuse that name, §1.17).

## Addendum 2026-09-30 — the owner's three answers

App: `feat/pdf-viewer-events` @ `3fa5c785f` (on top of `de0df1c3a`). Not merged, not released. Gate
(`--rerun-tasks`, every XML): Android 2390 (+3), jvm 130, iOS-sim 138, 0 failures; `xcodebuild` BUILD SUCCEEDED. Red
without the change: the share tests fail 2 of 3.

**Verified on a fresh iPhone 17 / iOS 26.5 Simulator** (our own share link `49iu…`, eaglegroup005): a one-page
595 × 842 pt PDF with the invoice drawn, "Save to Files" up, `pdf_download_result` `sheet_shown` `elapsed_ms=1194`; an
early press gave `refused` / `not_loaded`. Two traps found there and fixed: WebKit does not paint a web view outside
the window (the first PDFs were the loading page), and the bundle's `__setInvoice` is still undefined at
`didFinishNavigation` (the invoice handed in then was dropped). The PDF shows the sheet on the renderer's desk with a
small margin, as Android's does.

1. **"Pehly wo report kero"** — a Share whose chooser never opens is **counted, not told**. No sentence and no
   `error_shown` yet. It is `outcome=launch_failed` on the share's result event (below), the shape Print's
   `launch_failed` already has. **What past data can say about it: nothing.** The viewer sent 0 rows of any kind in
   the 60 days to 2026-09-30 (no tap, no `screen_view`, no row with `screen_name = 'pdf_viewer'`), and the old code
   swallowed the failure inside a `runCatching` with no event and no sentence. So the count starts from this build.
2. **"Feature bana do"** — the received invoice's **Download PDF works on iPhone.** It was an empty function while
   the button was on screen. The invoice is written as one A4 page from the same offline bundle the screen shows
   (`WKWebView.createPDF`, core/ui `InvoiceHtmlPdf`) and handed to "Save to Files", the sheet the ledger's Download
   opens. It reports `pdf_download_result` `document=received_invoice` with `outcome=sheet_shown` (what the person
   picks in the system sheet is not reported to us), or `failed` with the shared `ShownError` sentence and
   `error_shown export/invoice`.
3. **"Haan, gino"** — **`pdf_share_result`**, coded, one per Share press that reaches an answer:
   - `outcome` = `target_picked` | `launch_failed`;
   - `target` on `target_picked`: the picked app's package, the same value `invoice_shared_success.target` carries,
     from the same confirmed chooser (`startConfirmedShareChooser` + `EXTRA_CHOSEN_COMPONENT`); absent when the
     platform named none (§1.7);
   - `exception_class` on `launch_failed`.
   - A chooser closed without a pick sends nothing: Android reports picks, never cancels. "Opened and closed" is the
     Share tap with no result after it.
   - One event, with the outcome as a parameter (§1.1), not a `_failed` twin. Not `invoice_shared_success`: a PDF
     somebody else sent is not the person's own invoice (§1.17).
   - **iOS:** the viewer does not exist on iPhone (no "Open with" for PDFs), so there is nothing to send there.

### Rejected in the addendum
- **`launch_failed` as its own event** (`pdf_share_failed`): one press, one result event, the outcome a parameter.
- **A sentence for the failed share now.** The owner wants the count first.
- **Reporting the "Save to Files" choice on iPhone** (saved vs cancelled) by a picker delegate. It would give the
  ledger's and the received invoice's `sheet_shown` two different meanings in one release; do both together, later.
