"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { isComplete } from "@/lib/free-invoice/funnel";
import { initialsFor, logoMarkDataUrl } from "@/lib/free-invoice/logo-mark";
import { trackWebEvent } from "@/lib/analytics/client";
import { useFreeInvoice } from "./useFreeInvoice";
import { GuidedInvoiceCard } from "./GuidedInvoiceCard";
import { FreeInvoiceTool } from "./FreeInvoiceTool";
import { BackupModal } from "./BackupModal";
import { InstallOffer } from "./InstallOffer";

/**
 * The guided first invoice — three questions, then the finished invoice (decision 0165).
 *
 * ## What it replaces and what it does not
 *
 * The full editor is still here, still mounted, still the thing that produces the PDF. What changed
 * is what a stranger sees first: a form with seven cards and about forty fields, against three
 * screens with one question each. The editor is one press away at the end — *Change template &
 * colour* — and it is the **same draft**, because both views read one `useFreeInvoice()` (see that
 * file for why there is exactly one).
 *
 * This mirrors the Android app's own first-invoice flow, which is deliberate: the app has said
 * `STEP 1 OF 3 - ADD BUSINESS` over business → client → items since long before this page existed
 * (`docs/android-first-invoice-flow.md` §1). Two products that ask the same three questions in the
 * same order is one product.
 *
 * **One correction was carried over on purpose.** The app's bar divides by four with only three
 * possible increments, so it reads `COMPLETE` above a three-quarters-full bar
 * (`InvoiceDocumentUiState.kt:161`). Here it is three of three, and step 3 fills it.
 *
 * ## The editor stays mounted, hidden — the 0164 rule, unchanged
 *
 * `<div hidden>` and never `{advanced && <FreeInvoiceTool/>}`. Its markup is what a crawler reads on
 * the page that ranks for "free invoice generator"; unmounting it would take every label and
 * heading in the editor out of the static HTML. It also keeps `#fi-paper` in the document, which is
 * what `exportInvoicePdf` clones — the download works from step 4 without the editor ever being on
 * screen.
 */

type Step = 1 | 2 | 3 | 4;

/** The steps a person *advances to*. Step 1 is arriving, and its row is `free_invoice_tool_opened`. */
const STEP_EVENT: Record<Exclude<Step, 1>, "client" | "items" | "done"> = {
  2: "client",
  3: "items",
  4: "done",
};

/**
 * One history entry per step, so **Back means one step back**.
 *
 * Measured on the live page before this: all four steps shared `#create` and pushed nothing, so
 * `history.length` was 2 on step 1 and still 2 on step 4 — the flow created no history at all, and
 * Back from the finished invoice left the flow entirely rather than returning to the items.
 *
 * Every hash starts `#create`, which is what `LandingExperience` tests for, so a link to any of
 * them still opens the tool. Step 1 keeps the plain `#create` that 0164 shipped and that every
 * shared link already carries.
 */
const STEP_HASH: Record<Step, string> = {
  1: "#create",
  2: "#create-client",
  3: "#create-items",
  4: "#create-done",
};

/** The field a step exists to have filled. Step 4 has none — there is nothing left to type. */
const STEP_FOCUS: Record<Step, string | null> = {
  1: "fi-business-name",
  2: "fi-client-name",
  3: "fi-item-desc-0",
  4: null,
};

/**
 * Every field on a step keeps the sticky bar's height clear beneath it.
 *
 * When a phone opens its keyboard the browser scrolls the focused field into the shrunken viewport
 * — and it knows nothing about a bar pinned over the bottom of it, so it will happily park the
 * field underneath one. `scroll-margin-bottom` is how the field says how much room it needs, and
 * 8 rem is comfortably more than the tallest the bar gets (measured 109 px on step 3, which is the
 * one carrying the total).
 */
const FIELD_CLEARS_BAR = "scroll-mb-32";

