import { test } from "node:test";
import assert from "node:assert/strict";
import { replacedByTokenFrom } from "./shared-invoice-replacement.ts";

const OLD = "abcdefgh23456789";
const NEW = "mnpqrstu23456789";

test("a 410 that names a newer link yields its token", () => {
  assert.equal(replacedByTokenFrom({ success: false, code: "SHARE_REPLACED", replacedByToken: NEW }, OLD), NEW);
});

test("an older backend, which sends no pointer, yields none", () => {
  assert.equal(replacedByTokenFrom({ success: false, message: "This shared invoice is no longer available", data: null }, OLD), null);
});

test("anything that is not a replacement answer yields none", () => {
  assert.equal(replacedByTokenFrom(null, OLD), null);
  assert.equal(replacedByTokenFrom("gone", OLD), null);
  assert.equal(replacedByTokenFrom({ code: "ACCOUNT_CLOSED", replacedByToken: NEW }, OLD), null);
  assert.equal(replacedByTokenFrom({ code: "SHARE_REPLACED" }, OLD), null);
  assert.equal(replacedByTokenFrom({ code: "SHARE_REPLACED", replacedByToken: 42 }, OLD), null);
});

test("a token that could break out of the href is refused", () => {
  for (const bad of ["../admin", "x\"><script>", "short", `${NEW}/extra`, "ABCDEFGH23456789", NEW.slice(1)]) {
    assert.equal(replacedByTokenFrom({ code: "SHARE_REPLACED", replacedByToken: bad }, OLD), null, bad);
  }
});

test("a link never points to itself", () => {
  assert.equal(replacedByTokenFrom({ code: "SHARE_REPLACED", replacedByToken: OLD }, OLD), null);
});
