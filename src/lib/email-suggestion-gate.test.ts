import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_GATE,
  gateOnAccept,
  gateOnBlur,
  gateOnEdit,
  gateOnSubmit,
} from "./email-suggestion-gate.ts";

const TYPO = "ahmad.raza@gmial.con";
const FIXED = "ahmad.raza@gmail.com";

test("leaving the field with a domain typo shows the chip", () => {
  assert.equal(gateOnBlur(EMPTY_GATE, TYPO).suggestion, FIXED);
});

test("leaving the field with a correct address shows nothing", () => {
  assert.equal(gateOnBlur(EMPTY_GATE, FIXED).suggestion, null);
});

test("changing the text clears the chip", () => {
  const g = gateOnBlur(EMPTY_GATE, TYPO);
  assert.equal(gateOnEdit(g).suggestion, null);
});

test("accepting clears the chip and nothing else is decided for the person", () => {
  const g = gateOnAccept(gateOnBlur(EMPTY_GATE, TYPO));
  assert.equal(g.suggestion, null);
});

test("a correct address sends on the first press with no pause", () => {
  const r = gateOnSubmit(EMPTY_GATE, FIXED);
  assert.equal(r.send, true);
  assert.equal(r.gate.suggestion, null);
});

test("the first press with a never-seen suggestion shows the chip and sends nothing", () => {
  const r = gateOnSubmit(EMPTY_GATE, TYPO);
  assert.equal(r.send, false);
  assert.equal(r.gate.suggestion, FIXED);
});

test("the next press sends the address as typed, and the chip is ignored for good", () => {
  const first = gateOnSubmit(EMPTY_GATE, TYPO);
  const second = gateOnSubmit(first.gate, TYPO);
  assert.equal(second.send, true);
  assert.equal(second.gate.suggestion, null);
  // Leaving the field again with the very same text must not bring it back.
  assert.equal(gateOnBlur(second.gate, TYPO).suggestion, null);
});

test("a chip already shown on leaving the field does not pause the press", () => {
  const blurred = gateOnBlur(EMPTY_GATE, TYPO);
  const r = gateOnSubmit(blurred, TYPO);
  assert.equal(r.send, true);
});

test("a different typo is a new address and may pause once more", () => {
  const first = gateOnSubmit(EMPTY_GATE, TYPO);
  const ignored = gateOnSubmit(first.gate, TYPO);
  const other = gateOnSubmit(ignored.gate, "bilal@hotmial.com");
  assert.equal(other.send, false);
  assert.equal(other.gate.suggestion, "bilal@hotmail.com");
});

test("an address that was shown once and is typed again is not paused a second time", () => {
  let g = gateOnBlur(EMPTY_GATE, TYPO);
  g = gateOnEdit(g);
  g = gateOnBlur(g, "sana@gamil.com");
  g = gateOnEdit(g);
  const r = gateOnSubmit(g, TYPO);
  assert.equal(r.send, true);
});

test("spaces around the address do not make it a new address", () => {
  const first = gateOnSubmit(EMPTY_GATE, `  ${TYPO}  `);
  assert.equal(first.send, false);
  assert.equal(gateOnSubmit(first.gate, TYPO).send, true);
});
