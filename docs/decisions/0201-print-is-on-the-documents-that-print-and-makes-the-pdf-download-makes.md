# 0201 — Print is on the documents that print, and makes the PDF Download makes

- **Date:** 2026-10-03
- **Status:** built, not merged, not released. App `invoice-kmp-app`: `feat/print-option` off `release/1.5.1`
  (`aa2b41fee`) @ `21665a5c4`, pushed. Web `ivotickwebapp`: `feat/share-page-print-label` off `gitlab/main` @ `83a3dfd`,
  pushed to `gitlab` and `ghdev`, **not merged, not deployed** (the owner does that). No schema change, no server change,
  no new dependency, no Remote Config key.
- **Asked by:** the owner, 2026-10-03 — approved the design in `kaam/research/print-option-2026-10-03/index.html`, and said
  **no ad on Print**, as Download has none.
- **Mockup:** the file above (375 px phone, real colours, light and dark, German at 150 %, Arabic). The real screens, drawn by
  the Screen Map harness at 360 dp, are in `kaam/research/print-option-2026-10-03/built/`.

## Decided (as built)

**Where.** An unfilled round printer glyph in the top bar of the screens that show a document of their own:

| Screen | Where | Press id (auto tap) |
|---|---|---|
| Saved invoice | between Translate and Edit | `saved_inv_print_click` |
| Saved estimate | between Translate and Edit | `saved_est_print_click` |
| Client ledger | between Share and Download, all three 40 dp (two were 48) | `CustomerLedgerTopBar.print` |
| Received invoice (app) | between Download PDF and Translate, glyph and the word "Print" | `ReceivedInvoiceScreen.print` |
| Web share page `/i/{token}` | the browser route's one button, now named "Print or save PDF" with a printer glyph (desktop and iPhone); Android keeps "Download PDF" to the install (0017) | event unchanged: `shared_invoice_pdf_click destination=print_dialog` |
| Free tool | an outlined "Print" under Download PDF | **none**: the tool has no analytics route and a button does not earn one |

Not on the payment slip (its Download does not work yet; Payments waits for its review), not on a list row, not on the
preview (the invoice is not made there). The dead `PrintClicked` intents on both previews left with this change.
The PDF viewer already had Print; it now uses the same print code.

**What a tap does.** The PDF Download makes, to a temporary file (Android `cache/print/`, iOS the temporary folder), then the
phone's own dialog: Android `PrintManager` (A4 chosen, the real page count, "Save as PDF" is in it), iOS
`UIPrintInteractionController`. The file is deleted when the dialog closes. **One engine per document, no second builder**:
`renderPdfDocument` (invoice and estimate), `renderLedgerDocument`, `renderSharedInvoicePdf`; the saved screens build their
document in one `pdfInvoiceData()` that both buttons use. A guard test reads the source for each of these.

**While it is made**, a small spinner takes the glyph's place and the glyph takes no second press; the rest of the screen
(Send, Edit) stays usable. The view model reads its in-flight flag before it starts (a flag that is only written is not a
guard, double-tap protection 2026-08-22). Twenty seconds without a PDF is a failure.

**A PDF that could not be made** is one `ShownError.print(subject, cause, where)` sentence — "Couldn't get this ready to
print. Please try again." — in all 17 languages (16 translated plus English; `values-in` is Indonesian's old code), and is
also `error_shown` (`action=export`, `subject` the document). A printer's own trouble (jam, offline) is the dialog's to say.

**No ad.** Print's press does not pass the ad gate; a guard test checks the press and the code that makes the PDF.

**The top bar.** `TOP_BAR_ACTION_LABEL_SHARE` 0.22 → **0.14**. The design measured that with Print in the bar the German
"Rechnung erstellt" no longer fitted at the default font even at its smallest size at 22 %. At 14 % a 360 dp phone keeps
"Edit" and "تعديل" beside their icon, and "Bearbeiten", "Modifier", "Redigera", "Düzenle" become the pencil (the word is still its
spoken name). Measured on the real bar in `EditFitsTheTopBarBesideTheNumberTest` (core:ui, JVM): at 320 / 360 / 411 dp and
font 1.0 / 1.3 / 1.5, in seven languages including German and Arabic (RTL), nothing is cut and the title keeps more than 60 dp
(German at 360 dp: 168 dp at both fonts, English 133 / 119, Arabic 125 / 119).

