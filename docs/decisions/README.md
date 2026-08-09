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
