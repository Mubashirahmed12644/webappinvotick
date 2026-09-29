// Run: npm test
//
// Decision 0187: an overlay with no place of its own starts at the mirror of its left-to-right spot on a right-to-left
// page, and exactly where it always did on a left-to-right one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_STAMP_SIZE, PAYMENT_STAMP_START, startInDirection } from "./overlay-start.ts";

test("left to right, the start is untouched — the same object", () => {
  assert.equal(startInDirection(PAYMENT_STAMP_START, PAYMENT_STAMP_SIZE, "ltr"), PAYMENT_STAMP_START);
});

test("right to left, the PAID stamp starts over the totals on the left — the app's 1 − 0.68 − 0.189", () => {
  const rtl = startInDirection(PAYMENT_STAMP_START, PAYMENT_STAMP_SIZE, "rtl");
  assert.ok(Math.abs(rtl.x - (1 - 0.68 - 0.189)) < 1e-12, `${rtl.x}`);
  assert.equal(rtl.y, PAYMENT_STAMP_START.y);
});

test("the mirror is exact: the right edge lands where the left edge was", () => {
  for (const [x, size] of [[0.682, 0.189], [0.572, 0.12], [0, 0.25]] as const) {
    const rtl = startInDirection({ x, y: 0.5 }, size, "rtl");
    assert.ok(Math.abs(1 - (rtl.x + size) - x) < 1e-12, `${x} ${size}`);
  }
});
