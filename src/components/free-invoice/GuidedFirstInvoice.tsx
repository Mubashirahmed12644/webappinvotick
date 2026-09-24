"use client";

import { useEffect, useRef, useState } from "react";
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

export function GuidedFirstInvoice() {
  const fi = useFreeInvoice();
  const [step, setStep] = useState<Step>(1);
  const [advanced, setAdvanced] = useState(false);
  const [logoDecided, setLogoDecided] = useState(false);
  /**
   * The mark we generated, kept so a later edit of the name can refresh it.
   *
   * Component state, not a field on the draft: it is true of this visit only, and putting it in
   * IndexedDB would mean a restored draft claiming a mark it may no longer match.
   */
  const [generatedMark, setGeneratedMark] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
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
   * One row the first time each step is reached (§1.1 — the step is a parameter, never a name per
   * step). Going back and forward again reports nothing: "reached" is a first time, and counting a
   * second visit would make the funnel's later steps look bigger than its earlier ones.
   */
  function goTo(next: Step) {
    movedRef.current = true;
    if (next !== 1 && next > step) {
      trackWebEvent("free_invoice_step_reached", { step: STEP_EVENT[next] });
    }
    setStep(next);
  }

  function onBusinessName(value: string) {
    fi.noteTyping("business", value);
    // A kept mark follows the name it was made from. Without this, editing "Northgate" to
    // "Northgate Coffee" leaves an `N` on an invoice that now says `NC` everywhere else.
    if (generatedMark && inv.logoDataUrl === generatedMark) {
      const refreshed = logoMarkDataUrl(value, brand);
      setGeneratedMark(refreshed);
      fi.set({ businessName: value, logoDataUrl: refreshed });
      return;
    }
    fi.set({ businessName: value });
  }

  function keepMark() {
    const mark = logoMarkDataUrl(inv.businessName, brand);
    trackWebEvent("free_invoice_logo_choice", { choice: "kept" });
    setGeneratedMark(mark);
    setLogoDecided(true);
    fi.set({ logoDataUrl: mark });
  }

  function changeMark() {
    // The press is the fact. Whether a file was then chosen is `has_logo` on
    // `free_invoice_completed`, and a cancelled picker must not be reported as a logo (§1.14).
    trackWebEvent("free_invoice_logo_choice", { choice: "change_opened" });
    openLogoPicker();
  }

  function skipMark() {
    trackWebEvent("free_invoice_logo_choice", { choice: "skipped" });
    setLogoDecided(true);
  }

  function openLogoPicker() {
    logoInputRef.current?.click();
  }

  const showLogoMoment = hasBusiness && !logoDecided && !inv.logoDataUrl && Boolean(initials);

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

                {showLogoMoment && (
                  <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-variant)]/60 p-3">
                    {/* The mark and its sentence sit on one line only while both fit; at a large
                        font scale the words move below it rather than squeezing the square. */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-base font-extrabold text-white"
                        style={{ background: brand }}
                      >
                        {initials}
                      </span>
                      <p className="min-w-[12ch] flex-1 text-sm font-semibold text-[var(--color-on-surface)]">
                        We made a logo from your name.
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={keepMark}>Keep</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={changeMark}>Change</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={skipMark}>Skip</Button>
                    </div>
                  </div>
                )}
                {fi.logoError && (
                  <p className="mt-2 text-xs font-medium text-[var(--color-error)]">{fi.logoError}</p>
                )}

                <Continue onClick={() => goTo(2)} disabled={!hasBusiness}>Continue</Continue>
              </Panel>
            )}

            {step === 2 && (
              <Panel>
                <Done label={inv.businessName} onEdit={() => goTo(1)} />

                <Question>Who is it for?</Question>
                <TextField
                  id="fi-client-name"
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

                <Continue onClick={() => goTo(3)} disabled={!hasClient}>Continue</Continue>
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
                    return (
                      <div key={it.id} className="rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <TextField
                              aria-label={`Item ${i + 1} description`}
                              placeholder="Description of work or item"
                              value={it.description}
                              onChange={(e) => {
                                fi.noteTyping("item", e.target.value);
                                fi.setItem(it.id, { description: e.target.value });
                              }}
                            />
                            {/*
                              Qty and unit price share a row; the amount is never a third cell in
                              it. At 375 px a third cell is a 72 px box and `₨1,284,500.75` is about
                              105 px, so the total was drawn straight across the price the person
                              had just typed — a computed figure lying over the number it was
                              computed from, which makes the arithmetic itself look wrong (G3). The
                              amount has its own full-width row below; see the note on it.
                            */}
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <TextField aria-label={`Item ${i + 1} quantity`} placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => fi.setItem(it.id, { quantity: e.target.value })} />
                              <TextField aria-label={`Item ${i + 1} unit price`} placeholder="Unit price" inputMode="decimal" value={it.rate} onChange={(e) => fi.setItem(it.id, { rate: e.target.value })} />
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
                    onClick={fi.addItem}
                    className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-outline)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-container)]/40"
                  >
                    + Add item
                  </button>
                </div>

                <div className="mt-4 border-t border-[var(--color-outline-variant)] pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-[var(--color-on-surface-variant)]">Subtotal</span>
                    <span className="font-semibold tabular-nums text-[var(--color-on-surface)]">{formatMoney(totals.subtotal, inv.currency)}</span>
                  </div>
                  {/*
                    The total and its currency sign are one thing and are never separated — the
                    owner's own rule. The currency control sits beside the label, not on the figure,
                    so the largest number on this screen is only ever the amount.
                  */}
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Total</span>
                      <CurrencySelect value={inv.currency} onChange={fi.changeCurrency} options={fi.currencies} />
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]" style={{ overflowWrap: "anywhere" }}>
                      {formatMoney(totals.total, inv.currency)}
                    </span>
                  </div>
                </div>

                <Continue onClick={() => goTo(4)} disabled={!ready}>Preview &amp; download</Continue>
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

/** The one filled button on the step. Full width on a phone so it is the only thing to aim at. */
function Continue({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    // Sticky, because on a phone the keyboard eats the bottom half of the screen: measured on the
    // live page at a keyboard-open viewport (375x400) the button sat at 420px — 20px below the fold,
    // so after typing a name there was nothing on screen telling you where to go next.
    <div className="sticky bottom-0 z-10 mt-5 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <Button type="button" size="lg" onClick={onClick} disabled={disabled} className="w-full">
        {children}
      </Button>
    </div>
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
