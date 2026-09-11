# Decision log (ADRs)

One file per decision. **Read this index before proposing a plan** — the most common wrong turn is
re-proposing an option that was already rejected.

## Format

```markdown
# NNNN — <short title>
- **Date:** YYYY-MM-DD
- **Status:** decided | superseded by NNNN | reversed
- **Decision:** one sentence, imperative.
- **Why:** the reason in the user's terms.
- **Rejected:** the options we did NOT take, and why.
- **Consequences:** what this forces us to do / stop doing.
```

Numbering: next free number, zero-padded to 4.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-one-html-render-engine.md) | One HTML render engine everywhere; retire native Canvas | decided |
| [0002](0002-presentation-json-per-invoice.md) | Invoice presentation = one JSON per invoice, asset refs | decided |
| [0003](0003-currency-stored-on-invoice.md) | Store currency on the invoice row; client-locked | decided |
| [0004](0004-share-link-is-html-not-image.md) | Share link renders HTML from snapshot, not an uploaded image | decided |
| [0005](0005-edit-mints-new-share-token.md) | Editing a shared invoice mints a new token and revokes the old | decided |
| [0006](0006-g1-real-invoice-metric.md) | G1 "real invoice" = confirmed share or payment; repeat use as support | decided |
| [0007](0007-first-run-currency-ladder.md) | First currency: IP → device region → unambiguous language → USD | decided |
| [0008](0008-adaptive-layout-roadmap.md) | Adaptive layout in 5 phases, applied directly; RTL ships separately | decided |
| [0009](0009-currency-backfill-measured.md) | 2,717 of 5,004 invoices still carry the wrong currency — the backfill's WHERE clause could not see them | measured |
| [0010](0010-health-centre-one-dashboard.md) | Everything that fails silently gets a check in one place; a new check is a `@Component`, never a new page | accepted |
| [0011](0011-discard-dialog-only-for-documents.md) | Small entity forms lose the discard dialog and keep a draft; invoice/estimate keep it — the six copies are two different interactions | accepted |
| [0012](0012-no-continue-editing-dialog-on-entry.md) | A draft is resumed, not negotiated — no "continue editing?" dialog on entry | accepted |
| [0013](0013-logout-clears-session-and-purges-when-settled.md) | Logout clears the session; the account's data is deleted only once it is settled | accepted |
| [0014](0014-discard-dialog-needs-document-content.md) | A business and a client are not work worth a dialog | accepted |
| [0015](0015-estimate-draft-rules-copied-only-where-safe.md) | Estimate draft rules follow the invoice's — but only four of five | accepted |
| [0016](0016-one-bottom-sheet-standard.md) | One bottom sheet, and it answers when you pull it | accepted, shipped |
| [0017](0017-shared-pdf-android-installs-others-download.md) | On the shared link, Android installs the app for a PDF; everyone else downloads | accepted, built |
| [0018](0018-the-shared-image-is-gone-html-is-the-only-render.md) | The shared invoice image is gone; HTML is the only render | accepted, built |
| [0019](0019-two-tags-money-and-delivery-are-not-one-axis.md) | An invoice card carries two tags — money and delivery are not one axis | superseded by 0020 |
| [0020](0020-the-payment-tag-goes-the-card-says-it-in-words.md) | The payment tag goes; the card says it in words | accepted, built |
| [0021](0021-dynamic-colour-is-offered-never-assumed.md) | Dynamic colour is offered, never assumed; it stops at the document | accepted, built |
| [0022](0022-edge-to-edge-verified-for-targetsdk-36.md) | Edge-to-edge verified for targetSdk 36 — 17 surfaces measured, no code needed |
| [0024](0024-a-double-tap-is-stopped-at-the-button-not-counted-later.md) | A double tap is stopped at the button, not counted around later | decided |
| [0025](0025-voice-input-is-offered-only-where-the-device-can-do-it.md) | Voice input is offered only where the device can do it | decided |
| [0026](0026-a-session-is-renewed-before-it-dies-never-revived-after.md) | A session is renewed before it dies, never revived after | decided, implemented |
| [0027](0027-a-first-time-user-is-a-device.md) | A first-time user is a device, and the journey is counted per device | decided, implemented |
| [0028](0028-the-invotick-id-is-part-of-the-account.md) | The Invotick ID is minted with the account, not on demand (reverses 2026-07-09 lazy) | decided, implemented |
| [0029](0029-a-sync-failure-is-an-attempt-the-server-refused.md) | A reported sync failure is an attempt the server refused | decided, in app branch |
| [0030](0030-every-device-that-stopped-has-a-reason.md) | Every device that stopped on the journey has exactly one reason | decided, implemented |
| [0031](0031-the-splash-shows-the-app-while-the-gate-holds.md) | The splash shows the app taking shape while the ad gate holds; gate timing untouched | remedy reversed by 0038 (diagnosis stands) |
| [0032](0032-dismissing-the-save-gate-keeps-the-invoice-as-a-draft.md) | Dismissing the Save gate keeps the invoice as a draft | decided, in app branch |
| [0033](0033-no-banner-under-the-first-open-onboarding-overlay.md) | No banner under the first-open onboarding overlay (owner's call; measure impressions alongside) | decided, in app branch |
| [0034](0034-a-page-costs-what-it-shows.md) | A page costs what it shows, not what the database holds | decided, being applied |
| [0037](0037-the-ui-layer-owns-the-press.md) | The UI layer owns the press; the coded `trackClick` twin goes | decided, in app branch |
| [0038](0038-the-hold-shows-one-branded-loader-not-a-picture-of-the-screen.md) | The hold shows one branded loader, not a picture of the screen it is heading to (reverses 0031's remedy) | decided, in app branch |
| [0039](0039-language-is-read-from-the-session-not-re-sent-per-event.md) | Language is read from the session, not re-sent per event; the session row is written from any batch | decided, in backend tree |
| [0040](0040-the-system-splash-draws-the-mark-we-are-about-to-draw.md) | The system splash draws the mark we are about to draw; we cannot paint sooner than the platform, only paint the same thing | decided, in app branch |
| [0041](0041-premium-is-a-date-on-the-device-refreshed-daily.md) | Premium is a date on the device, not a flag, bounded by both the plan's expiry and a 24h verification window; the server is asked daily after the splash, and silence never revokes | **planned, awaiting approval** |
| [0042](0042-the-server-owns-the-version-and-the-device-merges.md) | The server owns the version and the device merges without asking: six push answers, delete carries and bumps its version, derived money fields are recomputed not merged (extends 0036, which has no row for the case that will actually arrive) | **decided, being built** |
| [0043](0043-an-ad-failure-is-named-in-the-sdks-own-words.md) | An ad failure is named in the SDK's own words, on the event that already exists: `reason` beside the untouched `code` because the load and show tables overlap, plus `error_domain`, one cause level, the missing `ad_request_id`, and `path` because `placement` is constant | decided, in app branch |
| [0044](0044-an-install-belongs-to-a-tag-not-to-a-link.md) | An install belongs to a tag, not to a link: the UTM tab joins the registry to `install_referrer` by exact equality on all three UTM values, a zero prints as `0`, and traffic matching no link of ours is listed uncredited | decided, built |
| [0045](0045-the-share-link-page-reports-its-own-journey.md) | The share-link page reports its own journey: six names into `/v2/analytics/track` as `platform=Web`, the app's own names where the action is the app's, `viewer_platform` not `platform`, the version floor exempted for Web, and no App Store link because there is no App Store app | decided, built, deployed 2026-09-09 |
| [0046](0046-a-sent-link-retires-only-when-its-replacement-is-sent.md) | A sent share link retires only when its replacement is confirmed sent: `create()` never revokes a sent token, `markShared()` does; an unsent token is still replaced at once; snapshots compare as content, with embedded images masked | decided, built |
| [0047](0047-plays-answer-decides-premium-on-a-device.md) | Play's answer decides premium on a device, guest or signed in: ads stop the moment Play reports a purchase, another account's purchase still makes this phone premium, "not premium" needs Play's confirmation before any ad is shown, requests never wait, and the splash waits at most 1.5 s from its start | decided, built (app 1.4.6) |
| [0048](0048-the-paywall-says-what-google-charges.md) | What the paywall says is what Google charges — price, period and saving from the offer actually bought, never a product's name; a refusal is final only when Google gives it (400), "could not ask" is 503; the server keeps tokens and every restore answer; an admin can defer one customer's renewal | decided, built (app 1.4.7) |
