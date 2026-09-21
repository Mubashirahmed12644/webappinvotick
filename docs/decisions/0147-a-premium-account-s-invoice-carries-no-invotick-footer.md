# 0147 — A premium account's invoice carries no Invotick footer, anywhere

**Date:** 2026-09-21
**Status:** **DECIDED by the owner, 2026-09-21 — urgent.**
- Server and web are built, pushed, and being deployed on the same day.
- The app half ships as **1.4.8** (versionCode 107), cut from the live base `VC_102_VN_146`.
**Tier:** Tier 1 for billing, because it is a promise made to people who paid. Tier 3 for monetisation, because the
footer is the growth surface (G2).
**Owner:** the billing agent (0051). This is rule 14 of `.claude/agents/billing.md`.

## The owner's words

> "kia premium user ko invoice ky bottom per jo Invotick ka footer hy usko khatam nahi kia jata? ager nahi kia jata
> to isko foran khatam ker ky ek urgent update deni hy."

## What was true

- The footer (logo, "generated with…", the `gw.invotick.com/r/2/RefCode` link and the QR code) was drawn on every
  page for everybody. No premium condition existed anywhere.
- It came from three places:
  - the web's `InvoiceFooter` in `A4PagedFrame`. This covers the app's offline bundle, the online render, the share
    page `/i/{token}` and its print-to-PDF;
  - the native renderer's `drawPromotionalFooter`. This covers the PDF the app saves and shares (`generateAndSavePdf`),
    the share images (`generateAllPageBitmaps`, `generateBitmapList`) and the native preview
    (`InvoiceCanvasWithPagination`), on Android and iOS;
  - the offline bundle's placeholder page. This one was already hidden for premium with `?footer=0`.
- So until 1.4.8, a paying customer's PDF and every link they sent still carried our branding.

## The rule

1. **A document made by a premium account carries no Invotick footer.** This covers the in-app preview, the PDF,
   the share image, the offline and online HTML, the share page and its PDF. "Page X of Y" stays.
2. **Free users keep it unchanged.** It is the growth surface: it tells their clients where the invoice was made (G2).
3. **Premium means what the rest of the app already obeys.** That is `ObservePremiumUseCase`, which reads
   `shownPremium`: Play's (or StoreKit's) word on this phone, or else the account's dated grant (billing rules 1 and 9).
   The kill switch `account_premium_enabled` applies as it does to ads.
4. **A shared link follows its owner now, not the day it was shared.**
   - The server answers `showInvotickFooter: false` when the share's owner is premium right now.
   - The share page, the snapshot route and the app's receiver screen then draw the document without the footer.
   - So links sent before the owner paid lose it too.
5. **Either source is enough to take the footer off,** and neither ever puts it back. The two sources are the flag in
   the snapshot and the server's answer about the owner.
6. **A lapsed premium's new documents carry the footer again.** Its old snapshots keep whatever they were made with.

## How it is built

**Backend** (`invotick-apis` `fix/share-page-knows-owner-is-premium`, `7024c04`):
- `GET /v2/shared-invoice/{token}` answers `showInvotickFooter`.
- It reads `PremiumUserIds`, the in-memory set of premium account ids rebuilt from `entitlement` every 5 minutes
  (cap 10,000). A public read therefore adds **zero queries** and never asks Google or Apple.
- A share with no owner keeps the footer.
- No schema change.

**Web** (`Webinvotick` `fix/premium-invoice-has-no-footer`, `3cb90e5`):
- `InvoiceRenderData.hideInvotickFooter`. Absent means false.
- `InvoiceDocument` and `A4PagedFrame` leave the band off. Its space goes back to the content, and the page line stays.
- `withOwnersFooterRule` is applied on `/i/{token}` and on `/api/shared-invoice/{token}/snapshot`.

**App** (`fix/148-premium-invoice-has-no-footer` `32cd9d6d`, inside `hotfix/VC_107_VN_148`):
- `core/common` `InvotickFooter` is fed from `AppViewModel`'s premium observer.
- It is read **by default** in the two factories every document passes through:
  - `TemplateModule.createInvoiceDataFromState`, which has 13 callers. It sets `InvoiceData.showInvotickFooter`.
  - `buildInvoiceSnapshot`, which has 9 callers. It sets `InvoiceSnapshot.hideInvotickFooter`.
- The renderers read the flag on the document, never the holder.
- In the native renderer the footer is simply not drawn. Its reserved band stays blank, so layout and pagination
  of the retiring native renderer are unchanged.
- The receiver screen applies the server's `showInvotickFooter`.
- **The offline bundle** (the Android asset and the iOS resource are identical) is rebuilt from web
  `renderer/148-bundle-without-premium-footer` (`076dee6`).
  - That branch is `8059eb0` plus the footer commit.
  - `8059eb0` rebuilds 1.4.7's shipped bundle **byte for byte**.
  - Web `main` does not. It lacks the M3 contrast change that 1.4.7's bundle carries, so a bundle built from `main`
    would have quietly changed invoice colours in a hotfix.
  - A string-level diff of the old and new bundles shows only minifier renames and the footer logic.

## Tests

- **Backend:** `SharePageFooterFollowsOwnersPremiumTest` (4 tests). 2 failed with the rule removed. The full suite
  passes, 1,323/1,323.
- **Web:** `node scripts/checks/run-premium-footer-check.mjs` (8 checks, rendered with `react-dom/server`). 3 failed
  with the rule removed. `npm run build` passes.
- **App:**
  - `PremiumDocumentHasNoInvotickFooterTest` (5 tests) failed 3 with the rule removed.
  - `SharePageOwnersFooterRuleTest` (5 tests) failed 2 with the rule removed.
  - The iOS target compiles, checked by the pre-push hook.

## Limits, said plainly

- **The share page reads the server's record of premium only.**
  - Suppose a buyer's premium lives only on the phone, because the register never reached the server. Their link
    then shows the footer until the stamped snapshot does the job. That needs 1.4.8 on the sender's phone.
  - Timing: the server's set refreshes every 5 minutes and the web caches the read for 300 s. So after buying, the
    footer can stay on the share page for about 10 minutes.
- **The native PDF keeps the empty band's space.** Reclaiming it means touching the native paginator, which is being
  retired (north star). Not in a hotfix.
- **A receiver's placeholder page** still follows the *viewer's* premium, as before, not the owner's. It is shown for
  a moment before the document arrives.

## The "RefCode" in the footer link

- It is not broken. `RedirectController` answers `/r/2/RefCode` with the Play listing and
  `utm_term=RefCode`.
- It is a literal, not a per-user code. No per-user referral code exists.
- Printing one would put an identifier on every document sent to a stranger. It would also be new G2 work for the
  user-journey agent. That is the owner's call, not part of this hotfix.

## Rejected

- **Hiding the footer only for invoices made after the purchase.** Old links would keep the branding the owner asked
  to remove.
- **Asking Google or Apple on the public share read.** That means a paid call per crawler hit, and a way to spend our
  quota from outside. The in-memory set already holds the answer.
- **A database query per share read.** The page is served to crawlers and fetched twice per open. The set costs
  nothing extra.
- **Threading an `isPremium` argument through all 22 callers.** That leaves 22 places where one missed argument
  brands a paying customer's PDF. A default read in the two factories reaches every one.
- **Rebuilding the offline bundle from web `main`.** It would ship render changes 1.4.7 does not have.
- **Reclaiming the native band's space.** It is layout risk in a retiring renderer.
- **Removing or shrinking the footer for free users.** Monetisation and growth are requirements (AGENTS.md §1).
