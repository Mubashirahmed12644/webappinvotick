# 0151 — A premium account's footer is the business's own, in the Invotick footer's slots

**Date:** 2026-09-21
**Status:** **DECIDED by the owner, 2026-09-21.** Built on branches for **1.4.9**; not merged, not deployed. The web
deploys with the 1.4.9 release.
**Tier:** Tier 3 (monetisation: the Remove button leads to the paywall; premium: the Edit sheet). Behind the Remote
Config switch `own_footer_enabled`.
**Builds on:** [0147](0147-a-premium-account-s-invoice-carries-no-invotick-footer.md) (premium hides the Invotick
footer). 0147's premium rule is unchanged; this decides what goes in the band instead of nothing.

## What the owner decided

1. **The footer's layout never changes.** The free footer stays pixel-identical. For a premium account each Invotick
   item is replaced in the same slot by the business's own:

   | Invotick slot | Business slot |
   |---|---|
   | Invotick logo tile | the business logo; without one, the name's initials on the same tile |
   | "Invoice generated using Invotick" | the business's message, default "Thank you for your business!" |
   | the tagline | the business name, and its address if it has one |
   | "Scan to download Invotick" | "Contact us" |
   | the Invotick link | phone · email from the business profile |
   | the Invotick QR | the business's QR (WhatsApp or website); none = the tile slot stays empty |

2. **A small close (×) button on the footer, in the app's invoice preview only** — never in the shared PDF, the image
   or the link.
   - Free: a round grey × with a "Remove" pill at the band's top-right corner, 48dp to the finger. It opens the app's
     existing paywall.
   - Premium: "Edit" (pencil) instead. It opens a sheet: remove the whole footer, or switch each slot on and off, edit
     the message, the contact line and the QR target, use or hide the logo, with a live preview.
3. **The same footer on the phone, the offline and online HTML and the `/i/{token}` page**, with no schema change if
   one can be avoided.

## The rule

- **Which footer:** free → the Invotick footer, unchanged. Premium with its own → that, in the same band. Premium
  without one (a 1.4.8 snapshot, the owner removed it, or the switch is off) → none, as 0147.
- **The phone resolves every slot**; the renderers draw what they are given and derive nothing. A slot with nothing true
  to show is drawn **empty, its space kept**, so the band never reflows.
- **The choices belong to the business**, not to one invoice: saved once, they reach every document of that business
  from then on. The content (name, address, phone, email, website, logo) is read from the business profile each time,
  so a profile edit reaches the footer without the sheet.
- **A WhatsApp QR needs a number dialable from abroad.** A local "0300…" gets its country code from the business's
  country, else from the phone's region; with neither it is left out, never guessed. The sheet says why.
- **A shared link follows its owner** (0147 rule 4, unchanged): documents carry the resolved footer even while free,
  and it is drawn only once the Invotick footer is off — so a free-era link shows the owner's own footer after the
  server says the owner is premium.

## Where the data lives — no schema change

- **The document:** `ownFooter` on the snapshot (`InvoiceSnapshot` app-side == `InvoiceRenderData` web-side, field for
  field) and on the native `InvoiceData`. The backend stores the snapshot as opaque JSON, so **no server change at
  all**. The logo is not copied: `showLogo` points at the business logo the snapshot already carries. The QR is its
  target text; each surface draws the code (SVG on the web, qrose natively).
- **The choices:** one JSON value in the phone's settings store (`own_footer_settings`, business id → choices), read
  at app start by `AppViewModel` into `OwnFooterStore` and written back on Save. The two factories every document
  passes through (`buildInvoiceSnapshot`, `createInvoiceDataFromState`) read it by default, as 0147's holder is read.
- **What does not follow the account to a second phone:** the choices. There the footer is built from the business
  profile's defaults, which do sync. Carrying the choices across phones needs a server column or table — **a
  migration, so the owner's decision.** Not built.

## How it is built

