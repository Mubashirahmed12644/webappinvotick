// The arithmetic half of "every line is on exactly one page" (decision 0203). The browser half — that
// the heights handed in are the heights a page draws — is scripts/checks/run-paged-rows-check.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginateRows, type PageSlice } from "./paginate-rows.ts";

const ROW = 28;
const rows = (n: number, h = ROW) => Array.from({ length: n }, () => h);

function linesOnce(pages: PageSlice[], n: number) {
  const seen = pages.flatMap((p) => Array.from({ length: p.count }, (_, k) => p.start + k));
  assert.deepEqual(seen, Array.from({ length: n }, (_, i) => i), "every line once, in order");
  assert.equal(pages.filter((p) => p.summary).length, 1, "one summary page");
  assert.equal(pages[pages.length - 1].summary, true, "the summary is last");
}

function fits(pages: PageSlice[], heights: number[], noSum: number, withSum: number, blank = ROW) {
  for (const p of pages) {
    const used = heights.slice(p.start, p.start + p.count).reduce((a, b) => a + b, 0) + (p.padRows - p.count) * blank;
    const room = p.summary ? withSum : noSum;
    if (p.count > 1 || heights[p.start] <= room) assert.ok(used <= room + 0.01, `page at ${p.start} draws ${used}px into ${room}px`);
  }
}

test("equal rows keep the pages the frame always made (17 → 16+1, 26 → 24+2, 41 → 24+16+1)", () => {
  const noSum = 24 * ROW + 5;
  const withSum = 16 * ROW + 5;
  const counts = (n: number) => paginateRows({ rowHeights: rows(n), blankRowHeight: ROW, roomWithoutSummary: noSum, roomWithSummary: withSum }).map((p) => p.count);
  assert.deepEqual(counts(16), [16]);
  assert.deepEqual(counts(17), [16, 1]);
  assert.deepEqual(counts(18), [17, 1]);
  assert.deepEqual(counts(25), [24, 1]);
  assert.deepEqual(counts(26), [24, 2]);
  assert.deepEqual(counts(41), [24, 16, 1]);
});

test("a tall first line no longer stands for every line: 45 lines with the first wrapping lose none", () => {
  // The 2026-10-03 shape: the first line wraps to two rows (46px), the other 44 do not.
  const heights = [46, ...rows(44)];
  const noSum = 640, withSum = 420;
  const pages = paginateRows({ rowHeights: heights, blankRowHeight: ROW, roomWithoutSummary: noSum, roomWithSummary: withSum });
  linesOnce(pages, 45);
  fits(pages, heights, noSum, withSum);
});

test("short first line, wrapping rest: pages are full, not one line each", () => {
  const heights = [ROW, ...rows(44, 46)];
  const pages = paginateRows({ rowHeights: heights, blankRowHeight: ROW, roomWithoutSummary: 640, roomWithSummary: 420 });
  linesOnce(pages, 45);
  fits(pages, heights, 640, 420);
  assert.ok(pages.length <= 4, `${pages.length} pages`);
});

test("any mix of heights: every line once, in order, and every page within its room", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let t = 0; t < 500; t++) {
    const n = Math.floor(rnd() * 120);
    const heights = Array.from({ length: n }, () => ROW + Math.floor(rnd() * 4) * 19.5);
    const noSum = 300 + rnd() * 500;
    const withSum = noSum - rnd() * 250;
    const pages = paginateRows({ rowHeights: heights, blankRowHeight: ROW, roomWithoutSummary: noSum, roomWithSummary: withSum });
    if (n === 0) assert.deepEqual(pages.map((p) => p.count), [0]);
    else linesOnce(pages, n);
    fits(pages, heights, noSum, withSum);
  }
});

test("the summary never stands alone while a line fits beside it", () => {
  const pages = paginateRows({ rowHeights: rows(3), blankRowHeight: ROW, roomWithoutSummary: 600, roomWithSummary: ROW + 2 });
  linesOnce(pages, 3);
  assert.deepEqual(pages.map((p) => p.count), [2, 1]);
});

test("a last line too tall to share a page with the summary: the summary gets its own page, nothing is cut", () => {
  // A 746-character line beside a long summary.
  const heights = [ROW, 700];
  const pages = paginateRows({ rowHeights: heights, blankRowHeight: ROW, roomWithoutSummary: 800, roomWithSummary: 400 });
  linesOnce(pages, 2);
  assert.deepEqual(pages.map((p) => [p.count, p.summary]), [[2, false], [0, true]]);
  fits(pages, heights, 800, 400);
  const alone = paginateRows({ rowHeights: [700], blankRowHeight: ROW, roomWithoutSummary: 800, roomWithSummary: 400 });
  assert.deepEqual(alone.map((p) => [p.start, p.count, p.summary]), [[0, 1, false], [1, 0, true]]);
});

test("padding reaches the native nine rows only with blank rows that fit", () => {
  const [one] = paginateRows({ rowHeights: rows(2), blankRowHeight: ROW, roomWithoutSummary: 900, roomWithSummary: 9 * ROW });
  assert.equal(one.padRows, 9);
  const [tight] = paginateRows({ rowHeights: rows(2), blankRowHeight: ROW, roomWithoutSummary: 900, roomWithSummary: 5 * ROW + 3 });
  assert.equal(tight.padRows, 5);
  const [empty] = paginateRows({ rowHeights: [], blankRowHeight: ROW, roomWithoutSummary: 900, roomWithSummary: 9 * ROW });
  assert.deepEqual(empty, { start: 0, count: 0, summary: true, padRows: 9 });
});
