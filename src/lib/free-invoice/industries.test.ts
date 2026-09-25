import test from "node:test";
import assert from "node:assert/strict";
import { INDUSTRIES, INDUSTRY_IDS, industryById, searchIndustries, templateIdForIndustry } from "./industries.ts";
import { INDUSTRY_VALUES } from "../analytics/events.ts";

// The ten ids `templates.ts` ships. Written out rather than imported because that module pulls in
// image paths and this file is run by Node, which strips types but resolves everything else.
const TEMPLATE_IDS = new Set([
  "simple", "business", "automotive", "workshop", "safety",
  "builder", "medical", "electronics", "creative", "fashion",
]);

test("every trade points at a template that really exists", () => {
  // A trade whose template id is a typo would open the invoice on Simple and nothing would say so.
  for (const i of INDUSTRIES) {
    assert.ok(TEMPLATE_IDS.has(i.template), `${i.id} names a template that does not exist: ${i.template}`);
  }
});

test("the analytics code space and the list are the same list", () => {
  // `events.ts` writes the ids out so it can stay free of runtime imports. This is what stops the
  // two drifting: add a trade and forget the schema, and a real answer is silently refused at the
  // route — the row vanishes and nothing says why.
  assert.deepEqual([...INDUSTRY_VALUES], INDUSTRY_IDS);
});

test("ids are unique, and they are the code space analytics stores", () => {
  assert.equal(new Set(INDUSTRY_IDS).size, INDUSTRY_IDS.length);
  // Stored values, so they must be safe to put in a schema enum and in a URL: no spaces, no case.
  for (const id of INDUSTRY_IDS) assert.match(id, /^[a-z][a-z0-9_]*$/);
});

test("every trade carries a glyph and a name that fits a phone", () => {
  for (const i of INDUSTRIES) {
    assert.ok(i.symbol.length > 0, `${i.id} has no symbol`);
    // 34 characters is what fits one line of the list at 320px before it wraps to two. Wrapping is
    // allowed; a name long enough to push the tick off the row is not.
    assert.ok(i.name.length <= 34, `${i.id} name is ${i.name.length} characters`);
  }
});

test("`other` exists and is always last, however the list is searched", () => {
  assert.equal(INDUSTRIES[INDUSTRIES.length - 1].id, "other");
  // A required question with no honest answer is a wall, so the escape must never be buried above
  // the thing somebody was about to find.
  for (const q of ["", "weld", "zzzz", "e"]) {
    const got = searchIndustries(q);
    assert.equal(got[got.length - 1].id, "other", `"${q}" did not end with other`);
  }
});

test("a name match outranks a keyword match", () => {
  // "car" is in Carpentry's NAME and in Automotive's keywords. The word people type is the word in
  // the name, so that is what comes first.
  const first = searchIndustries("car")[0];
  assert.equal(first.id, "carpentry");
  // And the keyword match is still in the list, not thrown away.
  assert.ok(searchIndustries("car").some((i) => i.id === "automotive"));
});

test("the words people actually type find the trade they mean", () => {
  // Each of these failed to find anything, or found the wrong thing, at some point while building
  // this list — "coffee" fell through to `other` on a real run.
  const expect: Array<[string, string]> = [
    ["weld", "welding"],
    ["sparky", "electrical"],
    ["chippy", "carpentry"],
    ["coffee", "food"],
    ["plumber", "plumbing"],
    ["photographer", "photography"],
  ];
  for (const [query, id] of expect) {
    assert.equal(searchIndustries(query)[0].id, id, `"${query}" did not find ${id}`);
  }
});

test("an unknown trade falls back to Simple rather than throwing", () => {
  assert.equal(industryById(undefined), undefined);
  assert.equal(industryById("not_a_trade"), undefined);
  assert.equal(templateIdForIndustry(undefined), "simple");
  assert.equal(templateIdForIndustry("not_a_trade"), "simple");
  assert.equal(templateIdForIndustry("welding"), "workshop");
});