**Web** — `feat/premium-own-footer` (`d3479db`) from `gitlab/main`, and the same commit on `renderer/149-own-footer`
(`54379c0`, from
`renderer/148-bundle-without-premium-footer`, which rebuilds 1.4.8's bundle byte for byte) for the app's offline
bundle:
- `footerMode()` and the `OwnFooter` type in `src/lib/invotick-footer.ts`; `InvoiceRenderData.ownFooter`.
- `InvoiceFooter` takes `own`: same containers, sizes and colours; only slot content changes. A check pins the free
  footer's markup byte-identical to 1.4.8's.
- `QrSvg`: the QR from its text, as SVG.
- `footerControl`: the preview's Remove / Edit button, passed only by the offline bundle when the app asks
  (`__setInvoice(json, opts)` / `__setTranslatedInvoice(json, opts)`); a press is reported as
  `AndroidStamp.onFooterAction(kind)`. With no band (footer removed) the Edit button still shows where the band's corner
  would be, or the footer could never be brought back.
- "Contact us" is the label `footerContact`, in the 24 translated languages.

**App** — `VC_108_VN_149` (`805bf792`), bundle sha1 `09169443`:
- `core/common` `footer/`: `OwnFooter`, `OwnFooterSettings`, `OwnFooterRules` (the slot mapping and fallbacks),
  `OwnFooterStore` (holder + switch).
- `SenderInfo` gains `businessId`, `website`, `country`, set where it is built from a business (6 places).
- Native renderer: `drawOwnFooter` beside each of the 6 `drawPromotionalFooter` calls (common, Android ×3, iOS ×2),
  same geometry, QR by qrose.
- Preview: `ownFooterPreviewHooks` on the three HTML previews (create sheet, Invoice Preview, Invoice Created).
  `OwnFooterSheet` is the editor; its live band is drawn by Compose in the document's proportions.
- Remote Config `own_footer_enabled` (default on), Android and iOS.
- Analytics: taps `invoice_preview_footer_remove` / `_edit` (auto-captured ids, screen-qualified), and the sheet's
  controls `own_footer_*`. No coded event.

## Tests

- Web: `node scripts/checks/run-own-footer-check.mjs` — 27 checks (slots, fallbacks, the switch, removal, the owner
  rule, the button's 48dp target, never on the share page, the free footer's markup identical to 1.4.8's).
  `run-premium-footer-check.mjs` 8/8. `npm run build` green.
- App: `OwnFooterRulesTest` (13) and `PremiumDocumentCarriesItsOwnFooterTest` (6; 5 red with the rule removed);
  `PremiumDocumentHasNoInvotickFooterTest` (5) still green. `:composeApp:assembleDebug` and the iOS simulator build
  green.

## Limits, said plainly

- **Old links are frozen** (invariant 4): a premium owner's link shared from 1.4.8 carries no `ownFooter` and stays
  footerless until re-shared from 1.4.9.
- **The choices are per phone** (above).
- **Estimates** carry the owner's footer, but the Edit/Remove button is on the invoice previews only, as asked.
- **Attribution:** the paywall takes no source, so a purchase cannot yet be tied to the Remove button. Its
  click-through (taps ÷ the preview's views of free users) can be read; conversion needs a paywall `source`
  parameter — a question for the user-journey and billing owners.
- The native preview mode (debug only) and a native PDF draw the same slots with the same geometry; their QR comes from
  a different encoder than the web's, so the modules can differ while both scan to the same target.

## Rejected

- **The first "cards" design.** The owner rejected it because it did not match the current footer. The footer's
  layout stays; only what sits in each slot changes.
- **A server column or table for the choices.** A migration, and not needed for the four surfaces to agree — the
  snapshot carries the resolved footer. Left as the owner's decision if the choices must follow the account.
- **A per-invoice copy in the presentation JSON.** The owner described a business's footer, set once; a per-invoice
  copy would make old and new invoices of one business disagree, and presentation JSON does not reach the server
  either.
- **The QR as an image in the snapshot.** Base64 in the snapshot breaks invariant 7 and costs storage per share.
- **A new paywall for Remove.** The existing one is reused, as asked.
- **The button inside the document** (in the snapshot or the share page). It must never reach a client; it travels
  beside the document, and only the app's preview asks for it.
- **Guessing a country code** for a local number. A QR that opens a stranger's WhatsApp is worse than an empty tile.
- **Rebuilding the offline bundle from web `main`** — same reason as 0147: `main` lacks render changes 1.4.8 ships.
