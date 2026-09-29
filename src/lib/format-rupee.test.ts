// The rupee is "Rs", two letters, not the one character U+20A8 (owner's decision, 2026-09-29): iOS's font drew that
// character as a squeezed "Rs", so the same amount looked different on an iPhone, an Android phone, the PDF and the
// web. Only the sign changes — the figure is the same string — and it sits in front with no space, as the app writes
// every letter sign ("Rp", "RM", "Kz").
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "./format.ts";

const NBSP = String.fromCharCode(0xa0);
const OLD_RUPEE = String.fromCharCode(0x20a8);

test("PKR is written Rs, in front, with no space", () => {
  assert.equal(formatMoney(7675, "PKR"), "Rs7,675.00");
  assert.equal(formatMoney("1284500.75", "pkr"), "Rs1,284,500.75");
});

test("a snapshot from an older app, whose currency is the old character, reads Rs too", () => {
  assert.equal(formatMoney(7675, OLD_RUPEE), "Rs7,675.00");
  assert.equal(formatMoney(7675, OLD_RUPEE, "fr"), formatMoney(7675, "PKR", "fr"));
});

test("a written language puts Rs where it puts every sign", () => {
  assert.equal(formatMoney(7675, "PKR", "fr"), `7${String.fromCharCode(0x202f)}675,00${NBSP}Rs`);
  assert.equal(formatMoney(7675, "PKR", "pt"), `7${NBSP}675,00${NBSP}Rs`);
});

test("no amount anywhere carries the old character", () => {
  for (const lang of ["en", "fr", "pt", "es", "ar", "de", "fa", "hi", "id", "my", "nl", "pl", "sv", "th", "tr", "zh"] as const) {
    for (const cur of ["PKR", OLD_RUPEE]) assert.ok(!formatMoney(1234.5, cur, lang).includes(OLD_RUPEE), `${lang} ${cur}`);
  }
});
