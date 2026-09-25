# 0168 — The onboarding: Invoice Fly's shape, our facts, and what it costs in taps

> Numbered 0168 after a sweep of **every** ref (`refs/heads` + `refs/remotes`): 0058–0167 are taken,
> most on branches that never merged, and **0167 is already `the-paper-is-the-input-surface`** on
> another branch — reading `main`'s highest number alone is how two decisions end up with one.

- **Date:** 2026-09-25
- **Status:** **built, measured and deployed** on the owner's word ("us ky design ko live kero and
  mujhy batao, phir main next changes batata hn"). Branch `feat/onboarding` off `main` `2b84d78`.
- **Decision:** `/` gains the onboarding the owner approved — three value slides, four questions
  (business, trade, logo, the logo we made), "You're ready", the invoices home, and the first
  invoice with a coach-mark — in front of the guided invoice flow of 0165/0166.

---

## 1. What it costs, measured, because this is the number he asked for

Driven in a browser at 375×812, same harness both times, one character model for both runs.
**Before** is the live site at `da920a3`; **after** is this branch.

| | Before | After |
|---|---:|---:|
| **Taps from landing to a downloaded invoice** | **6** | **15** |
| Screens seen | 6 | 14 |
| Characters typed | 63 | 69 |
| Machine time, driven as fast as the page allows | 2.3 s | 6.1 s |
| Modelled human time | ~16 s | ~35 s |

**The tap count is a measurement. The time is a model and must not be quoted as anything else** —
60 ms per character typed, 1.2 s per tap, 0.9 s to take in each new screen. A person who actually
*reads* the three value slides will spend more than 0.9 s on each of them, so ~35 s is the floor,
not the estimate.

**Said plainly: this is materially worse for G1.** The journey from "opened the page" to "my own
first invoice" is the exact distance AGENTS.md §1 says this surface exists to shorten, and it has
gone from six presses to fifteen. Nine of the nine added presses come before the person has typed a
single thing about their own client or their own work.

Two things that are true at the same time, and the owner should have both:

- **It is still far faster than the product it was modelled on.** Invoice Fly's own onboarding runs
  17:42 → 17:44 by the clock on the owner's screenshots — about **two minutes** from cold start to
  first invoice, and it puts a **sign-in wall** in front of everything. We ask no account at all.
- **We were not competing with them on that number; we were beating it by a factor of twenty.** The
  six-tap flow was the thing that made this page different from every other invoice generator. What
  the onboarding buys — a business name, a trade, a logo on the invoice — is real, and whether it is
  worth nine presses is the owner's call, which is why he asked to see it live.

**What I did not do:** I did not add a "skip setup" escape. It would have blunted exactly the number
he asked to see, and the approved design has no such control. If he wants one it is a small change
and it belongs to him, not to me.

## 2. What was built, screen by screen

1. **Three value slides.** Black, our own invoice as the artwork (we have no photographs), a
   two-line headline, one sub-line, a full-width Continue. **No skip, no dots, no counter.** A quiet
   *Sign in* top-right on slide 1 only. Slide 1 carries the only two numbers we can honestly put
   there: **4,000+ businesses** and **96% never made an account** — theirs carries an App Store
   rating and we have no Play rating at all, so nothing was invented.
2. **"One moment…"** — shown only while the local database is still opening (`fi.restored`). There
   is no network call behind it, so in practice it never appears; it is built rather than faked.
3. **Business name** (1/4, bar 25%).
4. **What do you do?** (2/4, bar 50%) — search plus a single-choice list of 37 trades.
5. **Add your logo** (3/4, bar 75%) — optional, one *Choose image* chip.
6. **We made a logo** (4/4, bar 100%) — the mark, *try another*, **Skip**, Continue.
7. **"You're ready"** — never *"Account created!"*, because we create no account. Theirs says it
   even on the guest route; ours would simply be untrue.
8. **The invoices home**, empty.
9. **The first invoice**, with the coach-mark on the client block, dismissed by the first press.

## 3. The logo, and the reason this step exists at all

Invoice Fly's generated logo rendered its user's **"Touchpedia" as "Touchpenty"** — on the mark that
prints on the first invoice. A wrong name on an invoice is a trust cost (G3), and the only way to be
*incapable* of that mistake is never to send the name anywhere to be guessed at.

Ours is drawn on the phone from `inv.businessName` and nothing else, offline, in **eight designs**
(`LOGO_DESIGNS`) that differ by shape rather than hue: a filled tile, a circle, an outline, a split,
a stacked badge, a tinted tile, a monogram over a rule, and a corner cut. The trade's glyph is drawn
in where the design has room — and **only if it actually draws**: a platform with no colour emoji
font measures the glyph at nothing, and a small empty square on an invoice reads as an image that
failed to load, so the design falls back to initials alone.

## 4. The 129 industry icons do not exist

The approved design's note says the trade step is earned because *"hamare 129 industry icons pehle
se isi hisab se rakhe hain"*. **Searched on 2026-09-25 across `Webinvotick`, `invoice-kmp-app` and
the project memory: there is no such set.** The app ships four drawables, none of them a trade icon,
and no list of 129 anything appears anywhere. Nothing in this build claims that number.

So the step was made to earn its place from what we **do** have. Each trade carries:

- a **glyph**, drawn into the generated mark;
- a **template id** — one of the ten real invoice designs this repo already ships — so the paper
  looks like the trade's paper without anybody opening the template picker.

If the 129 icons turn up, `industries.ts` is where they land and the step does not change shape.

## 5. Events — parameters, never new names

