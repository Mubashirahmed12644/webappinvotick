// Run: npm test  (Node's own runner; Node 24 strips the types, so there is no test dependency.)
//
// The G1 question on this surface is "whose words are in this invoice", and these hold the two
// answers that decide it: what counts as a finished invoice, and when our sample stops being ours
// alone. Both are read by events nobody re-checks once they are counting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { completionParams, isComplete, originAfterEdit, touchesContent } from "./funnel.ts";
import type { FreeInvoice } from "./types.ts";

function draft(patch: Partial<FreeInvoice> = {}): FreeInvoice {
  return {
    id: "d1",
    businessName: "",
    businessAddress: "",
    businessEmail: "",
    businessPhone: "",
    logoDataUrl: null,
    invoiceNumber: "INV-000001",
    issueDate: "2026-09-23",
    dueDate: "",
    paymentTerms: "",
    poNumber: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    shipTo: "",
    items: [{ id: "i1", description: "", quantity: "1", rate: "" }],
    taxRate: "",
    discountValue: "",
    discountType: "PERCENTAGE",
    shippingCost: "",
    notes: "",
    terms: "",
    currency: "USD",
    color: "#0D4DC0",
    templateId: "simple",
    headerImage: null,
    titleColor: null,
    origin: "typed",
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const READY = {
  businessName: "Acme Studio",
  clientName: "Northwind",
  items: [{ id: "i1", description: "Design work", quantity: "2", rate: "150" }],
};

test("an invoice is complete only with a sender, a receiver and something priced", () => {
  assert.equal(isComplete(draft(READY)), true);
  assert.equal(isComplete(draft({ ...READY, businessName: "  " })), false);
  assert.equal(isComplete(draft({ ...READY, clientName: "" })), false);
  // A described line with no money on it is not a charge.
  assert.equal(isComplete(draft({ ...READY, items: [{ id: "i1", description: "Design work", quantity: "1", rate: "0" }] })), false);
  // Money with nothing said about it is not a line either.
  assert.equal(isComplete(draft({ ...READY, items: [{ id: "i1", description: "", quantity: "1", rate: "150" }] })), false);
});

test("the blank draft the page opens with is not complete", () => {
  assert.equal(isComplete(draft()), false);
});

test("completion counts filled lines, not rows", () => {
  const p = completionParams(
    draft({
      ...READY,
      items: [
        { id: "i1", description: "Design work", quantity: "2", rate: "150" },
        // The empty row the form always keeps at the end is not a line item anybody added.
        { id: "i2", description: "", quantity: "1", rate: "" },
      ],
    }),
  );
  assert.equal(p.items, 1);
});

test("completion reports the optional fields as a count, and the flags as the app's strings", () => {
  const p = completionParams(
    draft({ ...READY, logoDataUrl: "data:image/png;base64,x", taxRate: "8.5", notes: "Thanks", clientEmail: "a@b.c" }),
  );
  assert.equal(p.has_logo, "true");
  assert.equal(p.has_tax, "true");
  assert.equal(p.has_discount, "false");
  assert.equal(p.optional_fields, 2);
  assert.equal(p.source, "typed");
});

test("a draft with no origin sends no source at all — unknown is never `typed`", () => {
  const p = completionParams(draft({ ...READY, origin: undefined }));
  assert.equal("source" in p, false);
});

test("a sample stays a sample until the person edits its content, and never becomes `typed`", () => {
  assert.equal(originAfterEdit("sample"), "sample_edited");
  assert.equal(originAfterEdit("sample_edited"), "sample_edited");
  assert.equal(originAfterEdit("typed"), "typed");
  assert.equal(originAfterEdit(undefined), undefined);
});

test("a template, a colour or the currency is ours — changing one is not the person's data", () => {
  assert.equal(touchesContent({ templateId: "creative", headerImage: "/h.png", color: "#111" }), false);
  assert.equal(touchesContent({ currency: "PKR" }), false);
  assert.equal(touchesContent({ businessName: "Acme" }), true);
  assert.equal(touchesContent({ logoDataUrl: "data:image/png;base64,x" }), true);
  assert.equal(touchesContent({ notes: "Thanks" }), true);
});
