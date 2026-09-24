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

/* ---------------- the guided first invoice (decision 0165) ---------------- */

test("the tool's open names its door, and the two doors are not interchangeable", () => {
  assert.deepEqual(sanitiseParams("free_invoice_tool_opened", { method: "cta_press" }), { method: "cta_press" });
  assert.deepEqual(sanitiseParams("free_invoice_tool_opened", { method: "deep_link" }), { method: "deep_link" });
  // A missing method would make a press and a reload one number, so the row is refused instead.
  assert.equal(sanitiseParams("free_invoice_tool_opened", {}), null);
  assert.equal(sanitiseParams("free_invoice_tool_opened", { method: "button" }), null);
});

test("a step is a parameter, and `business` is deliberately not one of its values", () => {
  for (const step of ["client", "items", "done"]) {
    assert.deepEqual(sanitiseParams("free_invoice_step_reached", { step }), { step });
  }
  // Reaching step 1 IS the tool opening and already has a row; a second name for one moment is one
  // press counted twice (§1.11). So this value must never be accepted.
  assert.equal(sanitiseParams("free_invoice_step_reached", { step: "business" }), null);
  assert.equal(sanitiseParams("free_invoice_step_reached", {}), null);
});

test("the logo choice says what was pressed, never what came of it", () => {
  for (const choice of ["kept", "change_opened", "skipped"]) {
    assert.deepEqual(sanitiseParams("free_invoice_logo_choice", { choice }), { choice });
  }
  // `changed` would claim an outcome the press cannot see — a cancelled picker looks identical
  // (§1.14). `has_logo` on `free_invoice_completed` is where that question is answered honestly.
  assert.equal(sanitiseParams("free_invoice_logo_choice", { choice: "changed" }), null);
  assert.equal(sanitiseParams("free_invoice_logo_choice", { choice: "uploaded" }), null);
});

test("a landing badge press is its own name, with only the two stores as destinations", () => {
  assert.deepEqual(sanitiseParams("free_invoice_store_badge_click", { destination: "play_store" }), {
    destination: "play_store",
  });
  // Declared before it can be rendered: there is no App Store listing, so no row carries this yet.
  assert.deepEqual(sanitiseParams("free_invoice_store_badge_click", { destination: "app_store" }), {
    destination: "app_store",
  });
  // The offer's third destination is not a store and must not arrive here (§1.15).
  assert.equal(sanitiseParams("free_invoice_store_badge_click", { destination: "web_account" }), null);
  assert.equal(sanitiseParams("free_invoice_store_badge_click", {}), null);
});

test("the badge press and the offer press stay two names, because they are two populations", () => {
  // §1.4: somebody who went straight to the store without trying the tool, and somebody who already
  // got a PDF out of it. One id for both would raise the offer's numbers with nothing saying so.
  assert.notEqual("free_invoice_store_badge_click", "free_invoice_install_offer_click");
  assert.ok(isWebEventName("free_invoice_store_badge_click"));
  assert.ok(isWebEventName("free_invoice_install_offer_click"));
});
