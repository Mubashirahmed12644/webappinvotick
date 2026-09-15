import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_STORE_URL, ownCta, smartAppBanner } from "./shared-invoice-cta.ts";

const PLAY = "https://play.google.com/store/apps/details?id=invotick.invoicemaker&referrer=x";

test("an iPhone is sent to the App Store listing", () => {
  const cta = ownCta("ios", PLAY);
  assert.equal(cta.destination, "app_store");
  assert.equal(cta.href, "https://apps.apple.com/app/id6757918977");
  assert.equal(cta.href, APP_STORE_URL);
});

test("Android keeps the Play link that carries the token", () => {
  assert.deepEqual(ownCta("android", PLAY), {
    destination: "play_store",
    href: PLAY,
    label: "Install Invotick — free",
  });
});

test("a desktop keeps the web app", () => {
  assert.equal(ownCta("desktop", PLAY).destination, "web_app");
  assert.equal(ownCta("desktop", PLAY).href, "/");
});

test("a dead link sends every device to the web app, the iPhone included", () => {
  for (const platform of ["android", "ios", "desktop"] as const) {
    assert.equal(ownCta(platform, PLAY, "web_app").destination, "web_app", platform);
  }
});

test("Safari's own banner opens this document in the app, or offers the app", () => {
  assert.deepEqual(smartAppBanner("abcdefghijkmnpqr"), {
    appId: "6757918977",
    appArgument: "https://www.invotick.com/i/abcdefghijkmnpqr",
  });
});
