"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { totalsFor } from "@/lib/free-invoice/adapter";
import { trackWebEvent } from "@/lib/analytics/client";
import { logoMarkDataUrl, LOGO_DESIGNS } from "@/lib/free-invoice/logo-mark";
import { industryById, searchIndustries, templateIdForIndustry } from "@/lib/free-invoice/industries";
import { templateById } from "@/lib/free-invoice/templates";
import { GuidedInvoiceCard } from "./GuidedInvoiceCard";
import type { useFreeInvoice } from "./useFreeInvoice";

/**
 * The onboarding — three value slides, then the four questions, then the first invoice.
 *
 * Built from the design the owner approved on 2026-09-25, which was in turn built screen by screen
 * from Invoice Fly's own onboarding out of his screenshots. Their order, their shapes, our words
 * and our facts.
 *
 * ## The one thing of theirs we deliberately did NOT take
 *
 * Their very first screen is a **sign-in wall**: three provider rows and a guest button, shown
 * before any reason to want the product has been given. **96.6 % of our users are guests**, and the
 * standing rule here is that nothing is asked before an invoice exists. So the wall is not built,
 * and the only way back for a returning user is a quiet *Sign in* in the corner of slide 1 — a door,
 * never a gate.
 *
 * ## What is NOT here, and why
 *
 * - **No paywall.** The mockup draws the *moment* one would appear and says in the frame itself
 *   that its content, price and placement are the owner's decision, not ours. Nothing here adds,
 *   moves, weakens or removes a gate.
 * - **No ad, and no space kept for one.** The owner settled this on 2026-09-25: we have no AdSense
 *   approval, so the web tool cannot carry ads at all.
 * - **No PRO crown and no six-tab bar** on the invoices home, though the design draws both. They
 *   are the app's chrome: on the web there is no Estimates, Clients, Items, Reports or Settings
 *   screen to reach, and a crown that opens nothing would be a gate we invented. Drawing a control
 *   that goes nowhere is a promise the page cannot keep.
 *
 * ## Everything 0165 and 0166 measured still holds
 *
 * Focus is taken **inside the gesture handler** after a `flushSync`, never from an effect — iOS
 * Safari keeps a keyboard up only for a focus in the gesture's own call stack. Every step pushes
 * one history entry, so Back means one step back. Both rules are the same ones `GuidedFirstInvoice`
 * keeps, and they are kept here for the same measured reasons.
 */

export type Phase =
  | "slide1"
  | "slide2"
  | "slide3"
  | "loading"
  | "business"
  | "trade"
  | "logo"
  | "logoMade"
  | "ready"
  | "home";

/**
 * One hash per phase, all beginning `#create` — which is what `LandingExperience` tests for, so
 * every one of them is still a door into the tool rather than a URL that renders the hero.
 */
export const PHASE_HASH: Record<Phase, string> = {
  slide1: "#create",
  slide2: "#create-send",
  slide3: "#create-offline",
  loading: "#create-loading",
  business: "#create-business",
  trade: "#create-trade",
  logo: "#create-logo",
  logoMade: "#create-logo-made",
  ready: "#create-ready",
  home: "#create-invoices",
};

/**
 * The value each phase reports as `free_invoice_step_reached`'s `step`.
 *
 * **`slide1` has none, deliberately.** Reaching slide 1 *is* the tool opening, and that already has
 * a row (`free_invoice_tool_opened`). Two names for one moment is one press counted twice
 * (AGENTS-EVENTS §1.11) — the same reason `business` was excluded when the business field was
 * step 1. It is no longer step 1, so it gets a value of its own now.
 *
 * **`loading` has none either**, and that is not an oversight: it appears only if opening the local
 * database is slow enough to see, so a row for it would be a row whose absence means two different
 * things — fast, or gone. Whether it was slow belongs to a timing question, not to this funnel.
 */
const PHASE_STEP: Partial<Record<Phase, string>> = {
  slide2: "slide_2",
  slide3: "slide_3",
  business: "business",
  trade: "industry",
  logo: "logo_upload",
  logoMade: "logo_made",
  ready: "ready",
  home: "home",
};

/** The field each phase exists to have filled. The rest have nothing to type. */
const PHASE_FOCUS: Partial<Record<Phase, string>> = {
  business: "ob-business-name",
  trade: "ob-trade-search",
};

