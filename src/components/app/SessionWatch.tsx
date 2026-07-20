"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Notices when this browser has been signed out from the phone.
 *
 * Signing a device out is a decision made somewhere else, and nothing tells this tab about it. The
 * layout checks once while rendering, so a reload caught it — but moving around inside the app is a
 * soft navigation that never re-renders the layout, and the session stayed usable until something
 * happened to reload the page. Someone could go on working in an account they had just been removed
 * from.
 *
 * It is the mirror of how signing *in* works: the browser polls, and acts the moment the answer
 * changes. The same shape, in the other direction.
 */
export function SessionWatch() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaving = useRef(false);

  const check = useCallback(async () => {
    // One redirect only. Once the browser is on its way out, further answers change nothing and a
    // second navigation would interrupt the first.
    //
    // Deliberately not skipped while the tab is hidden. An earlier version did, to save requests,
    // and never ran at all in environments that report a tab as hidden permanently — so the one
    // control that ends a removed session failed in the open direction, silently. A request every
    // twenty seconds is the cheaper mistake.
    if (leaving.current) return;

    const res = await fetch("/api/backend/v1/profile/me", { cache: "no-store" }).catch(() => null);
    // A network blip must not sign anybody out — only the server actually saying so does.
    if (!res || res.status !== 401) return;

    leaving.current = true;
    // Full navigation rather than a router push: the cookie is dropped by the server on this route,
    // and a soft navigation would keep the dead session in memory.
    window.location.href = "/login?signout=1";
  }, []);

  useEffect(() => {
    timer.current = setInterval(check, POLL_MS);

    // Coming back to the tab is the moment a person is most likely to have just signed this browser
    // out on their phone, so it is checked then rather than waiting out the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  return null;
}

/**
 * How often to ask.
 *
 * Short enough that being removed feels immediate to the person who did it, long enough that an
 * open tab is not a steady drip of requests.
 */
const POLL_MS = 20_000;