**The received header.** Three labelled actions take about 240 dp. When the title would keep under 112 dp beside them, they
sit in a row of their own under it (a 360 dp phone); at 411 dp they stay on the title's line.

**Words.** `print_action` and `print_preparing` (core:ui) and the failure sentence (domain `rt_errors`), in the 16 translated
languages plus `values-in`. German uses the app's own "Sie" form (the mockup's "versuche" would have been the one du-form
sentence in the app).

## The precondition: the received invoice's PDF had one page

On Android the received invoice's Download PDF drew the web view's window once onto one PDF page. The renderer lays an
invoice out as a column of A4 sheets, so everything after the first sheet was cut. Print on that screen would have printed
a truncated invoice, so this was fixed first, for Download and Print together:

- **Android:** the web view is made tall enough for every sheet (the renderer fits to width, so the scale does not move) and
  each PDF page is the same window moved down to its sheet (`SharedInvoicePdfPages`, the arithmetic, unit-tested).
- **iPhone:** `InvoiceHtmlPdf` had the same one page; each page is now asked of WebKit with the frame scrolled to its sheet,
  and the pages are joined.
- The desk around the sheet is white on both (iPhone already was), so no grey margin reaches the paper. This changes how
  the received Download PDF looks on Android: white margin where it was light grey.

**Measured on the Pixel 7 Pro** (debug builds of `release/1.5.1` and of this branch, a canned 45-line invoice that the renderer
lays out as 3 sheets, opened from a link): the received invoice's Download PDF was **1 page before, 3 pages after**, each page
one sheet ("Page 1 of 3" … "Page 3 of 3") with no neighbour's edge on it; and the Print action opened Android's own dialog
on **ISO A4 with "1/3" pages** (`built/device-android-print-dialog-3-pages-A4.png`). Pictures of both PDFs are in `built/`.

**iPhone, on the Simulator** (iPhone 17, the same canned invoice): the received invoice's Print opened Apple's print sheet on **A4, "Pages 1-3"**, page 2 starting at line 26 with its own header and no neighbour on it (`built/ios-simulator-print-sheet-3-pages-A4.png`). Not run on a physical iPhone, and not the Download's Save-to-Files sheet (same renderer).

The first on-device run found a second bug the unit arithmetic could not: the page reports positions in CSS pixels, the web view
draws in device pixels, so the pages were cut 2.6 times too close together (three pages, wrong slices). The positions are now read
in the view's own pixels (`devicePixelRatio`), and each page is clipped to its sheet and half the gap round it.

**Seen while doing this, not caused by it and not fixed here:** in that 45-line test the renderer's own pagination put lines 1–21
on sheet 1 and lines 26+ on sheet 2, so lines 22–25 appear on no sheet, on screen or in the PDF. The lines are long enough to wrap
to two rows, which the renderer's row-count estimate (`A4PagedFrame`) does not allow for. It is the same on the baseline build, so
it is the web renderer's, and it is worth its own look: a line that is on no page is a trust bug (G3).

## Events (AGENTS-EVENTS §1.35)

