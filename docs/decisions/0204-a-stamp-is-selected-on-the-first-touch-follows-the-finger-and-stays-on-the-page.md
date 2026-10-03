# 0204 — A stamp or signature is selected on the first touch, follows the finger, and stays on the page

- **Date:** 2026-10-03
- **Status:** built, not merged, not deployed. Web `fix/stamp-signature-drag` (off `gitlab/main` `9ef6fc0`); app
  `fix/stamp-signature-bundle` (off `origin/release/1.5.1`, the two bundle copies only, md5
  `ca77c7238a5f9b8b5cd00484cb6997ed`). No Kotlin change: the `StampBridge` contract is untouched.
- **The report (owner, Pixel, 2026-09-30):** (1) the stamp sometimes needs more than one tap before it moves;
  (2) a fast finger leaves the stamp behind, and the drag lags; (3) the box's left edge stays inside the page but
  its right edge goes out; same for the signature; (4) none of it may break pinch-zoom or scrolling.
- **Root causes, each found by a real-touch run of the shipped bundle (`cae51ddb`) in headless Chrome:**
  1. **Selection was decided on release, and only for a still finger.** `onPointerUp` selected only if the pointer had
     moved less than 6 px since it landed, and an unselected box had `touch-action: auto`, so a wobbling first touch was
     also at the browser's mercy to take for a scroll. Measured: **0 of 36 taps selected at touch-down, 12 of 36 after
     release** (every tap with 6 px of wobble or more selected nothing). That is "tap more than once".
  2. **A grab-and-move did nothing.** An unselected box ignored the movement of the very touch that landed on it
     (**114 px behind the finger** in the harness), so the owner's natural gesture, touch and drag, looked like a
     stamp that would not move until it had been tapped again.
  3. **The clamp let the box out through the right and bottom.** It held the box's left/top *corner* to `[0, 0.96]` of
     the sheet, not the box: right overshoot `0.96·W + size − W` = **118.3 sheet px**, bottom **105.1** (at the default
     0.189 size), left and top 0. 16 of 32 edge drags ended outside the page; a position saved that way was drawn
     outside it.
  4. **Not reproduced in headless Chrome:** the fast-finger slip as such. A one-jump, 4-event or 25-event swipe left the
     box exactly under the pointer (0.0 px) in the old code too, because the old maths was already "grab + total
     move". What *was* found that explains it on a device is (1)/(2): a touch whose `touch-action` is not already
     "ours" can be taken for a scroll mid-gesture and cancelled, after which the box stops and the finger goes on.
     The Pixel was locked, so it is not measured on the device. If the slip survives this, the next suspect is main-thread
     latency inside the WebView, which headless Chrome cannot show.
- **Decision:**
  - **Select on `pointerdown`, and start the drag with it.** One touch selects the box and has it in hand; a plain tap
    (less than 4 px) selects and writes nothing.
  - **A box owns single-finger touch from the first touch**: `touch-action: pinch-zoom` always (it cannot depend on
    `selected`, which only becomes true because the touch landed; and it must not be `none`, which swallowed the
    pinch once). Pointer captured, `will-change: transform` while held, `userSelect`/callout off.
  - **Position = the grab + the pointer's total movement ÷ the drawn sheet's measured scale**, read once at the grab from
    the sheet's own rect (not the page's belief about its scale, not per move). Moves are a transform; nothing renders
    in React per move. On release the new `left/top` and the cleared transform are written in the same task, then
    `onCommit`, so no frame shows the move undone or applied twice.
  - **The whole box stays on the sheet, on all four sides** (`src/lib/overlay-drag.ts`): `0 ≤ x ≤ 1 − size/W`,
    `0 ≤ y ≤ 1 − size/H`. A position already inside is returned as the very same numbers, so existing invoices render
    identically. **A stored position outside the page is clamped at display only** (editor and the receiver's static
    view alike, so the two agree) and is rewritten only if the user moves it; the app is told nothing at display.
    What is stored keeps its meaning: left/top as a share of the sheet's width/height.
  - **Gesture arbitration, deliberately:** one finger on a box → the box. A second finger anywhere (non-primary pointer,
    or `pointercancel` when the browser starts a pinch) → the drag is abandoned, the box goes back to where it was,
    the browser pinches. One finger elsewhere → the page (scroll/pan) and the box deselects. The host is told
    `setDragging(true)` at the grab and `false` on every end (release, cancel, abandon, lost capture, unmount); the
    app's double-tap-to-zoom keeps reading that flag exactly as before.
  - **Selecting no longer re-renders the documents.** The per-page and measuring `InvoiceDocument`s are memoised on
    props that do not change with selection, and the per-page data objects are kept while the pages and document are.
