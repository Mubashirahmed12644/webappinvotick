# 0167 — "Kaghaz par seedha likhein": the paper is the input surface, kept as the A/B challenger

> Numbered 0167 after sweeping **every** ref (`refs/heads` + `refs/remotes`) plus the working tree,
> the way 0164–0166 say to: 0058–0166 are taken, most on branches that never merged.

- **Date:** 2026-09-25
- **Status:** **design only, kept.** Not built, not scheduled, nothing deployed. The drawing lives at
  [`docs/design/kaghaz-par-seedha-likhein.html`](../design/kaghaz-par-seedha-likhein.html).
- **Decision:** the "write straight onto the paper" design is **rejected as the default** and
  **kept as the A/B challenger** against whatever onboarding ships. Preserved in git, in this repo,
  because it existed only in a scratchpad that has already been wiped once today.

---

## 1. What the owner said

On 2026-09-25 the design agent showed three directions for the web tool's start flow. The owner
rejected the set — *"design failed ho gaya hy"* — and then singled this one out to keep:

> **"ye design — kaghaz per seedha likhny wala — kaam tm apny memory per save rakhna, isko ham a/b
> testing zaroor kerna chain gy."**

So: **the set was rejected, this idea was not.** Anyone reading "the three directions were rejected"
and concluding this one is dead is reading it wrong. That is the whole reason this file exists.

## 2. What it is

**There is no form. The screen is the invoice.**

- Empty values are **dotted blanks inside the paper**, in the place where they will print. The
  business name is written on the `From` line, the client's under `Bill To`, the work in the first
  ruled row of the item table.
- The active blank turns brand-coloured and carries the caret; every other blank stays dotted.
- The **keyboard's next key walks the reader along the document** — header → Bill To → description
  → price → done.
- The **totals ladder is on screen the whole time** and fills in as the lines arrive:
  `SUB TOTAL · DISCOUNT · TAX · TOTAL · AMOUNT PAID · BALANCE DUE`, the last one solid brand.
- **There is no progress bar and no step counter.** The progress is how much ink is on the paper.
  This is deliberate: a wizard bar is the single loudest "this is a website" signal on a surface
  whose whole job is to look like a document.
- At the end the dotted blanks are gone, the Invotick footer band appears — the document signs
  itself — and there is **one** filled button.

It is the most literal answer to the brief that produced the round: *the thing that makes an invoice
should look like the invoice it makes.* The visual language is taken from
`src/components/invoice/InvoiceDocument.tsx` — the one render engine (invariant 1) — re-set at phone
scale rather than shrunk: square corners, 1px brand rules, the brand header band, the six-rung
totals ladder, the `#F5F5F5` footer band.

## 3. Cost and risk — why it is not the default

**Estimate: 4–5 days, plus its own measured pass.** It was the most expensive of the three when it
was drawn and nothing here has made it cheaper.

1. **Every field has to live inside the paper.** There is no field component to reuse — each value
   is an inline editable that must sit exactly where the renderer prints it, at phone scale, and
   still be a real input with `inputMode` and `enterKeyHint`.
2. **The active line must scroll above the keyboard.** With the keyboard up the app has about
   375×400, and the line being written is in the middle of a document ~900 px tall. The document has
   to scroll itself so the active blank is visible — this was a **real failure found twice** while
   drawing the mockup (the typed line was clipped), and it is the single hardest thing about the
   design. The preserved file shows the corrected behaviour, per step.
3. **`font_scale` 1.5 needs its own pass.** A document has a fixed grammar; a form can reflow.
   Every rule in `invoice-kmp-app/docs/LAYOUT_RULES.md` bites harder here — especially *money and
   identifiers shrink, never truncate* and *never assume two things fit side by side*.
4. **RTL needs its own pass.** Arabic/Urdu invoices mirror the layout, and the stamp maths has
   already broken that way once.
5. **A7-width phones (320 px)** leave the item row very little; the mockup puts the description on
   its own line for exactly this reason and that must survive.

Against that: it is also the direction with the highest ceiling, which is why it is worth an A/B
rather than a bin.

## 4. How it would be measured — G1, not revenue

- **The web tool carries no ads.** Settled by the owner on 2026-09-25 (0166 Q3): we have no AdSense
  approval, so it is not a trade. **Nothing in this A/B may reserve an ad slot, and neither arm is
  judged on revenue.**
- The test is judged on **G1 — did more people reach a real first invoice with their own data**
  (decision [0006](0006-g1-real-invoice-metric.md)). On this surface that is a PDF produced from
  typed content (`free_invoice_pdf_download` with `outcome` and `source=typed`), not a sample and
  not a draft. Drop-off per step and time-to-first-invoice are the supporting signals.
