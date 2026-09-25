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

test("the finished invoice says which kind of logo it carries, and refuses to guess", () => {
  const complete = {
    items: 1,
    has_logo: "true",
    has_tax: "false",
    has_discount: "false",
    optional_fields: 0,
  };
  // The mark we draw from the business name, and a file they chose. Both are real answers.
  for (const logo_source of ["generated", "uploaded"]) {
    assert.deepEqual(sanitiseParams("free_invoice_completed", { ...complete, logo_source }), {
      ...complete,
      logo_source,
    });
  }
  // Absent is the answer for an invoice with no logo and for a draft stored before the field
  // existed. It is optional, so the row still arrives — with the question simply unanswered (§1.7).
  assert.deepEqual(sanitiseParams("free_invoice_completed", complete), complete);
  // A third word invented by a caller is not a third kind of logo.
  assert.equal(sanitiseParams("free_invoice_completed", { ...complete, logo_source: "theirs" }), null);
});

test("the onboarding's steps are values on the ONE step event, not events of their own", () => {
  // The whole "where do people leave the onboarding" question is this one parameter (§1.1).
  for (const step of ["slide_2", "slide_3", "business", "industry", "logo_upload", "logo_made", "ready", "home"]) {
    assert.deepEqual(sanitiseParams("free_invoice_step_reached", { step }), { step });
  }
  // The invoice steps are untouched — rows sent before the onboarding existed still read.
  for (const step of ["client", "items", "done"]) {
    assert.deepEqual(sanitiseParams("free_invoice_step_reached", { step }), { step });
  }
  // `slide_1` is the tool opening, which already has its own row. Two names for one moment would
  // be one press counted twice (§1.11), so it is refused rather than quietly stored.
  assert.equal(sanitiseParams("free_invoice_step_reached", { step: "slide_1" }), null);
  assert.equal(sanitiseParams("free_invoice_step_reached", { step: "loading" }), null);
  assert.equal(sanitiseParams("free_invoice_step_reached", {}), null);
});

test("the finished invoice names the trade, and only a trade the list knows", () => {
  const complete = { items: 1, has_logo: "false", has_tax: "false", has_discount: "false", optional_fields: 0 };
  assert.deepEqual(sanitiseParams("free_invoice_completed", { ...complete, industry: "welding" }), {
    ...complete,
    industry: "welding",
  });
  assert.deepEqual(sanitiseParams("free_invoice_completed", { ...complete, industry: "other" }), {
    ...complete,
    industry: "other",
  });
  // Absent for a draft started before the onboarding, and for anybody who never reached that step.
  assert.deepEqual(sanitiseParams("free_invoice_completed", complete), complete);
  // A trade the list cannot name is not a trade.
  assert.equal(sanitiseParams("free_invoice_completed", { ...complete, industry: "astronaut" }), null);
});

test("every answer to the logo question is a value on one event", () => {
  // `kept` and `skipped` became real presses again when the onboarding's made-logo screen brought
  // back a Continue and a Skip; they had been kept in the code space through the release where
  // nothing sent them, which is why that history is still readable (§1.8).
  // `regenerated` is "try another design" — a repeated press that says something about the designs
  // somebody rejected, which a single `kept` row cannot.
  for (const choice of ["kept", "change_opened", "skipped", "regenerated"]) {
    assert.deepEqual(sanitiseParams("free_invoice_logo_choice", { choice }), { choice });
  }
  // `changed` would be a claim about an outcome nobody watched: a cancelled picker looks identical.
  assert.equal(sanitiseParams("free_invoice_logo_choice", { choice: "changed" }), null);
  assert.equal(sanitiseParams("free_invoice_logo_choice", {}), null);
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

test("a step is a parameter, and whichever step is FIRST is never one of its values", () => {
  for (const step of ["client", "items", "done"]) {
    assert.deepEqual(sanitiseParams("free_invoice_step_reached", { step }), { step });
  }
  // The rule, which has not changed: reaching the FIRST screen IS the tool opening and already has
  // a row, so it never gets a second name (§1.11). Which screen is first HAS changed — the value
  // refused used to be `business`, and since the onboarding put three value slides in front of it
  // the one refused is `slide_1`. `business` is now a real step somebody can leave at.
  assert.equal(sanitiseParams("free_invoice_step_reached", { step: "slide_1" }), null);
  assert.deepEqual(sanitiseParams("free_invoice_step_reached", { step: "business" }), { step: "business" });
  assert.equal(sanitiseParams("free_invoice_step_reached", {}), null);
});

test("the logo choice says what was pressed, never what came of it", () => {
  for (const choice of ["kept", "change_opened", "skipped", "regenerated"]) {
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
