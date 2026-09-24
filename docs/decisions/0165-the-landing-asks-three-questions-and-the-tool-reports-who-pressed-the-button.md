# 0165 — The landing asks three questions, and the tool finally reports who pressed the button

> Numbered 0165 after a sweep of **every** ref (`refs/heads` + `refs/remotes`), the way 0164 says to:
> 0058–0164 are taken, most of them on branches that have not merged, so `main`'s highest number is
> misleading and reading it alone is how two decisions end up with one number.

- **Date:** 2026-09-24
- **Status:** **built and stress-tested; awaiting the owner's approval and deploy.** Branch
  `feat/guided-first-invoice` off `gitlab/main` `5b5550f`. **Not deployed, not pushed.**
- **Decision:** `/` stops presenting the free tool as one long form. Pressing *Create invoice* opens a
  **guided three-step flow** — your business, who it is for, what you are billing for — then the
  finished invoice with *Download PDF*. The full editor is still there, one press away at the end,
  over **the same draft**. Four measured defects on the live page are fixed with it, and the two
  events 0164 specified and never built are built.

---

## 1. Why three steps

The app has asked these three questions, in this order, since long before this page existed:
`STEP 1 OF 3 - ADD BUSINESS` → `ADD CLIENT` → `ADD ITEMS`
(`docs/android-first-invoice-flow.md` §1, `InvoiceScreen.kt:2288-2293`). The web asked all of them at
once, in seven cards and about forty fields, to a stranger who arrived from a social ad.

Two products that ask the same three questions in the same order are one product. That is the whole
argument, and it is also the G1 argument: the distance between "opened the page" and "my own first
invoice" is what this page exists to shorten.

**One thing from the app was deliberately NOT copied.** Its progress bar divides by four while only
three things can increment it, so it reads `COMPLETE` above a three-quarters-full bar
(`InvoiceDocumentUiState.kt:161`). Here it is three of three, and step 3 fills it.

## 2. One draft, two views — the risk this change actually carried

The guided flow and the full editor are two renderers of **one** `useFreeInvoice()`. Nothing in it
was rewritten; the `useState` and `useEffect` calls were *moved* out of `FreeInvoiceTool` unchanged.

A second copy of the state was the real danger, and it would not have looked like a bug:

- two drafts, and two debounced autosaves racing over one IndexedDB row;
- two `downloadPdf` implementations, drifting the first time either is touched;
- **the funnel events firing twice** — §1.11's defect arriving by a new road, and the one that would
  have been read as growth.

The editor also stays **mounted and hidden**, never unmounted, which 0164 already decided and which
now buys a third thing: `#fi-paper` stays in the document, so `exportInvoicePdf` can clone it and
**step 4's Download works with the editor never on screen**. Verified: the clone measures 794×1123
with real content while its source sits inside a `hidden` subtree.

## 3. The four defects, each measured on the live page first

| | Was | Now |
|---|---|---|
| **The CTA was below the fold** | On 375×667 the button's bottom edge sat at **696 px against a 667 px viewport** — 27 px of a 56 px button. That size is a common budget Android and the iPhone SE, and India / South Africa / Pakistan are where this traffic comes from. | **311 px** at 1× and **596 px** at a 1.5× font. Fully visible at 375×667, 375×812 and 320×667, in both directions. |
| **Two competing filled buttons** | "Create account" was an outlined button in the most valuable corner of a page that promises *no sign-up*. | A plain text link beside "Sign in". One filled element per screen, and on this page it is *Create invoice*. |
| **The same promise three times** | A pill, the subline, and a line under the button all said "free / no sign-up". | The subline only. That is also ~90 px of the height the button needed. |
| **A sample invoice from nowhere near the reader** | `$1,200.00` billed to *14 Mill Street, Leeds*. The top countries after Pakistan are India, South Africa, Somalia, Zambia, Zimbabwe, Nigeria, Sri Lanka. | The visitor's own currency, from the same `initialCurrency()` the tool opens with, read in the browser so `/` stays static. The address is gone — there is no such thing as a neutral street, and the name is what identifies who an invoice is for. |

**The figures in the sample do not move with the currency**, deliberately. Re-scaling `1,200` into
plausible rupees or rand would be us inventing a price list; the amounts are a shape, and the symbol
in front of them is the part that says whose invoice this is.

**Why the glimpse moved rather than went.** On a phone the order is now message → button → stores →
glimpse; from `lg` the two-column arrangement 0164 built is untouched. The glimpse is ~320 px of
decoration and it was what put the button under the fold. It is still the first thing below it,
which is where somebody who wants to see before pressing will scroll anyway.

