// The arithmetic half of "the stamp stays on the page and follows the finger" (decision 0204). The browser
// half — real touch, first-touch selection, a pinch that does not move the box — is
// scripts/checks/run-overlay-drag-check.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampFrac, dragFrac, maxFrac, screenPerSheet, type Frac } from "./overlay-drag.ts";

const W = 794;
const H = 1123;
const SIZE = 0.189 * W; // the default box: 150 sheet px square
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3];
// The fit scale of the page in the pane: a small phone, a Pixel, a tablet, a desktop column.
const FITS = [0.4, 0.52, 0.9, 1.2];
const EPS = 1e-9;

/** The box's four edges, in sheet px, for a left/top share. */
const edges = (f: Frac, size = SIZE) => ({ left: f.x * W, top: f.y * H, right: f.x * W + size, bottom: f.y * H + size });
const inside = (f: Frac, size = SIZE) => {
  const e = edges(f, size);
  return e.left >= -EPS && e.top >= -EPS && e.right <= W + EPS && e.bottom <= H + EPS;
};

test("the largest left share leaves the box's right edge exactly on the sheet's", () => {
  assert.ok(Math.abs(maxFrac(SIZE, W) * W + SIZE - W) < EPS);
  assert.ok(Math.abs(maxFrac(SIZE, H) * H + SIZE - H) < EPS);
  // 1 − size/sheet — never the old 0.96, which let the box out by 118 px at this size.
  assert.ok(maxFrac(SIZE, W) > 0.8 && maxFrac(SIZE, W) < 0.82);
});

test("a position already on the page comes back as the very same numbers", () => {
  for (const f of [{ x: 0, y: 0 }, { x: 0.45, y: 0.45 }, { x: 0.682, y: 0.535 }, { x: 0.572, y: 0.739 }, { x: maxFrac(SIZE, W), y: maxFrac(SIZE, H) }]) {
    assert.deepEqual(clampFrac(f, SIZE, W, H), f);
  }
});

test("a position outside the page is moved to the nearest place on it, on every side", () => {
  const max = { x: maxFrac(SIZE, W), y: maxFrac(SIZE, H) };
  assert.deepEqual(clampFrac({ x: -0.2, y: 0.3 }, SIZE, W, H), { x: 0, y: 0.3 }, "left");
  assert.deepEqual(clampFrac({ x: 0.3, y: -5 }, SIZE, W, H), { x: 0.3, y: 0 }, "top");
  assert.deepEqual(clampFrac({ x: 0.96, y: 0.3 }, SIZE, W, H), { x: max.x, y: 0.3 }, "right: what the old 0.96 let through");
  assert.deepEqual(clampFrac({ x: 0.3, y: 0.97 }, SIZE, W, H), { x: 0.3, y: max.y }, "bottom");
  assert.ok(inside(clampFrac({ x: 9, y: 9 }, SIZE, W, H)));
  assert.ok(inside(clampFrac({ x: -9, y: -9 }, SIZE, W, H)));
});

test("a box as big as the page, or bigger, has one place; a corrupt value is 0, never NaN", () => {
  assert.deepEqual(clampFrac({ x: 0.4, y: 0.4 }, W, W, H), { x: 0, y: 1 - W / H }, "as wide as the page: one place across, room only down");
  assert.deepEqual(clampFrac({ x: 0.4, y: 0.4 }, 2000, W, H), { x: 0, y: 0 });
  assert.deepEqual(clampFrac({ x: NaN, y: Infinity }, SIZE, W, H), { x: 0, y: 0 });
  assert.equal(maxFrac(0, W), 0);
  assert.equal(maxFrac(SIZE, 0), 0);
});

test("the measured scale is the drawn sheet's width over its own", () => {
  assert.equal(screenPerSheet(W, W), 1);
  assert.ok(Math.abs(screenPerSheet(W * 0.52 * 3, W) - 1.56) < EPS, "fit 0.52 under 3x zoom");
  assert.equal(screenPerSheet(0, W), 0);
  assert.equal(screenPerSheet(100, 0), 0);
});

