import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "./same-origin.ts";

const req = (headers: Record<string, string>) =>
  new Request("https://invotick.com/api/auth/verify-email", { method: "POST", headers });

test("a page on our own host is accepted", () => {
  assert.equal(isSameOrigin(req({ origin: "https://invotick.com", host: "invotick.com" })), true);
});

test("the forwarded host wins behind a proxy", () => {
  assert.equal(
    isSameOrigin(req({ origin: "https://invotick.com", host: "internal:3000", "x-forwarded-host": "invotick.com" })),
    true,
  );
});

test("a page on another site is refused", () => {
  assert.equal(isSameOrigin(req({ origin: "https://evil.example", host: "invotick.com" })), false);
});

test("an unreadable origin is refused", () => {
  assert.equal(isSameOrigin(req({ origin: "null", host: "invotick.com" })), false);
});

test("with no origin, a cross-site fetch is refused and a same-origin one accepted", () => {
  assert.equal(isSameOrigin(req({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOrigin(req({ "sec-fetch-site": "same-origin" })), true);
});

test("a caller that is not a browser is let through", () => {
  assert.equal(isSameOrigin(req({})), true);
});
