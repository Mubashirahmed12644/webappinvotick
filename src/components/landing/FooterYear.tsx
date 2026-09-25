"use client";

import { useSyncExternalStore } from "react";

/**
 * The year in the copyright line, read in the BROWSER so it cannot go stale.
 *
 * ## The bug this exists to prevent, seen on a competitor's live page
 *
 * Invoice Fly's footer reads **"Copyright © 2024 Invoice Fly"** on a page they were serving in
 * September 2026. It is a small thing, and on a product that handles other people's money it is
 * exactly the kind of small thing a careful person notices and draws a conclusion from.
 *
 * **Ours was one deploy away from the same sentence, by a different road.** The year was never
 * hardcoded — it was `new Date().getFullYear()` — but `/` is **statically prerendered**, so that
 * call runs once at **build time** and the answer is baked into the HTML. Nothing recomputes it
 * when a visitor arrives. Ship in December, and the page says the old year from 1 January until
 * somebody happens to deploy again.
 *
 * ## How this fixes it, and why it is not simply `useEffect`
 *
 * `useSyncExternalStore` is how React is told that the server and the client honestly have
 * different answers — the same pattern `StoreBadges` uses to read the device. The server snapshot
 * is the build year, so the prerendered HTML and the crawler both see a sensible number; the
 * client snapshot is today's year, read from the visitor's own clock. They agree on every day
 * except the ones where the build is stale, which is the only case that matters.
 *
 * There is nothing to subscribe to: the year does not change while the page is open. (It can, at
 * midnight on 31 December. A visitor who sits on the footer through the new year and does not
 * reload is not a case worth a timer.)
 */
const noSubscription = () => () => {};

/** Evaluated once, when the page is built. Deliberately NOT the same call as the client's. */
const BUILD_YEAR = new Date().getFullYear();

export function FooterYear() {
  const year = useSyncExternalStore(
    noSubscription,
    () => new Date().getFullYear(),
    () => BUILD_YEAR,
  );
  return <>{year}</>;
}