- **The arm is a PARAMETER on the web funnel events that already exist**, never a new event name —
  `AGENTS-EVENTS.md` §1.1, and the same rule 0163 already applied to `trigger`. The events are
  `free_invoice_page_view`, `_tool_opened`, `_step_reached`, `_completed`, `_pdf_download`,
  `_install_offer_*`, `_store_badge_click`. The parameter's name and its allowed values are settled
  **when the test is built**, in `src/app/api/analytics/track/route.ts`, which is the one place that
  fixes permitted names and parameter values server-side (decision
  [0045](0045-the-share-link-page-reports-its-own-journey.md)).
- ⚠️ **`free_invoice_step_reached` does not transfer.** This design has no steps — it is one sheet.
  A funnel that compares "step reached" across the two arms would be comparing a real step against
  an invented one. Whatever stands in for it must be decided before the test, not after.
- Both arms must be instrumented **before** either ships, or the comparison is against a baseline
  nobody measured.

## 5. Rejected alongside it — do not re-propose these

From the same round, 2026-09-25 (the owner rejected all three as the default):

| Rejected | Why it is recorded |
|---|---|
| **"Zinda Kaghaz" / the living sheet** — the paper pinned above a short form on every step, the block being filled lit up, the rest dimmed | Was the *recommended* one. Rejected with the set. Do not bring it back as "the safe option". |
| **"Khamosh Safha" / the quiet page** — no cards, one big question on a rule, a strip of the sheet peeking from the bottom edge that rises at the end | Rejected with the set. It was also the weakest on the brief: the middle screens showed a peek, not the document. |
| A wizard **progress bar / `STEP n OF 3`** on this surface | Deliberately absent from this design; re-adding it removes the one thing that makes it read as a document. |
| **Three equal buttons at the end** (PDF · share · change template) | One filled element per screen ([[one-filled-element-per-screen]]). The end has one loud button; the logo invitation sits quietly *inside* the invoice's header band, not as a third button. |
| A **second, simpler drawing of an invoice** while building (the `GuidedInvoiceCard` pattern) and the real paper only at the end | The user builds invoice A and downloads invoice B. A small but real trust cost (G3), and it invented a label style the renderer does not use. |
| **Inverting the paper in dark mode** | An invoice is white paper and white paper is what gets sent. The chrome goes dark; the sheet stays white and becomes the only bright thing on the screen. |
| Any **ad slot, gap or reserved space** | Settled; see §4. |
| **Sign-up, account or email capture before the invoice exists** | This is the one surface with no friction at all, and that is its whole value. |

## 6. What is in the preserved file

`docs/design/kaghaz-par-seedha-likhein.html` — self-contained, opens in any browser, no build step.
14 phone frames at a true 375 px:

- **the whole flow, light:** landing, business, client, the work, done;
- **keyboard-open** for all three screens that have a field, at the real 375×400 with the keyboard
  drawn — including the iPhone decimal pad **with no return key**, which is why the sticky bar with
  the total has to exist;
- **dark**, with the paper still white;
- **1.5× font**, the test that this project's layout has failed six times before.

Real content throughout: `GIFTAT ENGINEERING (PVT) LTD`, `Northgate Coffee Roasters Ltd`,
`INV-107023`, a 14-word construction line, `$7,675.54`. Never `Lorem ipsum`, never "Item 1 / $100".

Verified on the file itself, with each check calibrated to fail first: **0** clipped text elements
across all 14 frames, and **0** keyboard frames where the line being written is outside the visible
document.

## 7. Open, for whoever builds the test

1. What stands in for `free_invoice_step_reached` in an arm that has no steps (§4)?
2. What is the parameter called, and what are its two values?
3. Does the challenger arm also change the landing, or only what happens after the press?

Related: [0006](0006-g1-real-invoice-metric.md) (what a real invoice is),
[0163](0163-the-free-invoice-tool-reports-its-own-funnel-and-offers-the-app-after-the-pdf.md) (the
web funnel events, and `trigger` as a parameter for exactly this reason),
[0165](0165-the-landing-asks-three-questions-and-the-tool-reports-who-pressed-the-button.md) and
[0166](0166-the-keyboard-carries-the-guided-invoice-and-back-means-one-step-back.md) (the incumbent
this would be tested against), `.claude/agents/design.md` (the design domain's policy),
`AGENTS-EVENTS.md` §1.1 (one action, one event — the arm is a parameter).
