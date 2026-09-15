// Run: npm test  (Node's own runner; Node 24 strips the types, so there is no test dependency).
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareTokenFromReferer } from "./share-link.ts";

// The backend's alphabet: 16 characters, no 0/o/1/l (SharedInvoiceService.newToken).
const TOKEN = "abcdefghijkmnpqr";

test("the share page's own address gives its token", () => {
  assert.equal(shareTokenFromReferer(`https://www.invotick.com/i/${TOKEN}`), TOKEN);
});

test("a query string, a fragment or a trailing slash do not change the token", () => {
  assert.equal(shareTokenFromReferer(`https://www.invotick.com/i/${TOKEN}?utm_source=wa#top`), TOKEN);
  assert.equal(shareTokenFromReferer(`https://www.invotick.com/i/${TOKEN}/`), TOKEN);
});

test("no referer means no token, never a guess", () => {
  assert.equal(shareTokenFromReferer(null), null);
  assert.equal(shareTokenFromReferer(undefined), null);
  assert.equal(shareTokenFromReferer(""), null);
});

test("another page of ours is not a share link", () => {
  assert.equal(shareTokenFromReferer("https://www.invotick.com/free-invoice"), null);
  assert.equal(shareTokenFromReferer(`https://www.invotick.com/embed/render/${TOKEN}`), null);
});

test("something that is not one of our tokens is refused, not stored", () => {
  // Wrong length, letters the backend never mints, upper case, a second path segment.
  for (const bad of ["abcdefghijkmnpq", "abcdefghijkmnpqrs", "abcdefghijklmnop", "ABCDEFGHIJKMNPQR", "abcdefgh0jkmnpqr"]) {
    assert.equal(shareTokenFromReferer(`https://www.invotick.com/i/${bad}`), null, bad);
  }
  assert.equal(shareTokenFromReferer(`https://www.invotick.com/i/${TOKEN}/pdf`), null);
});

test("a referer that is not a URL is ignored", () => {
  assert.equal(shareTokenFromReferer("not a url"), null);
  assert.equal(shareTokenFromReferer(`/i/${TOKEN}`), null);
});
