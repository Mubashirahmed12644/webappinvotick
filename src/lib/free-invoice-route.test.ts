// Run: npm test
// Decision 0207 (the list lives in legacy-redirects.ts, which next.config.ts returns from redirects()): `/free-invoice` is the name anybody quoting the old docs (or guessing) would type for the free
// tool, and the tool lives at `/`. The route never existed, so the sign-in proxy answered it with 307 -> /login:
// a stranger asking for the free tool was handed a login form. A redirect in next.config runs BEFORE the proxy
// (Next's execution order: headers, redirects, proxy, ...) and keeps the query string, so UTM tags survive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_REDIRECTS } from "./legacy-redirects.ts";

async function redirects() {
  return LEGACY_REDIRECTS;
}

test("/free-invoice goes to the free tool at / with a permanent 308, not to the sign-in page", async () => {
  const rules = await redirects();
  const rule = rules.find((r) => r.source === "/free-invoice");
  assert.ok(rule, "no redirect for /free-invoice: the proxy would answer 307 -> /login");
  assert.equal(rule.destination, "/");
  assert.equal(rule.permanent, true, "permanent: true is the 308; false would be the 307 that is not cached");
});

test("the redirect has no condition that could let the login redirect through", async () => {
  const rule = (await redirects()).find((r) => r.source === "/free-invoice");
  assert.ok(rule);
  assert.deepEqual(Object.keys(rule).sort(), ["destination", "permanent", "source"]);
});

test("the policy redirect that was already here is still here", async () => {
  const rule = (await redirects()).find((r) => r.source === "/privacy");
  assert.ok(rule);
  assert.equal(rule.destination, "/privacy-policy");
});
