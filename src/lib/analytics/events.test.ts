// Run: npm test  (Node's own runner; Node 24 strips the types, so there is no test dependency.)
//
// These guard the ONE thing that makes a web event vanish without a sound: the route drops anything
// the schema does not recognise, and answers 400 for a missing required parameter. A call site that
// sends a key this file has not declared produces no row and no error anybody sees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_TOOL_EVENT_NAMES, isWebEventName, sanitiseParams, surfaceForEvent } from "./events.ts";

test("every free-tool name is accepted and lands on the free-tool surface", () => {
  for (const name of FREE_TOOL_EVENT_NAMES) {
    assert.ok(isWebEventName(name), `${name} is not on the permitted list`);
    assert.equal(surfaceForEvent(name), "web_free_tool");
  }
});

test("the share page keeps its own surface", () => {
  assert.equal(surfaceForEvent("shared_invoice_page_view"), "web_share_link");
  assert.equal(surfaceForEvent("shared_invoice_create_own_click"), "web_share_link");
});

test("an event name we do not send is refused", () => {
  assert.equal(isWebEventName("invoice_shared_success"), false);
  assert.equal(isWebEventName("free_invoice_downloaded"), false);
});

test("the page view carries nothing, and anything sent with it is dropped", () => {
  assert.deepEqual(sanitiseParams("free_invoice_page_view", { utm_source: "fb" }), {});
});

test("form_typed keeps its form and refuses one that is not a form", () => {
  assert.deepEqual(sanitiseParams("free_invoice_form_typed", { form: "business" }), { form: "business" });
  assert.equal(sanitiseParams("free_invoice_form_typed", { form: "totals" }), null);
  assert.equal(sanitiseParams("free_invoice_form_typed", {}), null);
});

test("completed keeps every required parameter, and source stays off when unknown", () => {
  const complete = {
    items: 3,
    has_logo: "true",
    has_tax: "false",
    has_discount: "false",
    optional_fields: 4,
  };
  // No source: a draft saved before the origin field existed is unknown, never `typed` (§1.7).
  assert.deepEqual(sanitiseParams("free_invoice_completed", complete), complete);
  assert.deepEqual(sanitiseParams("free_invoice_completed", { ...complete, source: "sample_edited" }), {
    source: "sample_edited",
    ...complete,
  });
  // A missing required parameter drops the whole event rather than storing a half-formed row.
  assert.equal(sanitiseParams("free_invoice_completed", { ...complete, items: undefined }), null);
  assert.equal(sanitiseParams("free_invoice_completed", { ...complete, has_logo: "yes" }), null);
  assert.equal(sanitiseParams("free_invoice_completed", { ...complete, optional_fields: 99 }), null);
});

test("a failed pdf keeps the error's class name and nothing that could be free text", () => {
  assert.deepEqual(
    sanitiseParams("free_invoice_pdf_download", { outcome: "failed", exception_class: "TypeError" }),
    { outcome: "failed", exception_class: "TypeError" },
  );
  // A sentence under an identifier's key is dropped; the event itself still arrives.
  assert.deepEqual(
    sanitiseParams("free_invoice_pdf_download", {
      outcome: "failed",
      exception_class: "Error: could not read /Users/ayesha/Acme Studio logo.png",
    }),
    { outcome: "failed" },
  );
  assert.equal(sanitiseParams("free_invoice_pdf_download", { outcome: "downloaded" }), null);
});

test("the offer's destinations are exactly the three that exist", () => {
  for (const destination of ["play_store", "app_store", "web_account"]) {
    assert.deepEqual(sanitiseParams("free_invoice_install_offer_click", { destination }), { destination });
  }
  // `web_app` is the share page's value and means a different place (§1.15).
  assert.equal(sanitiseParams("free_invoice_install_offer_click", { destination: "web_app" }), null);
});

test("a dismissal names how it was closed", () => {
  assert.deepEqual(sanitiseParams("free_invoice_install_offer_dismissed", { method: "not_now" }), {
    method: "not_now",
  });
  assert.equal(sanitiseParams("free_invoice_install_offer_dismissed", { method: "ignored" }), null);
});