`pdf_print_result` (decision 0197, until now only the PDF viewer's) gains parameters; **no new event name, no coded twin of
the tap.** `document` (`invoice|estimate|ledger|received_invoice`; absent on the viewer's rows, `screen=pdf_viewer` says it),
`failed_at=prepare` (new: our PDF was not made; `write` and `print_service` as before) and `prepare_ms` (press to PDF ready,
on every row with a `document`). iPhone: completed `sent`, closed with nothing printed `cancelled`, an error `failed` /
`print_service`. A press whose screen closed before the PDF was ready sends nothing (§1.19).

## Rejected

- **Print inside More** (two taps for something a person holds a printer for) and **inside Download as a Save/Print sheet**
  (it would turn the most-pressed button, 2,360 presses in 30 days, into two taps and break one-action-one-door).
- **A second PDF builder for Print**, or printing the page from the web view (`WebView.createPrintDocumentAdapter`): its
  result callbacks cannot be implemented from the app, and a second path is how Print and Download come to disagree.
- **A coded `print_clicked`** beside the glyph's own tap (§1.3, §1.11).
- **Print on the Android web share page.** That button is the growth door of 0017; Print for an Android receiver is in the app,
  on the received invoice, after the install.
- **A Print on the free tool's guided flow** (the design drew the editor only).

## Tests

Gate (`testDebugUnitTest nonAndroidTests :composeApp:compileKotlinIosSimulatorArm64 --continue --rerun-tasks`, every XML
including `__TEST-*`): **2,775 on `release/1.5.1` (`aa2b41fee`) → 2,837 (+62), 0 failures, 2 skipped as before.** (The baseline's
iOS analytics run hit the known XML-write/EOF flake once and was re-run with `--no-daemon`; this branch's did not.)
Native iOS: `xcodebuild` Debug for the Simulator **BUILD SUCCEEDED** (Xcode's own verdict; run through the Gradle slot with the configuration cache off — with it on, the framework's Gradle phase failed once in `syncComposeResourcesForIos`, "Cannot query the value of this provider"). Dark gate (`tools/darkaudit/gate.sh`'s two steps, run through the Gradle slot): **dark defects 0 = baseline 0**; 24 light pictures
moved and were accepted with the commit naming each (11 received-invoice pictures and `saved_inv_scr/sent`: the glyph and the header; 12 create / edit
screens, 36 to 66 pixels each in the line under the title, from the title column's 2 dp of slack). The untouched base moves 0, so none of it is the stale baseline.

| New test | What it holds |
|---|---|
| `PdfPrintResultTest` (analytics, Android + iOS, 14) | the row's parameters, `failed_at=prepare`, `prepare_ms`, iPhone's three endings, one answer, no row for a closed screen, the 20 s limit |
| `PrintOnTheReceivedInvoiceTest` (5) | one press one PDF, a second press ignored, the failure sentence + `error_shown` + `failed_at=prepare` together, a throwing renderer, `launch_failed` |
| `SharedInvoicePdfPagesTest` (6) | a page per sheet, each framed as the first, the neighbour's edge cut off, the web view tall enough |
| `PrintIsOnTheDocumentsThatPrintTest` (12, real screens, Robolectric) | order of the glyph on all four screens, one press one intent, the spinner and the disabled glyph, Send untouched, German at the normal font and at 150 %, Arabic mirrored, the received header's own row on a narrow phone |
| `PrintLivesWhereTheDesignPutItTest` (8, reads the source) | Print on exactly these four screens, not on payment slip / list / preview; one renderer per document; no ad; the in-flight flag read before the work; the strings in all 17 locales |
| `EditFitsTheTopBarBesideTheNumberTest` (+2, 6 now) | the real bar with Print at 320/360/411 dp and 1.0/1.3/1.5, seven languages: title whole (ink too), number whole, Edit's word or the pencil; the 0.14 share |
| `ShownErrorTest` (+1) | the print sentence and its one `error_shown` (`export`) |

**Red without the fix**, by reverting each piece in the worktree (no stash) and running its tests: the label share back to 0.22 →
4 of 6 top-bar tests; the in-flight guard removed → the received view model's double-press test and the guard test; `failed_at`
removed and the cancellation guard removed → 5 of 14 in `PdfPrintResultTest`; the page arithmetic collapsed to one page → 2 of 6;
a second `PdfDocument()` in the print path → the one-renderer guard. All restored and green.

Screen pictures (the Screen Map harness at 360 dp, `PrintShots`, light and dark, English, German at 150 %, Arabic; the debug pill
off, as users see it) and the device pictures are in `kaam/research/print-option-2026-10-03/built/`.

## Not done / left open

- iPad: `presentAnimated` is the system's own form of the sheet; it is not anchored to the glyph as the mockup drew it.
- Letter size: the dialog may choose Letter and fit our A4 page to it (the app's documents are A4 only).
- Safari and iOS browsers print a PDF held in a hidden frame unreliably: the free tool's Print falls back to opening the PDF
  in a tab, where the browser's own Print is one tap away.
- The debug build's render-mode pill takes about 70 dp from this bar; users' builds do not have it.
