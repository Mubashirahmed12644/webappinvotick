# 0164 — The landing shows an invoice, and "Create invoice" opens the tool on the same page

> Numbered 0164 after a sweep of **every** ref (`refs/heads` + `refs/remotes`), not just `main`:
> 0058–0163 are taken, most of them on branches that have not merged, so `main`'s highest number is
> misleading and reading it alone is how two decisions end up with one number.

- **Date:** 2026-09-23
- **Status:** **design built and proven on a phone; awaiting the owner's approval.** Branch
  `feat/hybrid-landing` (off `gitlab/main` `65a6bab`). **Not deployed. The events for the new surface
  are deliberately not wired yet** — see *What is still open*.
- **Decision:** `/` becomes a landing — a message, a glimpse of a finished invoice, **one**
  "Create invoice" button, and the store badges under it. Pressing the button reveals the existing
  free invoice tool **on the same page**, with no navigation of any kind.

## Why the owner asked for this

`/` is the page a social ad lands on, and it was the bare tool: a form, with no message above it and
nothing saying what Invotick is. It also carries the organic traffic that searches "free invoice
generator". Both audiences arrive at the same URL and want opposite things — one needs to be told,
one needs to start typing.

## The three options, and why C

**Option A — landing only, the tool moves to `/create`.** *Rejected.*
`/` is the page that ranks for "free invoice generator". Putting a page hop between the search result
and the form adds a place for free traffic to fall out of, on the one surface that costs nothing to
acquire. The tool's markup would also leave the page that ranks for it.

**Option B — the tool only, as today.** *Rejected.*
It carries no message and no call to action. Somebody who arrives from an ad has no idea what this
is, and there is nowhere to put the app in front of them.

**Option C — hybrid, and what was built.** The landing and the tool are the same page and the same
URL. The message, the glimpse, the one button and the badges are what you land on; the tool is one
press away and already there.

## How the tool is revealed, and the one thing that was not allowed to cost anything

The tool is **hidden, not unmounted** — `<div hidden>`, never `{open && <FreeInvoiceTool/>}`.

1. **The prerendered markup is unchanged.** Every label, placeholder and heading inside the tool is
   still in the static HTML that a crawler reads. `/` is still `○ Static` in `next build`; nothing in
   the page's tree reads `headers()`, and the device is read in the browser instead.
2. **The press costs nothing.** No fetch, no parse, no mount. On the phone that is 88.5 % of this
   traffic, that is the difference between a reveal and a wait.
3. **No existing event changes meaning.** The tool still mounts on page load, so its draft restore,
   its autosave and `free_invoice_completed` fire exactly when they fired before. Unmounting it would
   have moved all three behind a button press, silently.

`#create` is written with `replaceState`, so a reload or a shared link opens straight into the form —
and the back button still belongs to "where I came from", not to "I closed a panel". Only a **press**
scrolls and takes focus; arriving on `#create` does neither, because a page that jumps and opens the
keyboard before the reader has done anything is a page fighting them.

## `free_invoice_page_view` keeps its meaning, exactly

**This is the trap in this change, and it is worth stating in full.** That event is the denominator
of decision 0163's whole funnel, and it is hours old. It fires from `FreeInvoicePageView`, which sat
next to the tool because the tool *was* the page.

The obvious implementation — move it inside the revealed tool, since that is "when the tool opens" —
would have turned "how many people landed here" into "how many people pressed the button", **with
nothing saying so**. Every rate measured against it would have risen overnight, and the rise would
have looked like the new landing working.

So: **`FreeInvoicePageView` stays mounted by the page**, above `LandingExperience`, and
`free_invoice_page_view` still means *somebody landed on this page*. It is unchanged, its history is
unbroken, and there is a comment at its call site saying why it must not move.

The tool opening is a **different moment** and needs a **different name**. It is not built yet
(below).

## The store badges

- **The device decides the order.** Android → Google Play first and brand-tinted. iPhone → App Store
  first. Desktop → level, because neither store is the device in the hand.
- **Read in the browser, never with `headers()`**, through the same `platformFromUserAgent` the
  analytics route runs server-side — one implementation, two readers, so the order that rendered and
  the `viewer_platform` that will be stamped on the event cannot drift. Both badges are always in the
  DOM at the same size, so the reorder is CSS `order` only and costs no layout shift.
- **They stack on a phone and sit side by side from `sm`.** Measured: at 320 px two badges leave
  138 px each, and "Google Play" alone is about 125 px of bold text at a 1.5× font scale, before the
  icon and the padding. `LAYOUT_RULES.md` — never assume two things fit side by side.
- **The Play link carries `utm_source=invotick_landing`**, deliberately *not* the install offer's
  `free_invoice_tool`. The offer is pressed by somebody who has already made an invoice here; the
  badge is pressed by somebody who went straight to the store. Two acquisition stories, and §1.16
  matches a tag by equality on all three values — one tag for both would make them one number for
  ever.

### The App Store badge is not a link, because there is no listing

Checked 2026-09-23: `itunes.apple.com/lookup` returns `resultCount: 0` for **both**
`id=6757918977` and `bundleId=invotick.invoicemaker`. So it renders as *Soon* — a `<div>`, not an
`<a>` and not a disabled `<button>`: it is not a control that failed, it is a statement, read once
through its `aria-label` and taking no focus.

