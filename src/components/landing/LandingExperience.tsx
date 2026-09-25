"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { GuidedFirstInvoice } from "@/components/free-invoice/GuidedFirstInvoice";
import { Onboarding } from "@/components/free-invoice/Onboarding";
import { useFreeInvoice } from "@/components/free-invoice/useFreeInvoice";
import { trackWebEvent } from "@/lib/analytics/client";
import { InvoiceGlimpse } from "./InvoiceGlimpse";

/**
 * The hybrid landing — option C of decision 0164, with 0165's fixes measured on the live site.
 *
 * A message, **one** button, a look at an invoice, and the stores. Pressing the button opens the
 * guided first-invoice flow **on this page**: no route change, no second page, no server round trip.
 *
 * ## The rule this whole shape exists to keep
 *
 * `/` is the page that ranks for "free invoice generator". It must stay statically prerendered, so
 * nothing in this tree may read `headers()`, `cookies()` or the request in any form — the device is
 * read in the browser instead (`StoreBadges`). And the tool must not move to `/create`: a page hop
 * between the search result and the form is a place for free traffic to fall out of.
 *
 * ## The fold, measured — the reason the order changed on a phone
 *
 * On a 375×667 phone (a budget Android and the iPhone SE, and India / South Africa / Pakistan are
 * where this traffic comes from) the "Create invoice" button's bottom edge sat at **696 px against
 * a 667 px viewport** — 27 px of a 56 px button, below the fold, on the one page whose whole job is
 * to get that button pressed. The glimpse above it is ~320 px of decoration and is what put it
 * there.
 *
 * So on a phone the order is **message → button → stores → glimpse**, and from `lg` the glimpse
 * takes the second column and the original arrangement is untouched. It is not hidden and not
 * shrunk: it is still the first thing under the fold, which is where a person who wants to see
 * before pressing will scroll anyway.
 *
 * ## One promise, said once
 *
 * The page used to say "no sign-up" three times — a pill above the headline, the subline, and a
 * line under the button. Three statements of one fact read as a page trying to convince you. The
 * subline keeps it; the pill and the under-button line are gone, which is also ~90 px of the height
 * the button needed.
 *
 * ## The tool is HIDDEN, not unmounted, and that is the decision
 *
 * `<div hidden>` rather than `{open && <GuidedFirstInvoice/>}`, for three reasons that all point the
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
 * not `pushState`: from step 1, Back belongs to "where I came from", not to "I closed a panel".
 *
 * **Each guided step after the first does push one**, so Back inside the flow means one step back
 * rather than out of the page — `GuidedFirstInvoice`'s `STEP_HASH`. Those hashes all begin
 * `#create`, which is what the snapshot below tests, so every one of them is still a door in.
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
  /**
   * The one draft on the page, held HERE because two things now render it: the onboarding and the
   * invoice screen. A second `useFreeInvoice()` would give the page two debounced autosaves racing
   * over one IndexedDB row and would fire every funnel event twice — the danger 0165 named when
   * the guided flow and the full editor were split, arriving by a new road.
   */
  const fi = useFreeInvoice();
  /**
   * False while the onboarding is on screen, true once it is done. Exactly one of the two owns the
   * history stack at a time; two components pushing entries would make Back mean whichever of them
   * ran last.
   */
  const [onboarded, setOnboarded] = useState(false);
  /** The page's one file input lives inside the invoice screen; the onboarding borrows it. */
  const logoPickRef = useRef<() => void>(() => {});

  /**
   * The hand-over is a history entry like every other step, so Back out of the invoice screen
   * returns to the onboarding's last screen rather than stranding somebody on a hidden panel.
   */
  function finishOnboarding() {
    try {
      window.history.pushState({ fiStep: 2, onboarded: true }, "", "#create-client");
    } catch {
      // No entry, but the hand-over still happens. Only Back across it is lost.
    }
    setOnboarded(true);
  }

  /**
   * Which of the two owns the page after a Back or Forward.
   *
   * Read from the entry's own state where there is one, and from the hash otherwise — a hash the
   * invoice screen owns means the invoice screen, and anything else means the onboarding.
   */
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      const state = event.state as { onboarded?: unknown } | null;
      const hash = window.location.hash;
      const toolOwns = hash === "#create-client" || hash === "#create-items" || hash === "#create-done";
      setOnboarded(state?.onboarded === true || toolOwns);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const hashOpen = useSyncExternalStore(
    subscribeToHash,
    // `startsWith`, not equality: the onboarding and the invoice screen each push one history
    // entry per step (`#create-send`, `#create-trade`, `#create-client`, …) so that Back means one
    // step back. They are all the same door, and a link to any of them opens the tool.
    //
    // ⚠️ This was written as equality until 2026-09-25 while the comment above already claimed
    // `startsWith`. A script that edited this file threw before it wrote, so 0166's doc landed and
    // its code did not, and a reload on `#create-client` rendered the hero instead of the tool.
    () => window.location.hash.startsWith("#create"),
    () => false,
  );
  const open = pressed || hashOpen;

  /**
   * One row the first time the tool opens, saying which door it was (decision 0164's proposal,
   * built here). **This is the number this page exists to move**, and until now nothing counted it:
   * `free_invoice_page_view` says somebody landed, and nothing at all said anybody pressed.
   *
   * `cta_press` and `deep_link` are two real ways in and must not be one number — arriving on a URL
   * that already says `#create` is a reload, a bookmark or a shared link, not somebody being
   * persuaded by the button.
   *
   * It is also **step 1 of the guided flow**, which is why `free_invoice_step_reached` starts at
   * `client`: one action, one event (§1.1). A second row here for "reached the business step" would
   * be the same press counted twice.
   *
   * The ref is not decoration: React runs effects twice in development Strict Mode, and `open` can
   * become true by either route.
   */
  const reported = useRef(false);
  useEffect(() => {
    if (!open || reported.current) return;
    reported.current = true;
    trackWebEvent("free_invoice_tool_opened", { method: pressed ? "cta_press" : "deep_link" });
  }, [open, pressed]);

  /**
   * Only a PRESS scrolls.
   *
   * Arriving on `#create` deliberately does not: a page that jumps before the reader has done
   * anything is a page fighting them. The press is different — they asked for the tool, so the
   * tool is where they are put.
   */
  function reveal() {
    // `flushSync`, so the section is un-`hidden` before this handler returns and anything it then
    // touches is really in the document. The onboarding's first screen is a value slide with no
    // field, so nothing is focused here; each later step takes focus inside its own gesture, which
    // is the only way iOS Safari keeps the keyboard open (`Onboarding.go`).
    flushSync(() => setPressed(true));
    document.getElementById("create")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <h1
            id="landing-title"
            className={
              open
                ? "text-xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-2xl"
                : "text-[1.85rem] font-extrabold leading-[1.12] tracking-tight text-[var(--color-on-background)] sm:text-5xl"
            }
          >
            Free invoice generator
            {!open && (
              <span className="mt-1 block text-[var(--color-primary)]">that gets you paid faster</span>
            )}
          </h1>
          {/* The page's ONE promise. Two lines on a phone, deliberately: the first draft ran to
              four, and four lines of grey text is 160 px between the headline and the one button
              this page has. */}
          {!open && (
            <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[var(--color-on-surface-variant)] sm:mt-4 sm:text-lg lg:mx-0">
              Three questions, then download the PDF. No account, no watermark, nothing to install.
            </p>
          )}

          {/*
            Two facts, and both of them ours.

            Invoice Fly's first screen carries 4.8 stars, "125,000 small businesses" and a press
            band — earned, and **we cannot copy any of it**: there is no Play rating for Invotick at
            all, so no number here was invented. These two are true and were already being said on
            the first value slide, where a visitor only sees them after pressing the button.

            The second one is the point. "96% never made an account" is not a claim about the
            promise this page makes — it is **proof of it**, in the sentence directly above.

            One line, not a box: at a 1.5× font scale a two-column box becomes three lines and
            pushes the button down, while a line simply wraps. `gap-y` carries the wrap.
          */}
          {!open && (
            <p className="mx-auto mt-3 flex max-w-[42ch] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-on-surface-variant)] sm:text-sm lg:mx-0 lg:justify-start">
              <span>
                <b className="font-extrabold text-[var(--color-on-surface)]">4,000+</b> businesses
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span>
                <b className="font-extrabold text-[var(--color-on-surface)]">96%</b> never made an account
              </span>
            </p>
          )}
        </div>

        {/*
          The button comes BEFORE the glimpse in source order, so a phone — which reads this grid as
          one column — gets it above the fold. From `lg` the explicit row/column placements below
          put everything back where 0164 had it: text top-left, glimpse down the right, button
          bottom-left. The source order is the phone's layout; the placement classes are the
          desktop's.
        */}
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
            {/*
              The store badges are NOT here any more — they are in the site footer.

              0165 put them beside the button, reasoning that "or get the app" is the second choice
              this page offers. The evidence says otherwise, and it is Invoice Fly's own page:
              their App Store and Google Play badges sit at the very bottom, in the footer, after
              Pricing / Blog / Help Center and just above the copyright. Above the fold they carry
              **no** store button at all.

              The reason is the one this page is judged on: its job is to get a stranger into an
              invoice, and every button above the fold that leads somewhere else is a way out of
              that. Measured here: the badge block ran 331 → 505 px and pushed the sample invoice
              — the one thing their first screen does not have at all — to the very bottom edge of
              a 375×812 phone. Moving it down brings the invoice fully inside the fold.

              The badges themselves are unchanged, including the device-aware ordering of 0164.
              Only where they sit has changed.
            */}
          </div>
        )}

        {!open && (
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <InvoiceGlimpse />
          </div>
        )}
      </section>

      {/*
        Always rendered, hidden until asked for. See the note at the top of this file: the markup is
        what the crawler reads, and unmounting it would have moved the tool's own events behind a
        press.
      */}
      <section id="create" aria-label="Invoice generator" hidden={!open} className="scroll-mt-4">
        {/*
          The onboarding (decision 0167) — three value slides, then the four questions, then the
          first invoice. Unlike the invoice screen below it holds no markup a crawler needs: every
          heading in it is a screen somebody walks through, not content about the product. It is
          still `hidden` rather than unmounted, so its draft and the invoice screen's stay one.
        */}
        <div hidden={onboarded}>
          <Onboarding fi={fi} onDone={finishOnboarding} onPickLogo={() => logoPickRef.current()} />
        </div>

        {/*
          Always rendered, hidden until the onboarding is done. Its markup is what the crawler reads
          on the page that ranks for "free invoice generator", and unmounting it would take
          `#fi-paper` with it — which is what the PDF export clones.
        */}
        <div hidden={!onboarded}>
          <GuidedFirstInvoice
            fi={fi}
            active={onboarded}
            initialStep={2}
            coachClient
            exposeLogoPicker={(openPicker) => {
              logoPickRef.current = openPicker;
            }}
          />
        </div>
      </section>
    </>
  );
}
