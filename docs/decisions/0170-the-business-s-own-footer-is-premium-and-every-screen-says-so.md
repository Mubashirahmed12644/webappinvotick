# 0170 — The business's own footer is a Premium feature, and every screen says the same thing about it

**Date:** 2026-09-25
**Status:** **DECIDED by the owner, 2026-09-25.** The gate was already built (see "What was already true");
this decision records the tier, and fixes the places that described the feature wrongly. Web and app changes are
on branches. **Nothing is deployed and no release is built** — both wait on the owner's word.
**Tier:** Tier 3 for monetisation (what premium sells), Tier 1 for trust (G3) — every sentence quoted here is one
a customer reads before paying.
**Owner:** the billing agent (0051). This is the "every feature carries its own free/premium decision" practice in
`.claude/agents/billing.md`, applied to 0151.
**Builds on:** [0147](0147-a-premium-account-s-invoice-carries-no-invotick-footer.md) (premium hides the Invotick
footer), [0151](0151-a-premium-footer-is-the-business-s-own-in-the-same-slots.md) (what goes in the band instead),
[0152](0152-a-business-s-footer-choices-follow-the-business.md) (the choices follow the business).

## The owner's words

> "apna footer premium main mily ga, aur is per jhoot bilkul nhi hona chahye — har jagha sach ho."

and, the same day, widened:

> "jhoot ko kisi bhi mamly main nahi hona chahye — jo aik device per hy wo sab device per ho, chahye premium hy
> yaan non premium hy."

Written down as the standing rule `no-false-claim-anywhere` in memory.

## What was already true — checked, not assumed

This was written expecting to find an ungated feature. It is not one. **The premium gate on the own footer
already exists on every surface, and it is already per account, not per install.**

1. **One premium answer feeds every document.** `AppViewModel.observePremiumStatus()`
   (`composeApp/.../AppViewModel.kt:437-442`) collects `ObservePremiumUseCase` and pushes it into
   `InvotickFooter.onPremiumChanged`. `ObservePremiumUseCase`
   (`domain/.../usecase/ObservePremiumUseCase.kt:6-8`) is `PremiumRepository.isPremium()`, which is
   `shownPremium(...)` (`core/premium/.../repository/PremiumRepositoryImpl.kt:37-38`) — the store's word on this
   phone **or** the account's dated grant from our server (billing rules 1 and 9). **So it is the account's
   premium, on every device of it.** That is the owner's second sentence, already satisfied.
2. **The two document factories stamp the flag by default**, so none of their 22 callers can forget it
   (0147): `TemplateModule.createInvoiceDataFromState` sets `InvoiceData.showInvotickFooter`, and
   `buildInvoiceSnapshot` sets `InvoiceSnapshot.hideInvotickFooter`.
3. **Every renderer draws the own footer only when the Invotick footer is off**, which only a premium
   document is:
   - native canvas (the PDF, the share images, the native preview) —
     `invoicePdf/.../SharedComponents.kt:676-698`, `PdfGenerator.android.kt:455-478` and `:806`, `:1087`,
     `PdfGenerator.ios.kt:215`, `:810`: `if (showInvotickFooter) drawPromotionalFooter(...) else ownFooter?…`;
   - web / offline bundle / share page — `footerMode()` in `src/lib/invotick-footer.ts:75-80` returns `"own"`
     **only** when `showsInvotickFooter(data)` is false, and `ownFooterProps` returns `{}` otherwise
     (`src/components/invoice/InvoiceDocument.tsx:483-486`).
4. **The editor is gated too.** `ownFooterPreviewHooks` (`.../footer/OwnFooterPreviewHooks.kt:54-84`): a free
   account gets a round × whose press opens the existing paywall; only `isPremium` opens `OwnFooterSheet`.
5. **The share link asks the server about the owner, live.** `SharedInvoiceService.showsInvotickFooter()`
   (`invotick-apis` `src/main/.../service/SharedInvoiceService.kt:612-613`) answers from `PremiumUserIds`, the
   in-memory set of premium **account ids** rebuilt from `entitlement` every five minutes.
   **Proven live in production, 2026-09-25:** `GET https://stage.invotick.com/v2/shared-invoice/{token}` returns
   the key `showInvotickFooter`.

