import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitiseParams } from "./events.ts";

test("the App Store button is recorded as the own-app click, destination app_store", () => {
  assert.deepEqual(sanitiseParams("shared_invoice_create_own_click", { destination: "app_store" }), {
    destination: "app_store",
  });
});

test("the existing destinations still pass", () => {
  for (const destination of ["play_store", "web_app"]) {
    assert.deepEqual(sanitiseParams("shared_invoice_create_own_click", { destination }), { destination });
  }
});

test("the PDF button has no App Store route, so app_store is refused there", () => {
  assert.equal(sanitiseParams("shared_invoice_pdf_click", { destination: "app_store" }), null);
});

test("a destination nobody built is refused, not stored", () => {
  assert.equal(sanitiseParams("shared_invoice_create_own_click", { destination: "open_in_app" }), null);
});
