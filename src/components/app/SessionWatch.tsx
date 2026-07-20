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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);

  const check = useCallback(async () => {
    // One redirect only. Once the browser is on its way out, further answers change nothing and a
    // second navigation would interrupt the first.
    //
    // Deliberately not skipped while the tab is hidden. An earlier version did, to save requests,
    // and never ran at all in environments that report a tab as hidden permanently — so the one
    // control that ends a removed session failed in the open direction, silently. Polling a quiet
    // tab is the cheaper mistake.
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
    // Fast while somebody is at the screen, slow when nobody is.
    //
    // Signing out is watched for the whole session on every open tab, so the interval that feels
    // instant to the person doing it would be a steady drip from every tab that has been left open
    // for hours. Activity is what tells those apart — a tab being looked at is the only one whose
    // owner is waiting to see the effect.
    //
    // It slows down, never stops. An earlier version stopped entirely while the tab reported itself
    // hidden, and in environments that report that permanently the check never ran at all.
    let idleSince = Date.now();
    const wake = () => {
      idleSince = Date.now();
      void check();
    };

    const tick = () => {
      void check();
      const quiet = Date.now() - idleSince > IDLE_AFTER_MS;
      timer.current = setTimeout(tick, quiet ? SLOW_POLL_MS : FAST_POLL_MS);
    };
    timer.current = setTimeout(tick, FAST_POLL_MS);

    // Coming back to the tab is the moment a person is most likely to have just signed this browser
    // out on their phone, so it is checked then rather than waiting out the interval.
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [check]);

  return null;
}

/**
 * How often to ask while somebody is at the screen.
 *
 * Close to the three seconds the sign-in poll uses, so being removed lands about as quickly as
 * being let in — which is what the person doing it is watching for.
 */
const FAST_POLL_MS = 4_000;

/** And once a tab has been sitting untouched: still watching, just not eagerly. */
const SLOW_POLL_MS = 30_000;

/** How long without a glance or a keystroke counts as untouched. */
const IDLE_AFTER_MS = 2 * 60_000;