So this decision does not create the gate. It records it, and it repairs what the gate was never told to the user.

## The rule

1. **The business's own footer is Premium.** A free account's document carries the Invotick footer, unchanged,
   everywhere it is drawn. A premium account's carries the business's own in the same band (0151), or none if it
   has none (0147).
2. **The tier is the account's, never the install's.** It is `shownPremium`, the same answer that stops ads. One
   phone premium means every phone of that account premium, and the share link asks about the account.
3. **What premium gives is claimed where premium is sold.** The paywall now names the own footer. A premium
   benefit the paywall does not name is a benefit we are paid for by accident — which is literally how the first
   customer's purchase happened (`first-premium-user-2026-09-10.md`).
4. **No sentence about this feature may be true on one screen and false on another.** Every place that described
   it is listed below, with what it says now.

## What a free user still gets — wording that stays true after the gate

These sentences are true today and stay true after 1.4.9 ships. They are the words to use anywhere the free tier
is described:

- **Every invoice and estimate is free to make, save, share and download.** Nothing about the document is
  withheld — not a template, not the logo, not the signature, the stamp, the colours, the currency or the
  translation.
- **The footer band is always there and always full.** A free document ends with the Invotick footer; a premium
  one ends with the business's own. Neither ends with a gap. **Nothing is silently degraded**, which is the line
  between a paywall and a defect (billing practice rule 4).
- **Nothing a free user already had was taken away.** The own footer is new in 1.4.9; free users keep exactly the
  footer they have always had (billing practice rule 5).
- **The free web tool at invotick.com needs no account and costs nothing**, and its PDF carries the Invotick line
  at the bottom.

## Every place that describes this feature, and whether it is true

Checked 2026-09-25. "Live" means what a user can read today.

| Where | What it said | Verdict | Now |
|---|---|---|---|
| Paywall headline, `PremiumPaywallSheet.kt:455` | "Remove the ads and the Invotick footer." | **True**, since 1.4.8 (vc107) | unchanged |
| Paywall card, `:538-540` | "Clean PDF — No Invotick footer, on new and old share links" | **True** | unchanged |
| Paywall — the own footer | **nothing at all** | **Omission**: premium delivers it and the sheet never said so | a third card, "Your Footer — Your logo, contact details and QR code in place of ours", hidden when `own_footer_enabled` is off |
| Paywall "FREE FOR EVERYONE" grid, `:959-975` | ledgers, businesses, signatures, stamps, templates, analytics, currencies, sync | **True** — all free | unchanged |
| Footer sheet, `OwnFooterSheet.kt:105-235` | "Your footer", "Show a footer", … | **True**, premium-only screen | unchanged |
| The free preview's × button | accessible name "Remove footer", opens the paywall | **True** | unchanged |
| `/terms`, `src/app/terms/page.tsx` | "Today its main benefit is removing ads." | **False since 2026-09-21** — 1.4.8 and the live server also take the footer off, including old links | rewritten; the own-footer clause is held back until 1.4.9 is released |
| `/privacy-policy`, `:259` | "Premium removes ads from the app." | **True**, and not a claim about the footer | unchanged |
| Landing hero, `LandingExperience.tsx:215` | "No account, no watermark, nothing to install." | **False** — see below | "No account, no cost, nothing to install." |
| Landing FAQ, `faq-data.ts:19` | "a clean, print-ready PDF … no watermark" | **False** — see below | names the Invotick line instead of denying it |
| Landing FAQ, `:11` | "100% free" | **True** | unchanged |
| `/i/{token}` share page | no claim about footers | — | unchanged |
| Play Store and App Store listings | **could not be checked** — they are not in any repo; they live in Play Console and App Store Connect | open | the owner's screens |
| `invoice-kmp-app/docs/monetization-strategy.md:39` | "Watermark-free PDF export — watch an ad for a clean export" | **Not true of any build**; internal plan doc, no user reads it | left; flagged |