**No new event name was added.** The whole onboarding is values on `free_invoice_step_reached`'s
existing `step` parameter, which is what makes "where do people leave the onboarding" a single
query the day after this ships rather than an OR across eleven counters (§1.1).

```
free_invoice_tool_opened   {method: cta_press}
free_invoice_step_reached  {step: slide_2 | slide_3 | business | industry | logo_upload
                                  | logo_made | ready | home | client | items | done}
free_invoice_logo_choice   {choice: kept | change_opened | skipped | regenerated}
free_invoice_completed     {... , industry: <trade id>}
```

- **`slide_1` is deliberately not a value.** Reaching the first screen *is* the tool opening and
  already has a row; two names for one moment is one press counted twice (§1.11).
- **`business` is now a value, and it used not to be.** It was excluded for exactly the `slide_1`
  reason until the slides went in front of it. Rows from before this deploy therefore never carry
  it — absent means "this visitor never saw that flow", not "they did not reach it". **Split any
  funnel spanning this deploy by date.**
- **The "One moment…" screen has no value either**: it appears only when the local read is slow
  enough to see, so a missing row would mean either "fast" or "they left" — opposite facts.
- **`regenerated`** is new on `free_invoice_logo_choice`; `kept` and `skipped` became real presses
  again, having been kept in the code space through the one release where nothing sent them (0166),
  which is why that history is still readable (§1.8).
- **`industry` on `free_invoice_completed`** answers *which trades finish an invoice* without a
  join. Its value space is written out in `events.ts` so that module stays free of runtime imports,
  and `industries.test.ts` asserts the two lists are identical — calibrated by renaming one id and
  watching it go red.

**A hole found by measuring, not by reading.** The hand-over from the onboarding opened the invoice
screen directly at the client step, so `step_reached step=client` never fired: "reached the client
step" would have read **zero** while everybody was reaching it, and the largest drop in the funnel
would have been an artefact of the hand-over. The screen now reports the step it opens on.

## 6. What the design draws and this build does not

Named here so each is a choice the owner can overrule by looking, not an oversight:

- **No PRO crown and no six-tab bar** on the invoices home. They are the app's chrome: on the web
  there is no Estimates, Clients, Items, Reports or Settings screen to reach, and **a crown that
  opens nothing would be a gate we invented** — the one thing this work was told not to do.
- **No paywall.** The mockup draws the *moment* and says in the frame that its content, price and
  placement are the owner's. Nothing here adds, moves, weakens or removes a gate.
- **No ad and no space kept for one**, per the owner on 2026-09-25: no AdSense approval, so the web
  tool cannot carry ads at all.

## 7. Two departures the measurements forced

Both are the approved design being **right** and my first build being wrong:

1. **Continue floats above the trade list.** The design's own note says theirs floats
   (*"Continue list ke upar tairta hai"*). I built it inline; at 375×400 with the keyboard open it
   measured **480–528 against a 400 px viewport** — entirely below the fold, so the only way past 37
   trades was to scroll through all of them. It is now sticky, measured at **342–390, visible**.
2. **Skip rides with Continue.** Left in the page above the floating bar it measured off screen, so
   the one answer other than "yes" was the one you could not see. Both answers to a question have to
   be reachable at the moment it is asked.

The wizard banner and the slide artwork also give up their height below 620 px, which is the design's
own instruction (*"tasveer ki patti apni jagah chhor deti hai"*) — measured at **76 px** with the
keyboard open, with the field, the help line and Continue all visible.

## 8. A correction to 0166

**0166's commit message and report claimed `LandingExperience.reveal()` had been moved to the
`flushSync` pattern, and it had not.** A script that edited that file asserted after mutating and
wrote only at the end, so a failed assert on an unrelated paragraph discarded every change — the
doc comment landed through a separate edit and the code did not. The same trap cost two more
rounds while building this.

Consequences, both now fixed here:

- `reveal()` still focused from an effect. It worked (React flushes discrete events synchronously)
  but never got the iOS guarantee the comment claimed.
- **`hashOpen` tested `hash === "#create"` while the comment beside it said `startsWith`** — so a
  reload or a shared link on `#create-client` rendered the hero instead of the tool.

## 9. Verified

- **Focus carries inside the gesture**, measured on the built app: business field focused on
  arrival, Enter → the trade search, Enter → the item description, Enter → the price.
- **Back means one step back** across the whole flow, including over the hand-over: the onboarding
  and the invoice screen each own their own hashes and neither answers the other's entries.
- **The mark uses the typed name.** "Northgate Coffee Roasters" typed, "Northgate Coffee Roasters"
  under the mark, drawn as a data URL.
- **Stress**: 320×667 and 375×400, 1× and 1.5× font, LTR and RTL, at every wizard step and walking
  Back through all of them — `scrollWidth == clientWidth` everywhere and nothing drawn outside its
  box, with the detector calibrated by displacing an element on purpose and watching it fire.
- **44 unit tests pass**, up from 34. The new drift test was calibrated red.
- `tsc` clean; eslint at the repo's pre-existing baseline (6 errors, 4 warnings, none in new files);
  `next build` keeps **`○ /`** statically prerendered.

## 10. Rejected

- **A "skip setup" escape.** §1.
- **A PRO crown, tabs, or any other control with no destination.** §6.
- **Drawing the industry step from a 129-icon set.** It does not exist. §4.
- **A new event per onboarding screen.** §5.
- **Reading the business name back from anywhere but the field it was typed in.** §3.
- **A second `useFreeInvoice()` for the onboarding** — two debounced autosaves over one IndexedDB
  row and every funnel event twice, the danger 0165 named arriving by a new road.