## 4. The logo moment

The Android app has generated a logo from the typed business name since before this page existed,
and saves it as the business's logo when no photo is chosen
(`CreateBusinessScreen.kt:229-243`). **It does it silently, so nobody knows it happens.**

Step 1 shows the mark the moment a name exists, with the three answers a person actually has:
**Keep · Change · Skip**. Keeping it draws the mark to a canvas and stores it as the invoice's logo —
the same kind of data URL a chosen photo produces, which is why `has_logo=true` on
`free_invoice_completed` is then honestly true. Editing the name afterwards refreshes a kept mark, so
an invoice never carries an `N` while everything else on it says `NC`.

Initials are taken by **code point, not by string index**: `محمد`, `नमस्ते`, `北京` and an emoji are each
more than one `charAt`, and slicing by index hands back half a character that draws as `�`. An empty
or symbol-only name produces **no mark at all**, never a mark for a business we invented.

## 5. Events

### The two 0164 specified and never built

Verified absent from the deployed bundle. Without them nobody could count how many people press
*Create invoice* — the one number this page exists to move. `free_invoice_page_view` said somebody
landed; nothing said anybody pressed.

- **`free_invoice_tool_opened`** — `method` = `cta_press | deep_link`. Two real doors, and they must
  not be one number: arriving on a URL that already says `#create` is a reload, a bookmark or a
  shared link, where nobody was persuaded of anything. Counting them together would make every
  change to this page look better than it was, in proportion to how many people reload it.
- **`free_invoice_store_badge_click`** — `destination` = `play_store | app_store`. A **new** name, not
  0163's `free_invoice_install_offer_click`: that one is pressed by somebody who already got a PDF
  out of this page. One id for both would put two populations under one name (§1.4) and would raise
  the offer's numbers the day this deployed, with nothing saying so. `app_store` is declared and
  nothing renders it as a link, exactly as 0163 declared it for the offer.

### The two the guided flow needs

- **`free_invoice_step_reached`** — `step` = `client | items | done`, first time only. **One name with
  the step as a parameter** (§1.1); three names would make "how far did they get" an OR across three
  counters, and the first one anybody forgot would lower the number in silence.
  - **`business` is deliberately not a value.** Reaching step 1 *is* the tool opening, and that
    already has a row. Two names for one moment is one press counted twice (§1.11). So the funnel
    reads `free_invoice_page_view` → `free_invoice_tool_opened` → these three, and the denominator of
    "reached the client step" is the `tool_opened` count.
  - `done` is the finished-invoice screen being shown, **not** a PDF. The download is its own press
    and its own row, and the gap between the two is the last drop before this surface's G1 moment.
- **`free_invoice_logo_choice`** — `choice` = `kept | change_opened | skipped`.
  - `change_opened` is the file picker opening and **nothing more** (§1.14). Whether a file was then
    chosen is not observable from a press — a cancelled picker looks identical — and it is already
    answered honestly by `has_logo` on `free_invoice_completed`. A value called `changed` would be a
    claim about an outcome nobody watched.
  - Not capped to once a visit: somebody who opens the picker, cancels, then keeps the generated
    mark has done two things, not one.

Every one is on the permitted list in `src/app/api/analytics/track/route.ts`'s schema
(`src/lib/analytics/events.ts`), or it is **silently dropped**. All four carry
`surface=web_free_tool` and the server-stamped `viewer_platform`.

**0163's semantics are untouched**: `free_invoice_form_typed` / `_completed` / `_pdf_download` fire at
exactly the same moments, and `source` = `typed | sample | sample_edited` still answers the G1
question this surface has and the app does not.

### Verified by their stored shape, not their call site

Against a local capture server standing in for `/v2/analytics/track`, driving the real page:

```
free_invoice_page_view          {"surface":"web_free_tool","viewer_platform":"android"}
free_invoice_tool_opened        {"method":"cta_press", …}       and  {"method":"deep_link", …}
free_invoice_form_typed         {"form":"business"} {"form":"client"} {"form":"item"}
free_invoice_logo_choice        {"choice":"kept", …}
free_invoice_step_reached       {"step":"client"} {"step":"items"} {"step":"done"}
free_invoice_completed          {"source":"typed","items":1,"has_logo":"true","has_tax":"false",
                                 "has_discount":"false","optional_fields":0, …}
free_invoice_pdf_download       {"outcome":"saved","source":"typed", …}
free_invoice_install_offer_shown{"trigger":"pdf_downloaded", …}
free_invoice_store_badge_click  {"destination":"play_store", …}
```