### The landing's "no watermark", proven false

The free tool's PDF is a bitmap capture of the very DOM the preview shows (`src/lib/free-invoice/pdf.ts:7-27`),
and `toRenderData` (`src/lib/free-invoice/adapter.ts:68-125`) never sets `hideInvotickFooter`, so
`showsInvotickFooter()` is true and the band is drawn. Rendered with `react-dom/server` on 2026-09-25, the free
tool's markup contains "Invoice generated using Invotick", the `gw.invotick.com` link and the "Scan to download"
QR line — `scripts/checks/free-tool-footer.check.tsx`, 4/4.

The project has already ruled that this band is what "watermark" means to a user: the paywall's own comment
(`PremiumPaywallSheet.kt:531-536`) records moving "Watermark-Free PDF" out of the free list on the owner's word,
because a free PDF carries exactly this. So the website was promising for free the thing the app sells.

**This is not a behaviour change.** The footer stays on the free tool — it is the growth surface (G2). Only the
sentence changed.

## The question this decision does **not** close

**How a share link learns that its owner is premium.** It is already answered in code (0147 rule 4), and the
answer is a hybrid, but it is worth stating because each pure option carries a visible lie:

- **Frozen at share time only.** A link sent while free keeps the Invotick footer for ever, so a user who pays
  on Monday still sees our branding on Tuesday's client. That is the thing 0147 was raised to remove.
- **Live lookup only.** Every open of an already-sent invoice re-reads the sender's state, so a lapsed
  subscription would put our branding back onto a document the client already has — a sent invoice changing
  under the client's eyes.

**What is built, and what is recommended to keep:** the Invotick footer is taken off **live**, by the account
(`PremiumUserIds`, no query, no store call), while the **content** of the own footer is **frozen** in the
snapshot at share time. `withOwnersFooterRule` acts only on an explicit `false`, so the rule can only ever
*remove* our branding and never put it back. 0151 resolves the own footer into every snapshot — free ones too —
precisely so that a link shared while free shows the owner's own footer the moment the server says they are
premium, without re-sharing.

Its two admitted costs, both already in 0147/0151:
- a link shared from 1.4.8 or older carries no `ownFooter`, so a premium owner's old link shows **no** footer
  rather than theirs, until it is re-shared;
- a lapsed premium's old links keep the own footer they were shared with (0147 rules 5 and 6). New documents
  carry the Invotick footer again.

## Rejected

- **Building a new premium gate for the own footer.** There was nothing to build: the gate exists on all four
  surfaces and is already the account's, not the install's. A second gate would be a second place to get it
  wrong.
- **A per-device gate.** The owner's own sentence forbids it: what is true on one device is true on all.
- **Deciding the share link by the snapshot alone,** or **by a live lookup alone** — each one's failure is a
  visible lie (above).
- **Asking Google or Apple on the public share read** — a paid call per crawler hit (0147).
- **Taking the footer off the free web tool** to make "no watermark" true. That removes the growth surface (G2)
  and weakens monetisation, which AGENTS.md §1 forbids proposing. The sentence was the thing that was wrong.
- **Putting the own-footer clause into `/terms` now.** It ships with 1.4.9 and 1.4.9 is not released; writing it
  today would be the exact fault this decision exists to stop.
- **A new paywall for the footer.** The existing one is reused (0151).

## Open, for the owner

1. **The store listings** (Play Console, App Store Connect) could not be read from here. They are the last place
   a claim about premium can still be wrong.
2. **A free user's snapshot carries the resolved own footer** even though nothing draws it — measured on
   production 2026-09-25: of 1,312 share snapshots in 30 days, 3 carry `ownFooter`, and 2 of those 3 are free
   (`hideInvotickFooter: false`), one of them carrying a `contactLine`. So a business's phone and email travel
   inside a public share link's JSON without being shown. Harmless where the invoice already prints them; worth
   a decision if it should be stripped for free owners.
3. **Attribution.** The paywall still takes no `source` for the footer's × button, so a purchase cannot be tied
   to it (0151's own limit).
