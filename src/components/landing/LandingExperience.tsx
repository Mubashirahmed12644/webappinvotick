"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FreeInvoiceTool } from "@/components/free-invoice/FreeInvoiceTool";
import { InvoiceGlimpse } from "./InvoiceGlimpse";
import { StoreBadges } from "./StoreBadges";

/**
 * The hybrid landing — option C.
 *
 * A message, a look at an invoice, **one** button, and the stores underneath it. Pressing the button
 * opens the real tool **on this page**: no route change, no second page, no server round trip.
 *
 * ## The rule this whole shape exists to keep
 *
 * `/` is the page that ranks for "free invoice generator". It must stay statically prerendered, so
 * nothing in this tree may read `headers()`, `cookies()` or the request in any form — the device is
 * read in the browser instead (`StoreBadges`). And the tool must not move to `/create`: a page hop
 * between the search result and the form is a place for free traffic to fall out of.
 *
 * ## The tool is HIDDEN, not unmounted, and that is the decision
 *
 * `<div hidden>` rather than `{open && <FreeInvoiceTool/>}`, for three reasons that all point the
 * same way:
 *
 * 1. **The markup stays in the static HTML.** Every label, placeholder and heading inside the tool
 *    is in the prerendered page exactly as it is today. A crawler sees the same page it saw
 *    yesterday, which is the one thing this change was not allowed to cost.
 * 2. **The press is instant.** Nothing is fetched, parsed or mounted when the button is pressed —
 *    the form is already there. On the phone that is 88.5 % of this traffic, that is the difference
 *    between a reveal and a wait.
 * 3. **Not one existing event changes meaning.** The tool still mounts on page load, so its draft
 *    restore, its autosave and its `free_invoice_completed` fire exactly when they fired before.
 *    Unmounting it would have quietly moved all three behind a button press.
 *
 * `hidden` also takes the whole form out of the accessibility tree and out of the tab order while it
 * is closed, so a keyboard or screen-reader user is not walked through forty fields to reach the
 * FAQ.
 *
 * ## `#create` is a bookmark, not a route
 *
 * Opening the tool writes `#create` with `replaceState`, so a reload or a shared link lands with the
 * form already open — and the browser never leaves the page. It is deliberately `replaceState` and
 * not `pushState`: the back button belongs to "where I came from", not to "I closed a panel".
 */
/** The hash is the browser's state, not React's, so React is told to read it rather than copy it. */
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function LandingExperience() {
  // Two independent ways in, ORed rather than merged into one piece of state: the button, and a URL
  // that already says `#create`. The hash is read through `useSyncExternalStore`, so a reload or a
  // shared link renders WITH the form open on the very first client render — no flash of the hero,
  // and no state set from inside an effect.
  const [pressed, setPressed] = useState(false);
  const hashOpen = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash === "#create",
    () => false,
  );
  const open = pressed || hashOpen;

  /**
   * Only a PRESS scrolls and takes focus.
   *
   * Arriving on `#create` deliberately does neither: a page that jumps and pops the keyboard open
   * before the reader has done anything is a page fighting them. The press is different — they
   * asked for the form, so the form is where they are put, and the first field is the one they
   * need.
   *
   * This runs after the commit that removes `hidden`. Focusing an element that is still hidden does
   * nothing at all, and does it silently.
   */
  useEffect(() => {
    if (!pressed) return;
    document.getElementById("create")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("fi-business-name")?.focus({ preventScroll: true });
  }, [pressed]);

  function reveal() {
    setPressed(true);
    try {
      if (window.location.hash !== "#create") {
        window.history.replaceState(null, "", "#create");
      }
    } catch {
      // A browser that refuses `replaceState` still gets the tool; only the bookmark is lost.
    }
  }

  return (
    <>
      <section
        aria-labelledby="landing-title"
        className={open ? "pb-2" : "grid items-center gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12"}
      >
        <div className={open ? "" : "text-center lg:col-start-1 lg:row-start-1 lg:text-start"}>
          {!open && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-container)] px-3 py-1.5 text-xs font-bold text-[var(--color-on-primary-container)]">
              100% free · No sign-up to start
            </span>
          )}
          <h1
            id="landing-title"
            className={
              open
                ? "text-xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-2xl"
                : "mt-4 text-[1.85rem] font-extrabold leading-[1.12] tracking-tight text-[var(--color-on-background)] sm:text-5xl"
            }
          >
            Free invoice generator
            {!open && (
              <span className="mt-1 block text-[var(--color-primary)]">that gets you paid faster</span>
            )}
          </h1>
          {/* Two lines on a phone, deliberately. The first draft ran to four, and four lines of
              grey text is 160 px between the headline and the one button this page has. */}
          {!open && (
            <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[var(--color-on-surface-variant)] sm:mt-4 sm:text-lg lg:mx-0">
              Fill in your details, download the PDF. No account, no watermark, nothing to install.
            </p>
          )}
        </div>

        {!open && (
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <InvoiceGlimpse />
          </div>
        )}

        {!open && (
          <div className="lg:col-start-1 lg:row-start-2">
            {/* ONE prominent button. Full width on a phone so it is the only thing to aim at, and
                `min-h-14` (56 px) so it clears the 44 px tap target with room to spare — and keeps
                clearing it when the label grows with the reader's font scale, because the height is
                a minimum and not a height (`LAYOUT_RULES.md`). */}
            <button
              type="button"
              onClick={reveal}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-7 text-center text-base font-extrabold text-[var(--color-on-primary)] shadow-lg shadow-[var(--color-primary)]/25 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:brightness-95 sm:w-auto sm:text-lg"
            >
              Create invoice
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="mt-3 text-center text-sm text-[var(--color-on-surface-variant)] lg:text-start">
              Opens right here · Free · No sign-up
            </p>
            <StoreBadges />
          </div>
        )}
      </section>

      {/*
        Always rendered, hidden until asked for. See the note at the top of this file: the markup is
        what the crawler reads, and unmounting it would have moved the tool's own events behind a
        press.
      */}
      <section id="create" aria-label="Invoice generator" hidden={!open} className="scroll-mt-4">
        <FreeInvoiceTool />
      </section>
    </>
  );
}
