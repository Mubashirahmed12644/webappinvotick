import { useSyncExternalStore } from "react";
import { localDate } from "./invoice-status";

// The viewer's date is read, not watched: nothing to subscribe to.
const noSubscription = () => () => {};

/**
 * Today (YYYY-MM-DD) on the viewer's own calendar. It decides what is overdue: an invoice is late from
 * the day after its due date, counted in calendar days where the viewer is, as in the app.
 *
 * The server cannot know the viewer's timezone, so the server render and hydration use `serverToday`,
 * the server's date (UTC on Vercel); the render after hydration switches to the viewer's. The two
 * differ only while the viewer's calendar is on another day, e.g. in Pakistan from midnight to 5am.
 *
 * The invoice list and the dashboard both read it, so they say the same thing on the same day.
 */
export function useViewerToday(serverToday: string): string {
  return useSyncExternalStore(noSubscription, localDate, () => serverToday);
}