A badge that looks like a link and lands on "App not available" is worse than no badge: on an iPhone
it is the first thing the person tries, and it tells them the product does not exist (G3).

**Flipping it is one line** — `APP_STORE_URL` in `src/lib/free-invoice/install.ts`. Give it the
listing URL and the badge becomes a live App Store link, an iPhone gets it first, and
`destination=app_store` starts arriving. Nothing else changes.

## What the phone changed — the design was wrong four times, and only on a phone

The owner's instruction that produced this section: *"sometimes what we picture doesn't adjust that
way on mobile"* — the design is finalised on a real phone before the functionality.

1. **The glimpse cropped its own total.** It was cut to an A4-ish ratio with a fade, and at 375 px
   the fade landed exactly on `Total $1,987.20`: a grand total half dissolved into white, on the page
   whose job is to say *your numbers will be right*. The crop and the fade are gone; the card is as
   tall as what is in it.
2. **The subline ran to four lines**, 160 px of grey text between the headline and the one button
   this page has. Two lines now.
3. **The top bar held a second solid blue button.** "Create account" competed with "Create invoice"
   for the same eye. It is outlined; there is exactly one filled button on the page.
4. **The top bar sliced its own labels at a 1.5× font scale** — "Sign in" broken across two lines
   inside its own button. The row wraps now and both labels stay whole.

### And three that were already live, found by the same pass

These are **not** regressions from this change. Each was measured on `65a6bab` — the build on
production — before anything here was written.

1. **The tool overflowed a 375 px phone by 119 px.** `clientWidth` 375, `scrollWidth` 494,
   `grid-template-columns: 478.531px`. Below `lg` the tool's root grid had no column definition, so
   the single implicit column was `auto` — sized to the widest thing in it. The widest thing is
   `#fi-paper`, a **fixed `width: 794px`** element shrunk with `transform: scale()`, and a transform
   does not change what an element occupies in layout. Every card, label and input was drawn past the
   right edge and the page scrolled sideways to cover it. Fixed with `grid-cols-1`
   (`repeat(1, minmax(0,1fr))`) and `min-w-0` on the items.
2. **A line total was painted over the field it came from.** Qty / Rate / Amount shared
   `grid-cols-3`; at 375 px that is a 72 px cell, and `Rs1,284,500.75` is about 105 px, so the amount
   lay across the Rate the user had just typed. The amount has a row of its own now, at every width,
   with its label giving way before the figure does.
3. **At a 1.5× font scale the line-item row pushed 106 px off the side.** An `<input>` carries an
   intrinsic minimum of about twenty characters, and a flex item's automatic minimum is its
   min-content, so the field stopped shrinking. `min-w-0` + `w-full` on `TextField`, `min-w-0` on the
   row.

### What held

- **320 px:** no overflow. The glimpse is sized in `cqw` — hundredths of its own width — so it is one
  drawing that scales rather than a layout that can run out of room.
- **1.5× font scale:** no overflow anywhere, after the fixes above. On the amount row the *label*
  wraps away and the figure stays whole, which is the rule.
- **RTL** (`dir="rtl"`): the page mirrors correctly — nav, badges, and the CTA's arrow — with no
  overflow. The glimpse deliberately stays `dir="ltr"`: the sample is an English invoice, and
  flipping it would not make it an Arabic one, it would make it a backwards English one. The English
  marketing strings do show the usual bidi artefacts inside an RTL document (`100%` and a full stop
  moving to the far end); those are a **content** matter that disappears when the copy is actually
  Arabic or Urdu, not a layout failure. There is no RTL locale on this site today.
- **Long content:** a 76-character business name, a 61-character client name, a 118-character line
  description and `Rs1,284,500.75` — form and A4 preview both hold, nothing truncated.
- **Empty, filled and error states**: the logo-too-large error renders inside its card without moving
  anything.

## What is still open

1. **The events for the new surface are not built.** Their shape depends on the approved design — how
   many doors the tool has, and whether the App Store badge is ever pressable — and §6 of
   `AGENTS-EVENTS.md` cannot be answered before that is settled. The proposal, for the owner and not
   yet decided:
   - **`free_invoice_tool_opened`**, with `method` = `cta_press | deep_link`. One action, one event,
     the variation as a parameter (§1.1). `cta_press` is the button; `deep_link` is arriving on a URL
     that already says `#create`, which is a real second way in and must not be counted as a press.
   - **`free_invoice_store_badge_click`**, with `destination` = `play_store | app_store`. A **new**
     name, not 0163's `free_invoice_install_offer_click`: that one is pressed by somebody who has
     already made an invoice and got a PDF, and filing a landing badge under it would put two
     populations under one id (§1.4) and raise the offer's numbers the day this deployed.
     `app_store` is declared and nothing renders it, exactly as 0163 declared it for the offer.
   - `viewer_platform` is stamped server-side on both, so "on what device" needs no parameter.
2. **Whether an iPhone should really see a dead badge first.** The order is device-first as asked,
   so an iPhone leads with *App Store — Soon*. It is honest and it answers the first question an
   iPhone user has, but it is not the highest-converting arrangement. The alternative is Play first
   everywhere until the iOS listing exists. **Owner's call.**
3. **The badge artwork is ours, not the stores'.** Google's brand guidelines ask for the unmodified
   official "Get it on Google Play" asset. What is drawn here is our own badge in the site's tokens,
   because the official black artwork clashes with everything else on the page. **Owner's call**
   before this ships.
