# 0169 — The first screen: one account word, no dead button, and the invoice inside the fold

> Numbered 0169 after a sweep of **every** ref (`refs/heads` + `refs/remotes`): 0058–0168 are taken.

- **Date:** 2026-09-25
- **Status:** **built, measured and deployed.** Branch `feat/first-screen` off `main` `de7449c`.
- **Decision:** the landing's first screen stops contradicting itself, stops offering a button that
  cannot be pressed, and gives the space that buys back to the two things worth seeing first — our
  two true facts and the sample invoice.

---

## 1. What changed, and what each one is worth

Measured at 375×812, before on live `de7449c`, after on the built branch.

| | Before | After |
|---|---|---|
| **Account words in the header** | **Two** — "Sign in" *and* "Create account" | **One** — "Sign in" |
| **Dead "App Store — SOON" badge** | Present at 437–469 | **Gone.** One quiet line in the footer |
| **Reason to trust us** | None anywhere on the screen | `4,000+ businesses · 96% never made an account` at 243 |
| **Sample invoice** | 505 → 807, grazing the bottom edge | **367 → 669, fully inside the fold** |
| **Store badges** | 331 → 505, between the button and the invoice | Footer, at 1765 |
| **FAQ** | 959 | 820 — still after the invoice, pushing nothing |

## 2. One account word

The page's own promise, three lines under the header, reads *"No account, no watermark, nothing to
install."* Two account words above that sentence make the screen argue with itself before the
visitor has read any of it. 0165 had already demoted "Create account" from a button to a link,
which fixed its weight but not the contradiction.

Invoice Fly's equivalent screen carries exactly one word — **"Log in"** — and on this they are
right. Ours now carries one.

**Nothing is closed off.** A returning user signs in from here; somebody who decides they want an
account is offered one **after the PDF** (0163), at the moment a reason for it exists. `/signup` is
untouched.

## 3. The dead button

"App Store — SOON" was a full-size badge with a pill, and pressing it did nothing. **A control that
cannot be pressed costs more than the space it takes**: it spends the visitor's belief in every
other button on the screen, including the only one that matters.

It is now a sentence — *"iPhone app coming soon."* — in the footer. Not a badge, not a disabled
button, nothing that can be pressed or focused. **It keeps its `order`**, so on an iPhone it still
comes first; the day `APP_STORE_URL` exists, the real badge renders in exactly that position and
decision **0164's device-aware ordering is untouched**.

## 4. The store badges moved to the footer — and this came from their page, not from me

The owner's screenshot `40-first-screen-scrolled-footer.png` shows Invoice Fly's own layout: the
App Store and Google Play badges sit **at the very bottom**, after *Resources · Pricing · Blog ·
Help Center*, just above the copyright. Above the fold they carry **no store button at all**.

The reason is the one this page is judged on. Its job is to get a stranger into an invoice, and
**every button above the fold that leads somewhere else is a way out of that**. Ours were running
331 → 505 px — 174 px directly between the primary button and the sample invoice.

0165 reasoned that "or get the app" is the second choice this page offers and belongs beside the
first. That reasoning is now superseded by their page and by the measurement: moving the badges
down brought the invoice from *grazing the bottom edge* to **fully inside the fold**.

## 5. The two facts, and the ones we cannot have

Their screen carries **4.8 stars, "125,000 small businesses", and a press band** — The New York
Times, Forbes, TechCrunch. All earned, and **none of it copyable**: Invotick has **no Play rating at
all**, so no number here was invented.

What we do have was already written on the first value slide, where a visitor only reaches it
*after* pressing the button:

- **`4,000+ businesses`**
- **`96% never made an account`**

The second is the one that earns its place. It is not a claim *about* the promise in the sentence
above it — it is **proof of it**.

One line, not a box: at a large font scale a two-column box becomes three lines and pushes the
button down, while a line simply wraps.

## 6. The stale year — theirs, and very nearly ours

Their footer reads **"Copyright © 2024 Invoice Fly"** on a page served in September 2026. On a
product that handles other people's money, a stale year is exactly the kind of small thing a
careful person notices.

**Ours was one deploy away from the same sentence, by a different road.** The year was never
hardcoded — it was `new Date().getFullYear()` — but `/` is **statically prerendered**, so that call
runs once at **build time** and the answer is baked into the HTML. Nothing recomputes it when a
visitor arrives: ship in December and the page says the old year from 1 January until somebody
happens to deploy again.

`FooterYear` now reads the year in the browser through `useSyncExternalStore` — the same pattern
`StoreBadges` uses for the device — with the build year as the server snapshot so the prerendered
HTML and the crawler still see a sensible number.

## 7. First screen vs first screen

| | Invoice Fly | Invotick, after this |
|---|---|---|
| **G1 — reaching a real invoice** | A **sign-in wall** first: Google / Apple / Email rows, with "Start as Guest" as the filled button. | One button, no account. **We win, and it is not close.** |
| **G3 — trust** | 4.8 stars · 125,000 businesses · NYT, Forbes, TechCrunch. | Two true facts and a real invoice. **They are still ahead.** |
| **G2 — reaching the client** | Nothing on this screen. | Nothing on this screen. **Level.** |
| **Product visible** | **None.** Scroll the whole screen — wall, stats, press, footer — and never see an invoice. | A real invoice, now fully inside the fold. **Our single biggest advantage.** |

**Where theirs is still better, plainly:** trust. Stars, a user count and three mastheads are earned
proof that two sentences of ours cannot replace. *"96% never made an account"* supports our promise;
it does not answer *"is this thing any good?"* That is the gap worth the owner's next hour — a real
Play rating, real reviews, real names.

## 8. Checked and left alone

- **The sample invoice** — untouched, and it is what the reclaimed space went to.
- **"Create invoice"** — still the single filled element on the screen.
- **The Play badge's behaviour and 0164's ordering** — untouched; only the address changed.
- **The FAQ** — measured at 820, after the invoice and the privacy line. It pushes nothing
  important down and it earns SEO, so it stays.
- **No ad, no space kept for one. No sign-up before an invoice exists.**

## 9. Verified

- One account word, **zero** "Soon" pills, proof line and CTA and the whole sample invoice all
  inside the fold at 375×812.
- **At a 1.5× root font scale**: no side scroll, nothing drawn outside its box (detector calibrated
  by displacing an element on purpose), CTA still inside the fold at 495–579.
- **The flow behind the screen is unchanged**: CTA → slides → business (focus carries) → trade →
  logo → ready → home → client → items → done, with Back walking one step back and the PDF
  reachable.
- 44/44 tests, `tsc` clean, eslint at the repo baseline, `next build` keeps **`○ /`**.

## 10. Found, not fixed — out of scope

**The public landing has no dark theme.** With the browser set to `prefers-color-scheme: dark` the
page still renders light (`body` background measured `rgb(250,250,250)`). Every colour on it is a
token, so this is a theme that was never defined for these pages rather than anything this change
broke. The dark frame in the mockup shows what it *would* look like; it is not what ships today.

## 11. Rejected

- **Keeping "Create account" anywhere on the first screen.** §2.
- **Making the App Store badge a disabled button.** A disabled button is still announced as a button
  that failed. This is not a control yet, so it is a sentence.
- **A stats box for the two facts.** §5.
- **Copying anything of theirs we have not earned** — a rating, a user count, a masthead. §5.
- **Touching the sample invoice or the FAQ.** §8.
