// Run: npm test
//
// Decision 0181: a drawn logo's address ends in `#generated-logo`. The fragment is no part of the file, so the proxy
// asks for the file alone, and every other address maps exactly as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { imageFile, imageProxyUrl } from "./image.ts";

test("the fragment is no part of the file", () => {
  assert.equal(imageFile("/uploads/9f1c.jpg#generated-logo"), "/uploads/9f1c.jpg");
  assert.equal(imageFile("/uploads/9f1c.jpg"), "/uploads/9f1c.jpg");
});

test("a marked address is proxied as its file", () => {
  assert.equal(imageProxyUrl("/uploads/9f1c.jpg#generated-logo"), "/api/img/9f1c.jpg");
  assert.equal(imageProxyUrl("https://stage.invotick.com/uploads/9f1c.jpg#generated-logo"), "/api/img/9f1c.jpg");
});

test("every other address maps as before", () => {
  assert.equal(imageProxyUrl("/uploads/9f1c.jpg"), "/api/img/9f1c.jpg");
  assert.equal(imageProxyUrl("http://localhost:8081/uploads/a.png"), "/api/img/a.png");
  assert.equal(imageProxyUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(imageProxyUrl("/system-assets/header_7.png"), "/system-assets/header_7.png");
  assert.equal(imageProxyUrl("https://lh3.googleusercontent.com/x"), null);
  assert.equal(imageProxyUrl(null), null);
});