function stepFromHash(hash: string): Step {
  if (hash === STEP_HASH[2]) return 2;
  if (hash === STEP_HASH[3]) return 3;
  if (hash === STEP_HASH[4]) return 4;
  return 1;
}

export function GuidedFirstInvoice() {
  const fi = useFreeInvoice();
  const [step, setStep] = useState<Step>(1);
  const [advanced, setAdvanced] = useState(false);
  /**
   * The mark we generated, kept so a later edit of the name can refresh it.
   *
   * Component state, not a field on the draft: it is true of this visit only, and putting it in
   * IndexedDB would mean a restored draft claiming a mark it may no longer match.
   */
  const [generatedMark, setGeneratedMark] = useState<string | null>(null);
  /**
   * Which lines have had their quantity opened. A list and not a boolean: two lines can each be
   * asking for a quantity, and one flag would close the other one's field as a side effect.
   */
  const [qtyOpen, setQtyOpen] = useState<string[]>([]);
  const headingRef = useRef<HTMLDivElement>(null);
  /**
   * Steps already reported. It replaces the old `next > step` test, which was wrong the moment Back
   * existed: going back to the items and forward again would have sent a second `items` row, and a
   * funnel's later steps would have outgrown its earlier ones. "Reached" is a first time.
   */
  const reachedRef = useRef<Set<Step>>(new Set());
  /** The page's one logo picker. See `useFreeInvoice` for why it lives here and not in the hook. */
  const logoInputRef = useRef<HTMLInputElement>(null);
  const movedRef = useRef(false);

  const { inv, totals } = fi;
  const brand = inv.color || "#0d4dc0";
  const initials = initialsFor(inv.businessName);
  const hasBusiness = Boolean(inv.businessName.trim());
  const hasClient = Boolean(inv.clientName.trim());
  const ready = isComplete(inv);

  /**
   * Moving between steps takes the reader to the top of the new one.
   *
   * Only after a **press** — `movedRef` — so the first render never scrolls. This is the same rule
   * `LandingExperience` keeps for the CTA: a page that jumps before the reader has done anything is
   * a page fighting them.
   */
  useEffect(() => {
    if (!movedRef.current) return;
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  /**
   * What the draft can support right now, read by the Back handler.
   *
   * A ref and not the values themselves, because the `popstate` listener is registered once and
   * would otherwise close over the first render's draft for ever — the classic stale-closure bug,
   * and it would have shown up as Back refusing to reach a step that was plainly filled in.
   */
  const reachableRef = useRef<Step>(1);
  reachableRef.current = ready ? 4 : hasClient ? 3 : hasBusiness ? 2 : 1;

  /**
   * Back and Forward move the step, because each step pushed its own entry.
   *
   * It deliberately does **not** take focus. Returning to a step is reading, not typing, and a
   * keyboard that springs open on a Back press is the page fighting the reader — the same rule the
   * first render already keeps.
   */
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      const state = event.state as { fiStep?: unknown } | null;
      const asked =
        typeof state?.fiStep === "number" ? (state.fiStep as Step) : stepFromHash(window.location.hash);
      movedRef.current = true;
      // Never land on a step the draft cannot fill. A shared `#create-items` link opened in a fresh
      // browser would otherwise render an items screen over an invoice with no business on it.
      setStep(asked > reachableRef.current ? reachableRef.current : asked);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * A reload lands on step 1, whatever step the URL names.
   *
   * The draft is restored from IndexedDB asynchronously, so at this moment nothing is known about
   * it; rendering step 3 here would draw an items screen over an empty invoice and then correct
   * itself. `replaceState` rather than `pushState`, so it does not add an entry of its own.
   */
  useEffect(() => {
    try {
      if (window.location.hash.startsWith("#create") && window.location.hash !== STEP_HASH[1]) {
        window.history.replaceState({ fiStep: 1 }, "", STEP_HASH[1]);
      }
    } catch {
      // A browser that refuses `replaceState` still gets the flow; only the URL is left alone.
    }
  }, []);

  /**
   * One row the first time each step is reached (§1.1 — the step is a parameter, never a name per
   * step). Going back and forward again reports nothing: "reached" is a first time, and counting a
   * second visit would make the funnel's later steps look bigger than its earlier ones.
   *
   * ## Why the focus is taken HERE, in the handler, and not in an effect
   *
   * `flushSync` renders the next step before this function returns, so the `.focus()` below happens
   * inside the very same user gesture that pressed the key or the button. iOS Safari only keeps the
   * keyboard up for a focus that happens in a gesture's own call stack — move this into a
   * `useEffect` and the keyboard drops on every step, which is exactly what the live page did:
   * `activeElement` measured `BODY` after both step 1 and step 2.
   */
  function goTo(next: Step) {
    movedRef.current = true;
    if (next !== 1 && !reachedRef.current.has(next)) {
      reachedRef.current.add(next);
      trackWebEvent("free_invoice_step_reached", { step: STEP_EVENT[next] });
    }
    if (next !== step) {
      try {
        window.history.pushState({ fiStep: next }, "", STEP_HASH[next]);
      } catch {
        // No history entry, but the step still changes. Only Back is lost.
      }
    }
    flushSync(() => setStep(next));
    focusNow(STEP_FOCUS[next]);
  }

  /**
   * Typing the name also makes the mark, and keeps it.
   *
   * The Android app has generated a logo from the business name and saved it since long before this
   * page existed (`CreateBusinessScreen.kt:229-243`) — silently, so nobody knows it happens. This
   * does the same thing and **shows** it, with the one answer a person actually needs beside it.
   *
   * It replaces a *Keep · Change · Skip* block that asked three questions of somebody who had typed
   * a business name, sitting in the exact path the keyboard now runs through. Keeping is what
   * almost everybody wanted and it is now the default rather than a press; changing is still one
   * press; and there is no Skip, because removing a mark we made is not a decision worth a button
   * on the first screen — the full editor clears it, as it always could.
   *
   * Only ever when the field is empty of a logo: a file they chose is never overwritten, and a
   * name that yields no initials (symbols, an emoji alone) produces no mark rather than a mark for
   * a business we invented.
   */
  function onBusinessName(value: string) {
    fi.noteTyping("business", value);
    const marks = generatedMark && inv.logoDataUrl === generatedMark;
    if (!marks && inv.logoDataUrl) {
      // Their own file. Leave it alone.
      fi.set({ businessName: value });
      return;
    }
    const letters = initialsFor(value);
    if (!letters) {
      // Nothing to draw. Drop a mark we made rather than leave last keystroke's initials on it.
      setGeneratedMark(null);
      fi.set({ businessName: value, ...(marks ? { logoDataUrl: null, logoSource: undefined } : {}) });
      return;
    }
    if (marks && letters === initials) {
      // Same initials — "Northgate" to "Northgate C" — so there is nothing new to draw. Skipping
      // the canvas here is what keeps this off the keystroke path.
      fi.set({ businessName: value });
      return;
    }
    const mark = logoMarkDataUrl(value, brand);
    setGeneratedMark(mark);
    fi.set({ businessName: value, logoDataUrl: mark, logoSource: "generated" });
  }

  function changeMark() {
    // The one press left in this moment, and the press is the fact: whether a file was then chosen
    // is not observable from here — a cancelled picker looks identical — and it is answered
    // honestly by `has_logo` and `logo_source` on `free_invoice_completed` (§1.14).
    trackWebEvent("free_invoice_logo_choice", { choice: "change_opened" });
    openLogoPicker();
  }

  function openLogoPicker() {
    logoInputRef.current?.click();
  }

  /**
   * Focus, right now, inside the caller's gesture. `preventScroll` because the step's own
   * `scrollIntoView` has already decided where the page should be.
   */
  function focusNow(id: string | null) {
    if (!id) return;
    document.getElementById(id)?.focus({ preventScroll: true });
  }

  /** A line's quantity field, opened by its chip. */
  function openQty(id: string) {
    flushSync(() => setQtyOpen((open) => (open.includes(id) ? open : [...open, id])));
    focusNow(`fi-item-qty-${inv.items.findIndex((it) => it.id === id)}`);
  }

  /** A new line, with the cursor already in it — the keyboard never closes. */
  function addItemAndType() {
    const next = inv.items.length;
    flushSync(() => fi.addItem());
    focusNow(`fi-item-desc-${next}`);
  }

  const showLogoMark = Boolean(inv.logoDataUrl) && Boolean(initials);

  return (
    <div className="w-full">
      {/* The one file input on this page. The editor opens it through the `onPickLogo` prop; see
          `useFreeInvoice` for why there is only one of these. */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => fi.onLogoFile(e.target.files?.[0])}
      />

      {/*
        One column, and a reading width. Each step asks one question, so the panel is capped at
        560 px and centred however wide the screen is — a single field stretched across a 1400 px
        desktop reads as a form somebody forgot to lay out. The cap is on the STEPS only: the full
        editor below is three columns and must have the whole width, which is what it had before.
      */}
      <div hidden={advanced} className="mx-auto w-full max-w-[560px]">
        {step < 4 ? (
          <>
            <StepHeader ref={headingRef} step={step} />

            {step === 1 && (
              <Panel>
                <GuidedInvoiceCard inv={inv} total={totals.total} />
                <p className="mt-2 text-center text-xs font-medium text-[var(--color-on-surface-variant)]">
                  It builds as you type.
                </p>

                <Question>Your business</Question>
                <TextField
                  id="fi-business-name"
                  className={FIELD_CLEARS_BAR}
                  label="Business name"
                  placeholder="Acme Studio"
                  autoComplete="organization"
                  enterKeyHint="next"
                  value={inv.businessName}
                  onChange={(e) => onBusinessName(e.target.value)}
                  onKeyDown={(e) => {
                    // The key already under the thumb. Without this the only way on was a button
                    // the keyboard was covering.
                    if (e.key === "Enter" && hasBusiness) {
                      e.preventDefault();
                      goTo(2);
                    }
                  }}
                />

                {showLogoMark && (
                  /* The mark is already on the invoice — the card above shows it. This says so, and
                     offers the one thing left to decide. The square and its sentence share a line
                     only while both fit; at a large font scale the words move below rather than
                     squeezing it. */
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-variant)]/60 p-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-base font-extrabold text-white"
                      style={{ background: brand }}
                    >
                      {initials}
                    </span>
                    <p className="min-w-[11ch] flex-1 text-sm font-semibold text-[var(--color-on-surface)]">
                      Logo made from your name.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={changeMark}>Change</Button>
                  </div>
                )}
                {fi.logoError && (
                  <p className="mt-2 text-xs font-medium text-[var(--color-error)]">{fi.logoError}</p>
                )}

                <StepBar onClick={() => goTo(2)} disabled={!hasBusiness} label="Continue" />
              </Panel>
            )}

            {step === 2 && (
              <Panel>
                <Done label={inv.businessName} onEdit={() => goTo(1)} />

                <Question>Who is it for?</Question>
                <TextField
                  id="fi-client-name"
                  className={FIELD_CLEARS_BAR}
                  label="Client name"
                  placeholder="Client or company"
                  enterKeyHint="next"
                  value={inv.clientName}
                  onChange={(e) => {
                    fi.noteTyping("client", e.target.value);
                    fi.set({ clientName: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && hasClient) {
                      e.preventDefault();
                      goTo(3);
                    }
                  }}
                />
                <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
                  Email, phone and address — later, whenever you like.
                </p>

                <StepBar onClick={() => goTo(3)} disabled={!hasClient} label="Continue" />
              </Panel>
            )}

            {step === 3 && (
              <Panel>
                <div className="flex flex-wrap gap-2">
                  <Chip label={inv.businessName} onEdit={() => goTo(1)} />
                  <Chip label={inv.clientName} onEdit={() => goTo(2)} />
                </div>

                <Question>What are you billing for?</Question>

                <div className="flex flex-col gap-3">
                  {inv.items.map((it, i) => {
                    const amount = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
                    const qty = qtyOpen.includes(it.id);
                    const last = i === inv.items.length - 1;
                    return (
                      <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <TextField
                              id={`fi-item-desc-${i}`}
                              className={FIELD_CLEARS_BAR}
                              aria-label={`Item ${i + 1} description`}
                              placeholder="Description of work or item"
                              enterKeyHint="next"
                              value={it.description}
                              onChange={(e) => {
                                fi.noteTyping("item", e.target.value);
                                fi.setItem(it.id, { description: e.target.value });
                              }}
                              onKeyDown={(e) => {
                                // The only text field on this step, so it is the only one whose
                                // keyboard can carry the reader onward. It hands over to the price.
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  focusNow(`fi-item-price-${i}`);
                                }
                              }}
                            />
                            {/*
                              Price, and a chip for the quantity — decision Q1(A).

                              Quantity is 1 on very nearly every first invoice, so asking everybody
                              for it spends a field, and worse, it makes the LAST thing typed a
                              second number pad. An iPhone's decimal pad has no return key at all,
                              so every number field is a dead end for the keyboard; having one
                              instead of two is the difference between one tap at the end and two.

                              The chip is not a shortcut past the data: pressing it opens the real
                              quantity field, and the amount below is still quantity × price.
                            */}
                            <div className="mt-2 flex items-end gap-2">
                              <div className="min-w-0 flex-1">
                                <TextField
                                  id={`fi-item-price-${i}`}
                                  className={FIELD_CLEARS_BAR}
                                  aria-label={`Item ${i + 1} price`}
                                  placeholder="Price"
                                  inputMode="decimal"
                                  enterKeyHint="go"
                                  value={it.rate}
                                  onChange={(e) => fi.setItem(it.id, { rate: e.target.value })}
                                  onKeyDown={(e) => {
                                    // Where a keyboard offers this key at all, it finishes the
                                    // step. On iOS the decimal pad has none, and the sticky bar
                                    // below is the answer there — it is never off screen.
                                    if (e.key === "Enter" && ready && last) {
                                      e.preventDefault();
                                      goTo(4);
                                    }
                                  }}
                                />
                              </div>
                              {qty ? (
                                <div className="w-[88px] shrink-0">
                                  <TextField
                                    id={`fi-item-qty-${i}`}
                                    className={FIELD_CLEARS_BAR}
                                    aria-label={`Item ${i + 1} quantity`}
                                    placeholder="Qty"
                                    inputMode="decimal"
                                    value={it.quantity}
                                    onChange={(e) => fi.setItem(it.id, { quantity: e.target.value })}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openQty(it.id)}
                                  aria-label={`Change quantity for item ${i + 1}, currently ${it.quantity || 1}`}
                                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] px-3.5 text-sm font-bold text-[var(--color-on-surface)] hover:border-[var(--color-primary)]"
                                >
                                  <span aria-hidden="true">×</span>
                                  <span className="tabular-nums">{it.quantity || 1}</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove item ${i + 1}`}
                            className="mt-1.5 rounded-full p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)] disabled:opacity-30"
                            disabled={inv.items.length === 1}
                            onClick={() => fi.removeItem(it.id)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg>
                          </button>
                        </div>
                        {/*
                          The amount is the FULL width of the card, outside the column the delete
                          button shares — measured, not guessed. Inside that column at 320 px with a
                          1.5× font the box came out 136 px and `₨1,284,500.75` is 154 px, so the
                          figure was painted 36 px to the LEFT of its own grey pill: half on the
                          tint, half on the card, over the price it was computed from. A total drawn
                          outside its own box makes the arithmetic look wrong, which is a trust cost
                          (G3) on the one screen whose job is to say the numbers are right.

                          `overflow-wrap: anywhere` is the floor under that, for a figure wider than
                          any box we can give it. It wraps rather than escaping — a wrapped number
                          is still the whole number, and `LAYOUT_RULES.md`'s rule is that money is
                          never *cut*.
                        */}
                        <div className="mt-2 flex min-h-11 flex-wrap items-center justify-end gap-x-3 gap-y-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)] px-3 py-2 text-end">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Amount</span>
                          <span className="min-w-0 text-sm font-bold tabular-nums text-[var(--color-on-surface)]" style={{ overflowWrap: "anywhere" }}>
                            {formatMoney(amount, inv.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addItemAndType}
                    className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-outline)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-container)]/40"
                  >
                    + Add item
                  </button>
                </div>

                {/*
                  The subtotal is drawn ONLY when it differs from the total.

                  Nothing on this step can add a tax, a discount or a shipping cost, so for a draft
                  started here the two lines are the same number said twice — and it was one of the
                  three things the sticky bar was measured hiding. It comes back for a draft
                  restored from a previous visit that set one of those in the full editor, because
                  then the difference is real and hiding it would be hiding money.
                */}
                {Math.abs(totals.subtotal - totals.total) > 0.005 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--color-outline-variant)] pt-3 text-sm">
                    <span className="font-semibold text-[var(--color-on-surface-variant)]">Subtotal</span>
                    <span className="font-semibold tabular-nums text-[var(--color-on-surface)]" style={{ overflowWrap: "anywhere" }}>
                      {formatMoney(totals.subtotal, inv.currency)}
                    </span>
                  </div>
                )}

                {/*
                  The total rides IN the sticky bar, so the bar can no longer hide it.

                  Measured on the live page at a keyboard-open 375×400: the bar sat at 327–400 and
                  the Total row was off screen at 580, passing behind the bar at every scroll
                  position between. The figure a person is watching grow while they type is the one
                  thing on this screen that must never be the thing covered up.

                  The total and its currency sign are one thing and are never separated — the
                  owner's own rule. The currency control sits beside the LABEL, never on the figure,
                  so the largest number in the bar is only ever the amount.
                */}
                <StepBar onClick={() => goTo(4)} disabled={!ready} label="Preview & download">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Total</span>
                      <CurrencySelect value={inv.currency} onChange={fi.changeCurrency} options={fi.currencies} />
                    </span>
                    <span className="text-lg font-extrabold tabular-nums text-[var(--color-primary)]" style={{ overflowWrap: "anywhere" }}>
                      {formatMoney(totals.total, inv.currency)}
                    </span>
                  </div>
                </StepBar>
              </Panel>
            )}
          </>
        ) : (
          <Panel>
            <div ref={headingRef} className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)]" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f7a3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-on-background)]">Your invoice is ready</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
              <span className="font-bold text-[var(--color-on-surface)]">{inv.invoiceNumber}</span>
              {inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}
            </p>

            <div className="mt-4">
              <GuidedInvoiceCard inv={inv} total={totals.total} />
            </div>

            {/* One filled button. "Change template & colour" is the way into the full editor and is
                outlined, because a second solid button here would make the eye choose between
                finishing and fiddling. */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button type="button" size="lg" loading={fi.downloading} onClick={fi.downloadPdf} className="w-full sm:flex-1">
                Download PDF
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => setAdvanced(true)} className="w-full sm:flex-1">
                Change template &amp; colour
              </Button>
            </div>
            <button
              type="button"
              onClick={() => goTo(3)}
              className="mt-3 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Back to the items
            </button>
          </Panel>
        )}
      </div>

      {/*
        Always rendered, hidden until asked for. The markup is what the crawler reads, and
        `#fi-paper` inside it is what the PDF export clones — so step 4's Download works with the
        editor never on screen.
      */}
      <div hidden={!advanced}>
        <FreeInvoiceTool fi={fi} onPickLogo={openLogoPicker} />
      </div>

      <BackupModal open={fi.backupOpen} onClose={() => fi.setBackupOpen(false)} count={fi.unsyncedCount} />

      {/* The soft install offer (decision 0163), unchanged: it exists only after a PDF has been
          produced, it covers nothing that can be worked in, and every button keeps working. */}
      {fi.offerOpen && (
        <InstallOffer
          onCreateAccount={() => {
            fi.setOfferOpen(false);
            fi.setBackupOpen(true);
          }}
          onClose={() => fi.setOfferOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------- small pieces ---------------------------- */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 sm:p-5">
      {children}
    </div>
  );
}

/**
 * `STEP n OF 3` and the bar.
 *
 * Three of three, and step 3 fills it — see the note at the top of this file about the app's own
 * bar, which divides by four and can never reach 100 %.
 */
const StepHeader = function StepHeader({ ref, step }: { ref: React.Ref<HTMLDivElement>; step: Step }) {
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  return (
    <div ref={ref} className="mb-3 scroll-mt-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
        Step {step} of 3
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-variant)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-label="Invoice progress"
      >
        <div className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

function Question({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-5 text-lg font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-xl">
      {children}
    </h2>
  );
}

/**
 * The one filled button on the step, and whatever must never be hidden beside it.
 *
 * **Sticky**, because on a phone the keyboard eats the bottom half of the screen: measured on the
 * live page at a keyboard-open 375×400 the button sat at 420 px — 20 px below the fold, so after
 * typing a name there was nothing on screen telling you where to go next.
 *
 * **And it carries `children`**, because that fix created the next one. A bar pinned to the bottom
 * of a 400 px viewport occupies 73 px of it, and everything the reader scrolls passes underneath:
 * on step 3 that was `+ Add item`, the subtotal and the **total**. The answer is not a thinner bar,
 * it is that the thing worth seeing lives *in* the bar — so the total is above the button rather
 * than behind it. Steps 1 and 2 pass nothing and the bar stays exactly what it was.
 *
 * One filled element per screen, still: the figure above the button is a fact in container tone and
 * the button is the only thing painted to be pressed.
 */
function StepBar({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      {/*
        Scroll slack, and ONLY where the bar actually sticks.

        A bar pinned to the bottom of a 400 px viewport is something every element above it scrolls
        underneath, so the last thing on the step could never be brought clear of it — measured on
        the live page: `+ Add item` was behind the bar at every scroll position between appearing
        and scrollY 300. This is the room to scroll it past. On a viewport tall enough to show the
        whole step the bar sits at its natural place and this would be white space for nothing,
        which is why it is behind a height query and not simply padding.
      */}
      <div aria-hidden="true" className="hidden h-28 [@media(max-height:620px)]:block" />
      <div className="sticky bottom-0 z-10 mt-5 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5">
        {children}
        <Button type="button" size="lg" onClick={onClick} disabled={disabled} className="w-full">
          {label}
        </Button>
      </div>
    </>
  );
}

/** A finished step, on the step after it: a green tick, what was entered, and a way back. */
function Done({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-variant)]/60 px-3 py-2">
      <Tick />
      <span className="min-w-0 flex-1 text-sm font-bold text-[var(--color-on-surface)]" style={{ overflowWrap: "anywhere" }}>
        {label}
      </span>
      <button type="button" onClick={onEdit} className="shrink-0 text-sm font-semibold text-[var(--color-primary)] hover:underline">
        Edit
      </button>
    </div>
  );
}

/** The same fact, smaller, once there are two of them. */
function Chip({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-surface-variant)]/70 px-2.5 py-1.5",
        "text-xs font-bold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]",
      )}
    >
      <Tick small />
      {/* Truncates, and only here: a chip is a reminder of something the person can reopen in one
          press, not the invoice. The card and the paper both show the name whole. */}
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-semibold text-[var(--color-primary)]">Edit</span>
    </button>
  );
}

function Tick({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#1f7a3d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function CurrencySelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        aria-label="Invoice currency"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface)] pl-3 pe-7 text-xs font-bold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {options.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-[var(--color-on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
    </span>
  );
}
