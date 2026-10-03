// Where a stamp or a signature may sit on the page, and where a finger puts it (decision 0204).
//
// A stamp and a signature are boxes drawn over one sheet: left/top are stored as a share of the sheet's width
// and height (the presentation JSON's stampOffset / signatureOffset), and the box is a square `size` sheet
// pixels on a side. Nothing here changes what is stored; it only decides what is drawn and what a drag writes.
//
// The rule is one rule: the whole BOX stays inside the sheet, on all four sides. It used to hold the box's
// left and top edges to 0 and its left/top-LEFT corner to 0.96 of the sheet — which let the box out through
// the right edge by 0.96·W + size − W (118 sheet px at the default size) and through the bottom by 105.
//
// Pure arithmetic, no DOM: scripts/checks/run-overlay-drag-check.mjs is the half that sends real touches.

export type Frac = { x: number; y: number };

/**
 * The largest left (or top) share the box can have and still end inside the sheet:
 * `1 − size/sheet`. A box as big as the sheet, or bigger, has exactly one place — 0.
 */
export function maxFrac(sizePx: number, sheetPx: number): number {
  if (!(sheetPx > 0) || !(sizePx > 0)) return 0;
  return Math.max(0, 1 - sizePx / sheetPx);
}

/**
 * [frac] moved to the nearest place where the whole box is on the sheet.
 *
 * A value already inside comes back as the very same number, so a stored position that was fine is drawn
 * exactly where it always was; only a position outside the page changes. A non-finite value (a corrupt
 * store) becomes 0 rather than propagating NaN into a style.
 */
export function clampFrac(frac: Frac, sizePx: number, sheetW: number, sheetH: number): Frac {
  const one = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  return { x: one(frac.x, maxFrac(sizePx, sheetW)), y: one(frac.y, maxFrac(sizePx, sheetH)) };
}

/**
 * How many SCREEN pixels one sheet pixel is, read off the sheet as it is drawn right now.
 *
 * The sheet is laid out at its own 794 px and scaled to fit the pane (a CSS transform), and the page
 * as a whole can be scaled again — the browser's pinch zoom, an ancestor's transform. A pointer reports
 * screen pixels, so every delta has to be divided by this, and it has to be the number measured from the
 * drawn sheet, not the one the page believes it drew at: "scale applied once" is only true of the measured one.
 * Returns 0 when there is nothing to measure.
 */
export function screenPerSheet(drawnSheetWidthPx: number, sheetW: number): number {
  return drawnSheetWidthPx > 0 && sheetW > 0 ? drawnSheetWidthPx / sheetW : 0;
}

/**
 * Where the box is after the pointer has moved by (dx, dy) screen pixels from where it was grabbed.
 *
 * `start` is where the box was when it was grabbed, so the position is the grab plus the TOTAL movement, never
 * an accumulation of per-event steps: a finger that jumps a long way in one event lands exactly where it
 * should, and a finger that comes to rest does not creep. The result is clamped to the sheet.
 */
export function dragFrac(o: {
  start: Frac;
  dx: number;
  dy: number;
  /** [screenPerSheet] of the sheet this box sits on. */
  k: number;
  sizePx: number;
  sheetW: number;
  sheetH: number;
}): Frac {
  const k = o.k > 0 ? o.k : 1;
  return clampFrac(
    { x: o.start.x + o.dx / k / o.sheetW, y: o.start.y + o.dy / k / o.sheetH },
    o.sizePx, o.sheetW, o.sheetH,
  );
}
