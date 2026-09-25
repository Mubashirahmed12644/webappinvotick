# 0166 — The keyboard carries the guided invoice, and Back means one step back

> Numbered 0166 after a sweep of **every** ref (`refs/heads` + `refs/remotes`), the way 0164 and
> 0165 say to: 0058–0165 are taken, most on branches that never merged.

- **Date:** 2026-09-25
- **Status:** **built, measured and deployed.** Branch `feat/guided-two-taps` off `main` `cd17ebc`.
- **Decision:** the guided first invoice (0165) is finished to its intended shape — the keyboard
  carries the reader from one step to the next without a tap, the item step has one number field
  instead of two, the sticky bar carries the total rather than hiding it, and each step owns a
  history entry so Back means one step back. The logo moment becomes one button instead of three,
  and the outcome it used to report moves onto a parameter of the event that was already there.

---

## 1. The four defects, each measured on the live page first

Measured against `cd17ebc` on `https://www.invotick.com`, driving the real page in a browser and
reading the DOM — never a screenshot, and never the source.

| | Was, measured | Now, measured |
|---|---|---|
| **Focus did not carry between steps** | Step 1's field auto-focused. After Enter on step 1 and again on step 2, `document.activeElement` was **`BODY`** — the keyboard dropped and the next field had to be tapped. Three of the journey's six taps existed for this. | `INPUT#fi-client-name` after step 1, `INPUT#fi-item-desc-0` after step 2, `INPUT#fi-item-price-0` after the description. Never `BODY` until step 4, where there is deliberately nothing to type. |
| **The item step had no keyboard help** | Three fields, `enterKeyHint` **`null`** on all three, no Enter handler. Two of them `inputMode="decimal"`. | Two fields: description `enterKeyHint="next"`, price `enterKeyHint="go"`, both with handlers. One decimal field instead of two. |
| **The sticky bar covered what it was helping with** | At 375×400 the bar sat **327–400** — the bottom 73 px. `+ Add item`, **Subtotal** and **Total** were all below 400 and off screen; scrolling took each in turn *behind* the bar (Add item at scrollY 100, Subtotal and Total at scrollY 200) and they cleared it only at scrollY 300. | The **total is in the bar**. The subtotal is drawn only when it differs from the total. Every field keeps `scroll-margin-bottom: 128px`, so the browser's own focus-scroll parks it **228–272** against a bar at **291–400**, and a height-gated spacer gives the last element the room to be scrolled clear. |
| **Back did not mean one step back** | `history.length` was **2 on step 1 and still 2 on step 4** — the flow created no history at all. Back from the finished invoice left the flow. | 2 → 3 → 4 → 5, one entry per step. Back walks `#create-done` → `#create-items` → `#create-client` → `#create`, and Forward returns. |

## 2. Why the focus is taken in the handler and not in an effect

`flushSync(() => setStep(next))` renders the next step **before `goTo` returns**, so the `.focus()`
after it happens inside the very gesture that pressed the key. iOS Safari keeps the keyboard up only
for a focus that happens in a gesture's own call stack; from a `useEffect` the keyboard drops, which
is exactly what the live page did. `LandingExperience.reveal()` was moved to the same pattern for
the same reason — it had been focusing from an effect and happened to work.

This is the one place in the flow where `flushSync` earns its cost, and it is written down here so
nobody "tidies" it back into an effect.

## 3. Q1 — the item step is two fields and a quantity chip

Three shapes were drawn at 375 px with real content (`flow-mockup.html`), and **A** was built:

- **A (built)** — description, then price, with quantity on a `× 1` chip that opens the real
  quantity field when pressed.
- **B** — keep three fields and add the keys.
- **C** — one row: description, quantity, price.

**Why A.** Quantity is 1 on very nearly every first invoice, so B spends a field on a number almost
nobody changes — and worse, it makes the *last* thing typed a second number pad. C truncates the one
field whose job is to say what the work was (about 11 characters at 375 px) and puts a large figure
back into a 72 px cell, which is the defect 0165 measured and fixed. A leaves one text field and one
number field, in that order, so the keyboard carries the reader from the description straight to the
price with nothing in between.

Nothing about the data changed: the chip opens the same `quantity` field, and the amount is still
quantity × price.

### The honest limit on "2 taps", and it is Apple's

**An iPhone's decimal pad has no return key at all**, and no `enterkeyhint` can put one there. So
the last press of this flow is carried by the keyboard on Android and on a desktop, and on an iPhone
it costs one tap on *Preview & download* — which is why that button is now permanently above the
keyboard rather than under it.

| | Android / desktop | iPhone |
|---|---|---|
| Taps from landing to PDF | **2** — *Create invoice*, *Download PDF* | **3** — plus *Preview & download* |

Claiming 2 everywhere would have been a claim about a keyboard nobody here can change.

## 4. Q2 — the logo is kept quietly, with one button

The generated mark is applied the moment a business name exists, the way the Android app has done it
since long before this page existed (`CreateBusinessScreen.kt:229-243`) — but **visibly**, with the
one answer a person actually needs beside it: *Change*.

*Keep* is what almost everybody wanted, so it is the default rather than a press. *Skip* is gone:
removing a mark we drew is not a decision worth a button on the first screen, and the full editor
clears it as it always could. The block sat directly between the name field and the way forward,
which is the path the keyboard now runs through.

