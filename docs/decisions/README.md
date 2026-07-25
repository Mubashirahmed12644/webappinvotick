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