- **Rejected:**
  - *Keep select-then-drag (the first touch only selects).* The owner's complaint is that the first touch did not
    work; a design where it works but still moves nothing would read as the same fault.
  - *`touch-action: none` on a box.* Swallows the pinch whenever a finger lands on a box (it was that once).
  - *Unselected box passes touches through (`auto`), select on release.* This is the shipped design and what failed.
  - *Pointer-event prediction to hide latency.* Unverifiable on the device that was locked, and prediction overshoots
    when a finger stops; add only with a Pixel to measure on.
  - *Clamp to the page's margins instead of the sheet.* The owner's rule is the invoice's own border on every side.
  - *Rewrite stored positions that are out of bounds.* Would change saved invoices; display-only clamping does not.
  - *A Kotlin change.* The app side already skips re-injecting the snapshot for the WebView's own moves
    (`snapshotKey` excludes the offsets); nothing in it was at fault.
- **Consequences:**
  - A touch that begins on a stamp or signature box moves it instead of scrolling the page: scrolling is started from
    anywhere else. Boxes are on the last page only, 0.189 of the width by default.
  - The same components draw the offline bundle, `/embed/render` and the share page, so this lands in **both**: the web
    deploy, and the bundle in both app copies (identical md5). A shared link's snapshot is frozen, but the renderer is
    not: the receiver's static view clamps with the same function, so an old link whose stamp was saved off the page
    is drawn inside it from the web deploy.
  - Existing invoices whose stamp or signature sits within the page are drawn at exactly the same numbers (the clamp
    returns an in-bounds value unchanged); English golden 72/72 unchanged (it carries no stamp, so it pins the rest).
- **Proof (`scripts/checks/run-overlay-drag-check.mjs`, real touch through DevTools input, mobile emulation):**

  | | old frame (`cae51ddb`) | this change |
  |---|---|---|
  | selected at the first pointerdown (stamp + signature, finger wobble 0–24 px, 36 taps) | **0/36** | **36/36** |
  | selected after release | 12/36 | 36/36 |
  | drag from the very first touch, px behind the finger | **114** | **0** |
  | fast swipe (1 / 4 / 25 events), px behind the finger | 0 | 0 |
  | box outside the page after a release far past each edge (4 edges × 2 overlays × 4 widths) | **16/32**; right +118.3, bottom +105.1 sheet px | **0/32**; 0 on every side |
  | stored position off the page, drawn | outside | inside; nothing reported to the app |
  | last page of a 3-page invoice, drag past the corner | +58.4 px outside | 0 |
  | pinch with a stamp selected: box moved / host left "held" / page zooms | 0 / no / 3.25× | 0 / no / 3.25× |
  | frame gaps in a 60-event drag, CPU ×4 | max 17 ms | max 17 ms |

  `overlay-drag.test.ts` +11: all four edges × zoom 0.5–3 × fit 0.4–1.2 × start places, flush against the edge when
  passed, one jump = many steps, a stored in-bounds value comes back identical. The fast-swipe, pinch and frame-gap rows
  pass on the old frame too in headless Chrome: they are guards, not proof, and say nothing about the Pixel.
  Web: `npm test` 145 (was 134), all `scripts/checks` pass incl. English golden 72/72 and paged-rows 266 documents
  (screen + print, 0 fail), tsc, `next build`.
- **Not measured:** frame times on the Pixel (locked); whether the slip in (2) is gone on the device.
