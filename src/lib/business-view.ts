import { useSyncExternalStore } from "react";

/**
 * Which business the invoices page shows — All Businesses, or one — remembered in this browser
 * (decision 0052: "jo latest change hy wo hi dikhy har open per").
 *
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

/** The business to show for a stored value: its id, or null for All Businesses. */
export function resolveBusinessView(
  stored: string | null | undefined,
  businesses: readonly { id: string }[],
): string | null {
  if (!stored || stored === ALL) return null;
  return businesses.some((b) => b.id === stored) ? stored : null;
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
