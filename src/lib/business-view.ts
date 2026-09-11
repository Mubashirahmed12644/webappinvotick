import { useSyncExternalStore } from "react";

/**
 * Which business the invoices page shows — All Businesses, or one — remembered in this browser
 * (decision 0052: "jo latest change hy wo hi dikhy har open per").
 *
 * - The choice exists only when the user has more than one business. With one there is nothing to
 *   choose: the page goes by that business's name, and a stored choice is not read.
 * - Never chosen, or the chosen business no longer exists: All.
 * - Read after hydration. The server cannot see localStorage, so the server render and the first
 *   client render both show All (React hydrates from the server snapshot) and the stored choice
 *   arrives in the render after. No hydration mismatch, at the cost of that one re-render.
 * - Read afresh each time the page mounts, so every open shows the latest choice. A choice made in
 *   another tab does not move a view that is already on screen.
 * - When the browser refuses storage (blocked site data), the choice holds while the page stays
 *   open; it is not remembered.
 */
export const BUSINESS_VIEW_KEY = "invotick.business-view";
const ALL = "all";

/** What the page calls the view that spans every business. */
export const ALL_BUSINESSES = "All Businesses";

/**
 * The business to show for a stored value: its id, or null for every invoice combined. Always null
 * with one business or none, where there is no choice to apply.
 */
export function resolveBusinessView(
  stored: string | null | undefined,
  businesses: readonly { id: string }[],
): string | null {
  if (businesses.length < 2) return null;
  if (!stored || stored === ALL) return null;
  return businesses.some((b) => b.id === stored) ? stored : null;
}

/**
 * The name the page gives the view: the chosen business; with exactly one business, that business,
 * because "All Businesses" reads as if there were others; otherwise All Businesses.
 *
 * With one business the page still lists every invoice, as it did under All, including the ones with
 * no business recorded (3,282 of 6,674 live invoices on 2026-09-11). Filtering by the business would
 * have hidden them.
 */
export function businessViewName(
  chosen: { name: string } | null,
  businesses: readonly { name: string }[],
): string {
  if (chosen) return chosen.name;
  if (businesses.length === 1) return businesses[0].name;
  return ALL_BUSINESSES;
}

// The value this page is showing; undefined until it has been read from storage.
let current: string | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): string | null {
  if (current === undefined) {
    try {
      current = window.localStorage.getItem(BUSINESS_VIEW_KEY);
    } catch {
      current = null;
    }
  }
  return current;
}

function subscribe(onChange: () => void): () => void {
  // The first subscriber is the page mounting: read storage again, so an open after a choice made
  // elsewhere shows that choice. React re-reads the snapshot right after subscribing.
  if (listeners.size === 0) current = undefined;
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getServerSnapshot = (): string | null => null;

/** The store behind the hook, exported so its behaviour can be checked without a browser. */
export const businessViewStore = { subscribe, getSnapshot, getServerSnapshot };

/** Remember a choice: a business id, or null for All Businesses. */
export function saveBusinessView(businessId: string | null): void {
  current = businessId ?? ALL;
  try {
    window.localStorage.setItem(BUSINESS_VIEW_KEY, current);
  } catch {
    // Storage refused: the choice holds while the page stays open.
  }
  listeners.forEach((l) => l());
}

/** The stored choice, as stored; null on the server and while hydrating. */
export function useStoredBusinessView(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