Each step fired **once**, in order. Plus 11 unit tests over the schema, including that
`step=business`, `choice=changed` and `destination=web_account` are all **refused**.

## 6. What broke under stress, and what it cost

Everything below was measured, not predicted: 375×667, 375×812 and 320×667, at 1× and 1.5× font, in
LTR and RTL, with a 68-character business name, a 58-character client name, a 113-character line
description and `₨1,284,500.75`.

1. **The line amount was painted outside its own pill.** At 320 px with a 1.5× font the pill came out
   136 px and the figure is 154 px, so `₨1,284,500.75` was drawn **36 px to the left of its own grey
   tint** — half on the pill, half on the card, over the price it was computed from. `scrollWidth`
   still equalled `clientWidth`, so nothing that looks for page overflow would have found it.
   Fixed by giving the amount the full width of the item card (outside the column the delete button
   shares), with `overflow-wrap: anywhere` as the floor under it. **A figure drawn outside its own
   box makes the arithmetic look wrong, which is a trust cost (G3) on the one screen whose job is to
   say the numbers are right.**
2. **The same defect, smaller, in the full editor** — 4 px past the right edge at 375 px / 1.5×, and
   **pre-existing**. Fixed the same way.
3. **A duplicate `id`.** Both views carry a business-name field and both are in the document at once,
   so `fi-business-name` existed twice — invalid, and it silently breaks whichever `<label for>`
   loses. The editor's is now `fi-editor-business-name`; the guided one keeps the id the landing
   focuses after the CTA press.
4. **The editor was squeezed to 560 px.** The reading width meant for one question per screen had
   been put on the shell, so revealing the three-column editor gave it 560 px of a 1024 px window.
   The cap is now on the steps only; the editor measures 961 px at 1024, as before.

After the fixes: `scrollWidth == clientWidth` at every size, font scale, direction and step, and no
money element outside its box anywhere.

## 7. Rejected

- **A wizard on its own route (`/create`).** A page hop between the search result and the form is a
  place for free traffic to fall out of, on the one surface that costs nothing to acquire. 0164
  rejected this and it stays rejected.
- **A second copy of the invoice state for the guided flow.** §2.
- **Unmounting the editor.** It would take every label and heading in it out of the static HTML that
  a crawler reads, and it would take `#fi-paper` with it, so step 4 could not produce a PDF.
- **A name per step** (`free_invoice_business_step`, …). §1.1.
- **A `changed` value on the logo choice.** §5.
- **Hiding the glimpse on phones.** Moving it below the button costs nothing and keeps the owner's
  "a look at the thing" — deleting it would have thrown away the only picture of the product.
- **Re-scaling the sample invoice's amounts per currency.** §3.
- **An identity step, a paywall before the first invoice, or anything else the competitor does.**
  Our three advantages are deliberate and untouched: no Google/Apple/Email choice, no paywall before
  the first invoice, and an instant load against their ~30 s of blank screen.
- **Measuring the press on "Change template & colour".** Deliberately not built, and named here so it
  is a choice rather than an oversight: it is a continuation, not a drop, and there is no decision it
  would change today. If the guided flow works, almost nobody presses it; if almost everybody does,
  the step counts will already say so.

## 8. For the owner to decide

1. **The copy is in English.** The design was written with some phrases in Roman Urdu — *"Likhte hi
   banti jayegi"*, *"Kis cheez ka bill?"*, *"Invoice tayyar hai"*, *"Template & rang badlein"*,
   *"Rakhein · Badlein · Skip"* — and some in English. `/` is the page that ranks for **"free invoice
   generator"**, and its traffic after Pakistan is India, South Africa, Somalia, Zambia, Zimbabwe,
   Nigeria and Sri Lanka. Roman Urdu headings on that page would not read for most of that traffic
   and would work against the search ranking the whole plan rests on. So every English string is
   exactly as given, and the Urdu ones were rendered in English: *"It builds as you type"*, *"What
   are you billing for?"*, *"Your invoice is ready"*, *"Change template & colour"*,
   *"Keep · Change · Skip"*. **Flipping any of them back is a one-line change.**
2. **Step 3 carries a currency control** that the design did not list. Without it a person in a
   country we do not guess correctly cannot fix the currency before downloading, and a wrong currency
   on an invoice is the exact trust bug the constitution names (invariant 6). It is a small pill
   beside the word *Total*, never on the figure, so the largest number on the screen is still only
   the amount.
3. **The store badge artwork is still ours, not the stores'** — 0164's open question, unchanged.
   Google's brand guidelines ask for the unmodified official asset.
4. **An iPhone still leads with *App Store — Soon*** — 0164's open question, unchanged.