test("dragging far past each edge stops with the box ON the page: 4 edges × 7 zooms × 4 fits", () => {
  const starts: Frac[] = [{ x: 0.45, y: 0.45 }, { x: 0.12, y: 0.68 }, { x: 0.682, y: 0.535 }];
  let cases = 0;
  for (const zoom of ZOOMS) for (const fit of FITS) for (const start of starts) {
    const k = screenPerSheet(W * fit * zoom, W);
    // Far past: more than a whole sheet in screen px, in each direction.
    const far = Math.max(W, H) * k * 3;
    for (const [dx, dy] of [[far, 0], [-far, 0], [0, far], [0, -far], [far, far], [-far, -far]]) {
      const f = dragFrac({ start, dx, dy, k, sizePx: SIZE, sheetW: W, sheetH: H });
      assert.ok(inside(f), `zoom ${zoom} fit ${fit} start ${start.x},${start.y} d ${dx},${dy} → ${f.x},${f.y} is off the page`);
      cases++;
    }
  }
  assert.equal(cases, ZOOMS.length * FITS.length * starts.length * 6);
});

test("each edge is REACHED: a drag that goes past lands flush against it, not short of it", () => {
  for (const zoom of ZOOMS) for (const fit of FITS) {
    const k = screenPerSheet(W * fit * zoom, W);
    const far = 5000 * k;
    const s: Frac = { x: 0.4, y: 0.4 };
    const at = (dx: number, dy: number) => edges(dragFrac({ start: s, dx, dy, k, sizePx: SIZE, sheetW: W, sheetH: H }));
    assert.ok(Math.abs(at(-far, 0).left) < EPS, "left border meets the page's left border");
    assert.ok(Math.abs(at(far, 0).right - W) < EPS, "right border meets the page's right border");
    assert.ok(Math.abs(at(0, -far).top) < EPS, "top");
    assert.ok(Math.abs(at(0, far).bottom - H) < EPS, "bottom");
  }
});

test("under zoom and scale the box moves by exactly what the finger moved: dx/k, applied once", () => {
  for (const zoom of ZOOMS) for (const fit of FITS) {
    const k = screenPerSheet(W * fit * zoom, W);
    // 20 screen px right and 30 down — small enough to stay inside whatever the scale.
    const f = dragFrac({ start: { x: 0.3, y: 0.3 }, dx: 20, dy: 30, k, sizePx: SIZE, sheetW: W, sheetH: H });
    const movedScreenX = (f.x - 0.3) * W * k;
    const movedScreenY = (f.y - 0.3) * H * k;
    assert.ok(Math.abs(movedScreenX - 20) < 1e-6, `zoom ${zoom} fit ${fit}: moved ${movedScreenX} px for 20`);
    assert.ok(Math.abs(movedScreenY - 30) < 1e-6, `zoom ${zoom} fit ${fit}: moved ${movedScreenY} px for 30`);
  }
});

test("the position is the grab plus the TOTAL move: one jump equals many small steps", () => {
  const k = screenPerSheet(W * 0.52, W);
  const start: Frac = { x: 0.3, y: 0.4 };
  const jump = dragFrac({ start, dx: 100, dy: -60, k, sizePx: SIZE, sheetW: W, sheetH: H });
  let last = start;
  for (let i = 1; i <= 50; i++) last = dragFrac({ start, dx: (100 * i) / 50, dy: (-60 * i) / 50, k, sizePx: SIZE, sheetW: W, sheetH: H });
  assert.ok(Math.abs(jump.x - last.x) < EPS && Math.abs(jump.y - last.y) < EPS);
  // And a finger that comes back to where it started leaves the box where it started: nothing accumulates.
  const home = dragFrac({ start, dx: 0, dy: 0, k, sizePx: SIZE, sheetW: W, sheetH: H });
  assert.deepEqual(home, start);
});

test("a page further down a multi-page stack is the same arithmetic: only the sheet's own width matters", () => {
  // The box sits on one sheet and the deltas are relative, so a sheet drawn 3 pages down — or one that
  // scrolled while the page was zoomed — clamps exactly as the first does.
  const k = screenPerSheet(W * 0.52 * 2, W);
  const s: Frac = { x: 0.5, y: 0.5 };
  for (const page of [0, 1, 2, 9]) {
    void page; // the sheet's position on screen never enters; that is the point
    const f = dragFrac({ start: s, dx: 10_000, dy: 10_000, k, sizePx: SIZE, sheetW: W, sheetH: H });
    assert.deepEqual(f, { x: maxFrac(SIZE, W), y: maxFrac(SIZE, H) });
  }
});

test("other box sizes: the largest slider value and a tiny one are held to the same rule", () => {
  for (const share of [0.05, 0.1, 0.189, 0.3, 0.45]) {
    const size = share * W;
    for (const f of [{ x: 5, y: 5 }, { x: -5, y: -5 }, { x: 0.5, y: 0.5 }]) {
      assert.ok(inside(clampFrac(f, size, W, H), size), `size ${share}`);
    }
  }
});
