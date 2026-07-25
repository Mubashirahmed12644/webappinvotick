# 0002 — Invoice presentation = one JSON per invoice

- **Date:** 2026-07
- **Status:** decided — Phase 1 built on `feat/presentation-json-migration`, not released
- **Decision:** Split an invoice into **data** (structured, queryable DB columns — unchanged) and
  **presentation** (one JSON stored on the invoice row: colors, toggles, terms/notes/payment text,
  template, stamp/signature offset+size, image **asset ids**). Every editing flow writes that JSON.
- **Why:** presentation was rebuilt on the fly from scattered fields and never stored, so dragging a
  stamp/signature reverted after reload. One JSON = single source, no drift, no schema change per
  new design element.
- **Rejected:**
  - New DB column per presentation field — endless schema churn and sync work.
  - Storing the JSON on the *template* instead of the invoice — one invoice's drag would change others.
  - Base64 images inside the JSON — bloats the row and the sync payload; use asset refs.
- **Consequences:**
  - Room migration v1→v2 adds a nullable `invoices.presentationJson` (additive, verified on a real device DB).
  - Until the backend gains the column, a registered user's presentation can reset on sync-pull
    (guests, ~96%, unaffected).
  - Pre-release gate: formal `MigrationTestHelper` test + staged rollout.

See `memory/presentation-json-architecture.md`.
