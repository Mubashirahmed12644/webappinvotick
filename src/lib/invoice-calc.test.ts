// Run: npm test  (Node's own runner; Node 24 strips the types, so there is no test dependency.)
//
// A discount or tax type is text wherever it is stored, and three words have been written for a fixed
// amount: FLAT (the app, the server), FIXED (this web form until 9c0b2d8, and the app's own pull when the
// server sent none) and AMOUNT (seen once on the server). The app reads all three as FLAT since
// 2026-09-27 (DiscountType.parseOrNull); the web read only FLAT, so a stored FIXED opened in the form
// as "%", and the form's own math then took 50 as 50 % instead of 50 off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLineItem, discountTypeOf, typeWord } from "./invoice-calc.ts";

test("every spelling of a fixed amount reads as FLAT, as the app reads it", () => {
  for (const stored of ["FLAT", "flat", " Flat ", "FIXED", "fixed", "AMOUNT", "amount"]) {
    assert.equal(discountTypeOf(stored), "FLAT", JSON.stringify(stored));
  }
});

test("a percentage reads as PERCENTAGE, and so does a missing or unknown type", () => {
  for (const stored of ["PERCENTAGE", "percentage", "PERCENT", "percent", null, undefined, "", "  ", "null", "ratio"]) {
    assert.equal(discountTypeOf(stored), "PERCENTAGE", JSON.stringify(stored));
  }
});

test("a stored FIXED goes back out as FLAT, never FIXED", () => {
  assert.equal(typeWord(discountTypeOf("FIXED")), "FLAT");
  assert.equal(typeWord(discountTypeOf("AMOUNT")), "FLAT");
  assert.equal(typeWord("FIXED"), "FLAT");
  assert.equal(typeWord(discountTypeOf("PERCENTAGE")), "PERCENTAGE");
});

test("a line stored with FIXED keeps its money in the form: 50 off, not 50 %", () => {
  const line = computeLineItem({ quantity: 2, unitPrice: 400, discountValue: 50, discountType: discountTypeOf("FIXED") });
  assert.equal(line.discountAmount, 50);
  assert.equal(line.netPrice, 350);
  assert.equal(line.lineTotal, 700);
});