Three properties are preserved exactly: initials are taken by **code point, not string index**; a
name with no letters produces **no mark at all**, never a mark for a business we invented; and
editing the name refreshes a mark we made, so an invoice never carries an `N` while everything else
says `NC`. A file the person chose is never overwritten.

## 5. Events — one parameter, no new name

`free_invoice_logo_choice` stops sending `kept` and `skipped`, because **there is no press left to
report** and an event fired for something nobody did is noise. `change_opened` is unchanged. Both
retired values stay in `LOGO_CHOICES`: rows sent before this carry them, and removing a value from
the code space would make its own history unreadable (§1.8).

What those two rows could see moves onto the event that already reports the finished invoice:

- **`free_invoice_completed` gains `logo_source` = `generated | uploaded`**, beside the `has_logo`
  it already had. A parameter on a surviving event, never a new name (§1.1).
- **Absent means unknown**, and that covers two real cases: an invoice with no logo, and a draft
  stored in this browser before the field existed. It is never filled with a guess (§1.7).

Verified by the **stored shape**, driving the real page against a captured `/api/analytics/track`:

```
free_invoice_tool_opened    {"method":"cta_press"}
free_invoice_form_typed     {"form":"business"}
free_invoice_step_reached   {"step":"client"}
free_invoice_form_typed     {"form":"client"}
free_invoice_step_reached   {"step":"items"}
free_invoice_form_typed     {"form":"item"}
free_invoice_completed      {"source":"typed","items":1,"has_logo":"true","logo_source":"generated",
                             "has_tax":"false","has_discount":"false","optional_fields":0}
```

**And once each across Back and Forward.** `free_invoice_step_reached` used to be guarded by
`next > step`, which was correct only while the flow had no history — with Back, walking back to the
items and forward again would have sent a second `items` row and made a funnel's later steps outgrow
its earlier ones. The guard is now a set of steps already reported. Measured: back twice, forward
twice, and the counts stayed `client` 1, `items` 1, `done` 1.

## 6. There is no ad on this page and there never will be

Owner, 2026-09-25: we have no AdSense approval, so ads on the web tool are not possible at all.
Nothing in this design reserves a slot, leaves a gap, or compromises a layout for something that
cannot appear, and no future change to it should.

This is worth writing down as a property of the surface rather than a footnote: the app gates this
same journey behind an ad dialog before the invoice exists, and the web does not and now never will.
That makes `/` the cleanest path to G1 we own, which is the whole reason its tap count is worth this
much attention.

## 7. What the history change costs, said plainly

**A reload lands on step 1, whatever step the URL names.** The draft is restored from IndexedDB
asynchronously, so at first render nothing is known about it; rendering step 3 there would draw an
items screen over an empty invoice and then correct itself. A `replaceState` back to `#create` on
mount is the price, and Back-within-a-session — the thing that was actually broken — works.

Every step hash begins `#create`, which is what `LandingExperience` tests for, so every one of them
is still a door into the tool and `free_invoice_tool_opened`'s `deep_link` keeps its meaning.

A `popstate` **deliberately does not take focus**. Returning to a step is reading, not typing, and a
keyboard that springs open on a Back press is the page fighting the reader.

## 8. Rejected

- **Focusing from a `useEffect`.** §2. It is what the live page did and it is why the keyboard
  dropped.
- **Auto-advancing step 3 when both fields are non-empty.** There is no way to tell `150` from a
  half-typed `1500`, so it would take the screen away mid-number.
- **Putting the total inside the button's label** (*"Preview & download · ₨1,284,500.75"*). It fits
  at 375 px and it would have kept the bar at 73 px, but the currency control would have lost its
  home, and a wrong currency on an invoice is the trust bug invariant 6 exists for.
- **A thinner bar.** 73 px → 109 px is the cost of the total being in it, on a 400 px keyboard
  viewport. The answer to a bar that hides something is to put the thing in the bar, not to shave
  the bar until it hides slightly less.
- **Padding the panel unconditionally** to give the bar scroll clearance. On a viewport tall enough
  to show the whole step it is white space for nothing, so the spacer is behind
  `@media (max-height: 620px)` — the condition under which the bar actually sticks.
- **A `skipped` value with no press behind it**, and a `kept` fired automatically. §5.
- **Keeping the URL on a reload.** §7.

## 9. Verified

- **The four defects**, each with the measurement that found it: §1.
- **Stress**, the 0165 set: 375×812, 375×400 and 320×667, at 1× and 1.5× font, LTR and RTL, at all
  four steps, with a long business name, a long client name, a 54-character description and
  `₨1,284,500.75`. `scrollWidth == clientWidth` everywhere and **no money element outside its box**
  anywhere — and the detector was calibrated by displacing a figure on purpose and watching it fire.
- **Nothing 0165 built was undone**: `#fi-paper` is still in the document (543×768) with the editor
  hidden, the editor still measures **961 px at 1024**, and `fi-business-name` / 
  `fi-editor-business-name` are still one element each.
- **`/` is still statically prerendered** — the build reports `○ /`.
- 34 unit tests pass, up from 32. The two new ones were **calibrated**: removing the schema entry
  turns one red.