const ORDER: Phase[] = [
  "slide1",
  "slide2",
  "slide3",
  "loading",
  "business",
  "trade",
  "logo",
  "logoMade",
  "ready",
  "home",
];

export function phaseFromHash(hash: string): Phase | null {
  const found = (Object.keys(PHASE_HASH) as Phase[]).find((p) => PHASE_HASH[p] === hash);
  return found ?? null;
}

interface Props {
  fi: ReturnType<typeof useFreeInvoice>;
  /** The person is done with the onboarding and wants the invoice screen. */
  onDone: () => void;
  /** Opens the one file input on the page, which lives in `GuidedFirstInvoice`. */
  onPickLogo: () => void;
}

export function Onboarding({ fi, onDone, onPickLogo }: Props) {
  const [phase, setPhase] = useState<Phase>("slide1");
  const [query, setQuery] = useState("");
  /** Which of the eight designs is on screen. Incremented for ever; the drawer wraps. */
  const [design, setDesign] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const reachedRef = useRef<Set<Phase>>(new Set());
  const movedRef = useRef(false);

  const { inv } = fi;
  const brand = inv.color || "#0d4dc0";
  const name = inv.businessName.trim();
  const industry = industryById(inv.industry);
  const results = searchIndustries(query);

  /** A press takes the reader to the top of the new phase; the first render never scrolls. */
  useEffect(() => {
    if (!movedRef.current) return;
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  /**
   * Back and Forward move the phase, because each one pushed its own entry. It deliberately does
   * not take focus: returning to a screen is reading, not typing.
   */
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      const state = event.state as { obPhase?: unknown } | null;
      const asked =
        typeof state?.obPhase === "string" ? (state.obPhase as Phase) : phaseFromHash(window.location.hash);
      if (!asked || !ORDER.includes(asked)) return;
      movedRef.current = true;
      setPhase(asked);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * Move, report, and take the keyboard with us.
   *
   * `flushSync` renders the next phase before this returns, so the `.focus()` below happens inside
   * the gesture that pressed the button — the only way iOS Safari keeps the keyboard open. This is
   * the rule `GuidedFirstInvoice.goTo` documents, kept identically here.
   */
  function go(next: Phase) {
    movedRef.current = true;
    const step = PHASE_STEP[next];
    if (step && !reachedRef.current.has(next)) {
      reachedRef.current.add(next);
      trackWebEvent("free_invoice_step_reached", { step });
    }
    if (next !== phase) {
      try {
        window.history.pushState({ obPhase: next }, "", PHASE_HASH[next]);
      } catch {
        // No history entry, but the phase still changes. Only Back is lost.
      }
    }
    flushSync(() => setPhase(next));
    const id = PHASE_FOCUS[next];
    if (id) document.getElementById(id)?.focus({ preventScroll: true });
  }

  /**
   * After the slides: the loading screen only if the local database is genuinely still opening.
   *
   * By this point the person has pressed Continue three times, so it has always finished — which is
   * the design's own instruction ("if it is instant, this screen never appears") rather than a
   * screen we built and then hid.
   */
  function afterSlides() {
    go(fi.restored ? "business" : "loading");
  }

  useEffect(() => {
    if (phase === "loading" && fi.restored) go("business");
    // `phase` and `fi.restored` are the whole condition; `go` is stable enough for this one use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fi.restored]);

  /**
   * Make the mark from the name the person typed — and from nothing else.
   *
   * Invoice Fly's generated logo printed "Touchpenty" for a business called "Touchpedia", on the
   * mark that goes straight onto the first invoice. A wrong name on an invoice is a trust cost
   * (G3), and the only way to be incapable of that mistake is never to send the name anywhere to be
   * guessed at. This draws it on the phone, from `inv.businessName`, offline.
   */
  function makeMark(which: number) {
    return logoMarkDataUrl(inv.businessName, brand, { design: which, symbol: industry?.symbol ?? null });
  }

  function regenerate() {
    const next = design + 1;
    trackWebEvent("free_invoice_logo_choice", { choice: "regenerated" });
    setDesign(next);
    const mark = makeMark(next);
    if (mark) fi.set({ logoDataUrl: mark, logoSource: "generated" });
  }

  /** Entering the made-logo step draws the current design onto the draft, so what is shown is what is kept. */
  useEffect(() => {
    if (phase !== "logoMade") return;
    if (inv.logoSource === "uploaded" && inv.logoDataUrl) return;
    const mark = makeMark(design);
    if (mark && mark !== inv.logoDataUrl) fi.set({ logoDataUrl: mark, logoSource: "generated" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, design, inv.businessName, inv.industry]);

  function chooseIndustry(id: string) {
    fi.set({ industry: id });
    // The trade picks the paper too — this is the half of the answer that shows up on the invoice
    // itself rather than only on the mark.
    fi.applyTemplate(templateById(templateIdForIndustry(id)));
  }

  function keepLogo() {
    trackWebEvent("free_invoice_logo_choice", { choice: "kept" });
    go("ready");
  }

  function skipLogo() {
    trackWebEvent("free_invoice_logo_choice", { choice: "skipped" });
    if (inv.logoSource === "generated") fi.set({ logoDataUrl: null, logoSource: undefined });
    go("ready");
  }

  function pickImage() {
    trackWebEvent("free_invoice_logo_choice", { choice: "change_opened" });
    onPickLogo();
  }

  const hasName = Boolean(name);
  const stepOfFour = phase === "business" ? 1 : phase === "trade" ? 2 : phase === "logo" ? 3 : 4;
  const percent = stepOfFour * 25;

  /* ------------------------------ the slides ------------------------------ */

  if (phase === "slide1" || phase === "slide2" || phase === "slide3") {
    const copy = {
      slide1: {
        head: ["Invoice", "in a minute"],
        sub: "Make a professional invoice and send it from your phone.",
      },
      slide2: {
        head: ["Send it", "their way"],
        sub: "WhatsApp, a link, or a PDF — your client opens it anywhere.",
      },
      slide3: {
        head: ["Works with", "no signal"],
        sub: "Everything stays on your phone. Nothing waits for the internet.",
      },
    }[phase];
    const next = phase === "slide1" ? "slide2" : phase === "slide2" ? "slide3" : null;

    return (
      <div ref={topRef} className="mx-auto w-full max-w-[560px] scroll-mt-4">
        <div className="relative overflow-hidden rounded-[var(--radius-md)] bg-black">
          {/* A door for somebody who already has an account — never a gate in front of somebody
              who does not. It is on slide 1 only, because by slide 2 they have chosen. */}
          {phase === "slide1" && (
            <a
              href="/login"
              className="absolute end-4 top-3 z-10 text-sm font-bold text-white/85 hover:text-white"
            >
              Sign in
            </a>
          )}

          {/* Our own invoice is the artwork. We have no photographs, and a stock photo of somebody
              else's desk is a picture of a product we do not sell. */}
          <div className="flex h-[300px] items-center justify-center overflow-hidden bg-[#0f1b38] px-6 sm:h-[360px] [@media(max-height:620px)]:h-[120px]">
            <div className="w-[196px] -rotate-3">
              <GuidedInvoiceCard inv={inv} total={fi.totals.total} />
            </div>
          </div>

          <div className="px-5 pb-4 pt-5">
            <h2 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] text-white sm:text-[34px]">
              {copy.head[0]}
              <br />
              {copy.head[1]}
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-snug text-[#b9b6c2]" style={{ overflowWrap: "anywhere" }}>
              {copy.sub}
            </p>
            {/* Two facts, both ours and both true. Their slide carries an App Store rating and a
                user count; we have no Play rating at all, so no number here was invented. */}
            {phase === "slide1" && (
              <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[#cfcbd8]">
                <span>
                  <b className="font-extrabold text-white">4,000+</b> businesses
                </span>
                <span>
                  <b className="font-extrabold text-white">96%</b> never made an account
                </span>
              </div>
            )}
          </div>

          {/* No skip, no dots, no counter — exactly as approved. One thing to press. */}
          <div className="px-4 pb-4">
            <Button
              type="button"
              size="lg"
              onClick={() => (next ? go(next) : afterSlides())}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ one moment ------------------------------ */

  if (phase === "loading") {
    return (
      <div ref={topRef} className="mx-auto w-full max-w-[560px] scroll-mt-4">
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-6 rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)]">
          <span className="relative h-[66px] w-[66px]" aria-hidden="true">
            {[
              "left-[23px] top-0",
              "left-0 top-[23px]",
              "right-0 top-[23px]",
              "bottom-0 left-[23px]",
            ].map((pos, i) => (
              <span
                key={pos}
                className={cn("absolute h-[19px] w-[19px] animate-pulse rounded-full bg-[var(--color-primary)]", pos)}
                style={{ animationDelay: `${i * 140}ms` }}
              />
            ))}
          </span>
          <p className="text-lg text-[var(--color-on-surface)]" role="status">
            One moment…
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------ you're ready ------------------------------ */

  if (phase === "ready") {
    return (
      <div ref={topRef} className="mx-auto w-full max-w-[560px] scroll-mt-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-5 text-center">
          <div className="relative mx-auto w-[196px]">
            <GuidedInvoiceCard inv={inv} total={fi.totals.total} />
            <span
              aria-hidden="true"
              className="absolute -bottom-6 left-1/2 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-full bg-[var(--color-primary)] text-3xl font-extrabold text-[var(--color-on-primary)]"
            >
              ✓
            </span>
          </div>
          {/* Never "Account created!". Theirs says it even on the guest route; we create no
              account at all, so the sentence would simply be untrue. */}
          <h2 className="mt-12 text-[28px] font-extrabold tracking-[-0.03em] text-[var(--color-on-background)]">
            You&rsquo;re ready
          </h2>
          <p className="mx-auto mt-2 max-w-[38ch] text-[14.5px] leading-snug text-[var(--color-on-surface-variant)]">
            Your business is set up. Make your first invoice — it is saved on this phone, with or
            without signal.
          </p>
          <div className="mt-5">
            <Button type="button" size="lg" onClick={() => go("home")} className="w-full">
              Make my first invoice
            </Button>
          </div>
          {/* The invitation to sign in is HERE, at the end, after the work — not in front of it. */}
          <a
            href="/login"
            className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            Already have an Invotick account? Sign in
          </a>
        </div>
      </div>
    );
  }

  /* ------------------------------ the invoices home ------------------------------ */

  if (phase === "home") {
    const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
    // What this browser has actually billed: every saved draft except the one being made now,
    // which has no total yet and would only ever show as zero.
    const billed = fi.saved
      .filter((i) => i.id !== inv.id)
      .reduce((sum, i) => sum + totalsFor(i).total, 0);
    return (
      <div ref={topRef} className="mx-auto w-full max-w-[560px] scroll-mt-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[var(--color-on-surface)]">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--color-primary)] text-[11px] font-extrabold text-[var(--color-on-primary)]"
              >
                IT
              </span>
              Invotick
            </span>
            <span className="rounded-full bg-[var(--color-surface-variant)] px-3 py-1.5 text-xs font-bold text-[var(--color-on-surface-variant)]">
              {month}
            </span>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-[var(--color-on-surface-variant)]">Total</p>
            <p
              className="mt-0.5 text-[40px] font-extrabold tabular-nums tracking-[-0.03em] text-[var(--color-on-surface)]"
              style={{ overflowWrap: "anywhere" }}
            >
              {formatMoney(billed, inv.currency)}
            </p>
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-surface-variant)]/60 px-4 py-7 text-center">
            <span
              aria-hidden="true"
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[12px] bg-[var(--color-primary-container)] text-3xl"
            >
              📄
            </span>
            <h3 className="text-lg font-extrabold text-[var(--color-on-surface)]">No invoices yet</h3>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              Create your first invoice and send it to your client
            </p>
          </div>

          <div className="mt-4">
            <Button type="button" size="lg" onClick={onDone} className="w-full">
              + Create invoice
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ the four questions ------------------------------ */

  return (
    <div ref={topRef} className="mx-auto w-full max-w-[560px] scroll-mt-4">
      {/* The banner: their screen puts a picture band above the progress bar. Ours is our own
          invoice again. It is the first thing to give up its height when the keyboard is open and
          the font is large — never the field, the help line or the way forward. */}
      {phase !== "logoMade" && (
        <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-t-[var(--radius-md)] bg-[#0f1b38] [@media(max-height:620px)]:h-[76px]">
          <button
            type="button"
            aria-label="Back"
            onClick={() => window.history.back()}
            className="absolute start-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white hover:bg-white/30"
          >
            ‹
          </button>
          <div className="w-[120px] scale-95 [@media(max-height:620px)]:hidden">
            <GuidedInvoiceCard inv={inv} total={fi.totals.total} />
          </div>
        </div>
      )}

      <div
        className={cn(
          "border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 sm:p-5",
          phase === "logoMade" ? "rounded-[var(--radius-md)]" : "rounded-b-[var(--radius-md)] border-t-0",
        )}
      >
        {/* Four steps, and step 4 fills it. Their own bar reads 25 / 50 / 74 / 100 — the 74 is
            theirs being one pixel short of a quarter, not a fifth step hiding somewhere. */}
        <div className="flex items-center gap-3">
          {phase === "logoMade" && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => window.history.back()}
              className="text-xl font-bold text-[var(--color-on-surface)]"
            >
              ‹
            </button>
          )}
          <div
            className="mx-auto h-1.5 w-[48%] overflow-hidden rounded-full bg-[var(--color-surface-variant)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={stepOfFour}
            aria-label={`Step ${stepOfFour} of 4`}
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {phase === "business" && (
          <>
            <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-on-background)] sm:text-[30px]">
              Your business
            </h2>
            <div className="mt-3">
              <TextField
                id="ob-business-name"
                aria-label="Business name"
                placeholder="Business name"
                autoComplete="organization"
                enterKeyHint="next"
                className="scroll-mb-32"
                value={inv.businessName}
                onChange={(e) => {
                  fi.noteTyping("business", e.target.value);
                  fi.set({ businessName: e.target.value });
                }}
                onKeyDown={(e) => {
                  // The key already under the thumb, and the move happens in this handler so the
                  // keyboard survives it.
                  if (e.key === "Enter" && hasName) {
                    e.preventDefault();
                    go("trade");
                  }
                }}
              />
            </div>
            <p className="mt-2 text-[13px] text-[var(--color-on-surface-variant)]">
              Required — you can change it any time.
            </p>
            <div className="mt-4">
              <Button type="button" size="lg" disabled={!hasName} onClick={() => go("trade")} className="w-full">
                Continue
              </Button>
            </div>
          </>
        )}

        {phase === "trade" && (
          <>
            <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-on-background)] sm:text-[30px]">
              What do you do?
            </h2>
            <p className="mt-1 text-sm leading-snug text-[var(--color-on-surface-variant)]">
              We use it to pick your invoice design and the icon on your logo.
            </p>
            <div className="mt-3">
              <TextField
                id="ob-trade-search"
                aria-label="Search your work"
                placeholder="Search your work"
                enterKeyHint="search"
                className="scroll-mb-32"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter takes the first match rather than submitting nothing — on a list this
                  // long, the thing you typed three letters of is the thing you meant.
                  if (e.key === "Enter" && results.length > 0) {
                    e.preventDefault();
                    chooseIndustry(results[0].id);
                  }
                }}
              />
            </div>
            {/* A bounded, scrolling list: 37 trades at full height would push Continue off a phone,
                and the way forward must never be the thing below the fold. */}
            <div className="mt-3 max-h-[42vh] min-h-[180px] overflow-y-auto overscroll-contain [@media(max-height:620px)]:min-h-0">
              <ul className="flex flex-col gap-2">
                {results.map((i) => {
                  const on = inv.industry === i.id;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => chooseIndustry(i.id)}
                        aria-pressed={on}
                        className={cn(
                          "flex min-h-12 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-start",
                          on
                            ? "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
                            : "bg-[var(--color-surface-variant)]/60 text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]",
                        )}
                      >
                        <span aria-hidden="true" className="w-6 shrink-0 text-center text-base">
                          {i.symbol}
                        </span>
                        <span
                          className="min-w-0 flex-1 text-[15px] font-bold"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {i.name}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold",
                            on
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                              : "border-[var(--color-outline-variant)]",
                          )}
                        >
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <li className="px-1 py-3 text-sm text-[var(--color-on-surface-variant)]">
                    Nothing matches “{query}”. Pick <b>Something else</b> — you can change it later.
                  </li>
                )}
              </ul>
            </div>
            {/*
              Continue FLOATS above the list — the approved design says so ("Continue list ke upar
              tairta hai"), and measuring said why: inline, on a 375×400 keyboard viewport, it sat
              at 480–528 and was entirely below the fold, so the only way forward from a list of 37
              trades was to scroll past all of them. Disabled until one is picked, exactly as
              theirs is: this is a question whose answer is used, so pressing on without one would
              be a step that did nothing.
            */}
            <div className="sticky bottom-0 z-10 mt-4 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5">
              <Button
                type="button"
                size="lg"
                disabled={!inv.industry}
                onClick={() => go("logo")}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {phase === "logo" && (
          <>
            <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-on-background)] sm:text-[30px]">
              Add your logo
            </h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              Optional — you can change it any time.
            </p>
            <div className="mt-4 flex min-h-[170px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-container)]/70">
              {inv.logoDataUrl && inv.logoSource === "uploaded" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inv.logoDataUrl}
                  alt="Your logo"
                  className="max-h-[130px] max-w-[70%] rounded-[var(--radius-sm)] object-contain"
                />
              ) : (
                <button
                  type="button"
                  onClick={pickImage}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-surface)] px-6 text-base font-bold text-[var(--color-on-surface)] hover:brightness-95"
                >
                  <span aria-hidden="true">✎</span> Choose image
                </button>
              )}
            </div>
            {fi.logoError && (
              <p className="mt-2 text-xs font-medium text-[var(--color-error)]">{fi.logoError}</p>
            )}
            {inv.logoDataUrl && inv.logoSource === "uploaded" && (
              <button
                type="button"
                onClick={pickImage}
                className="mt-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
              >
                Choose a different image
              </button>
            )}
            <div className="sticky bottom-0 z-10 mt-4 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5">
              <Button type="button" size="lg" onClick={() => go("logoMade")} className="w-full">
                Continue
              </Button>
            </div>
          </>
        )}

        {phase === "logoMade" && (
          <>
            <h2 className="mt-4 text-center text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--color-on-background)]">
              {inv.logoSource === "uploaded" ? "Your logo is on the invoice" : "We made a logo for your business"}
            </h2>

            <div className="relative mt-4 flex min-h-[230px] flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-variant)]/50 p-5">
              {inv.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inv.logoDataUrl}
                  alt=""
                  className="h-[110px] w-[110px] rounded-[18px] object-contain"
                />
              ) : (
                <span className="flex h-[110px] w-[110px] items-center justify-center rounded-[18px] bg-[var(--color-surface-variant)] text-sm font-bold text-[var(--color-on-surface-variant)]">
                  No logo
                </span>
              )}
              {/* The name under the mark is `inv.businessName`, the same string the mark was drawn
                  from and the same one the invoice prints. There is no second copy of it to drift. */}
              <p
                className="mt-3 text-center text-base font-extrabold text-[var(--color-on-surface)]"
                style={{ overflowWrap: "anywhere" }}
              >
                {name}
              </p>
              {industry && (
                <p className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
                  {industry.name}
                </p>
              )}
              {inv.logoSource !== "uploaded" && (
                <button
                  type="button"
                  onClick={regenerate}
                  aria-label="Try another design"
                  className="absolute end-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full text-xl text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]"
                >
                  ↻
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[14.5px] text-[var(--color-on-surface-variant)]">
              {inv.logoSource === "uploaded"
                ? "Happy with it?"
                : `Do you want to use this logo? (${(design % LOGO_DESIGNS.length) + 1} of ${LOGO_DESIGNS.length})`}
            </p>

            {/*
              Skip rides WITH Continue, in the design's own order — above it, quieter than it.
              Measured at 375×400: left in the page above the floating bar it sat off screen, so
              the one answer other than "yes" was the one you could not see. Both answers to a
              question have to be reachable at the moment it is asked.
            */}
            <div className="sticky bottom-0 z-10 mt-3 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2">
              <button
                type="button"
                onClick={skipLogo}
                className="mx-auto mb-1.5 block min-h-9 px-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:underline"
              >
                Skip
              </button>
              <Button type="button" size="lg" onClick={keepLogo} className="w-full">
                Continue
              </Button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
