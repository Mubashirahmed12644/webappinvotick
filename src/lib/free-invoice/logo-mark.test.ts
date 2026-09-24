// Run: npm test
//
// The initials are the only part of the generated logo that can be wrong in a way nobody notices:
// the drawing needs a canvas and is obvious when it breaks, but a wrong letter on somebody's own
// invoice looks deliberate. These are the cases that produced the rules in `logo-mark.ts`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialsFor } from "./logo-mark.ts";

test("two words give one letter each; one word gives one letter", () => {
  assert.equal(initialsFor("Northgate Coffee"), "NC");
  assert.equal(initialsFor("Amberleaf"), "A");
  // Only the first two words. "ABC" from three would be an abbreviation we invented.
  assert.equal(initialsFor("Northgate Coffee Company"), "NC");
});

test("nothing to take means no mark at all, never a mark for a business we made up", () => {
  assert.equal(initialsFor(""), "");
  assert.equal(initialsFor("   "), "");
  // A name that is only punctuation has no letter in it; the caller must then set no logo.
  assert.equal(initialsFor("&&&"), "");
});

test("a leading symbol is skipped rather than drawn", () => {
  assert.equal(initialsFor("& Co Traders"), "CT");
  assert.equal(initialsFor("@home Studio"), "HS");
});

test("code points, not UTF-16 units — a sliced character renders as a replacement glyph", () => {
  // Devanagari, Arabic and CJK each have "letters" that are more than one `charAt`, and an emoji is
  // a surrogate pair. Indexing the string would hand back half a character, which draws as `?`.
  assert.equal(initialsFor("नमस्ते व्यापार"), "नव");
  assert.equal(initialsFor("محمد تجارة"), "مت");
  assert.equal(initialsFor("北京 公司"), "北公");
  assert.equal(initialsFor("Ñandú Café"), "ÑC");
  // An emoji is not a letter, so a word made only of one is skipped like any other symbol and the
  // mark comes from the words that can carry it.
  assert.equal(initialsFor("🍕 Pizza Palace"), "PP");
});

test("digits count as a first character, because a business may legitimately start with one", () => {
  assert.equal(initialsFor("24 Carat"), "2C");
});
