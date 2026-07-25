# 0006 — How a "real-data invoice" (G1) is measured

- **Date:** 2026-07-25
- **Status:** decided — not yet built
- **Decision:** An invoice counts toward G1 when it is **actually sent** — a confirmed share
  (`invoice_shared`) or a payment recorded against it (`payment_added`). A second, supporting
  signal is **repeat use**: the user creates another invoice, or reuses the same business/client.
- **Why:** nobody sends a fake invoice to a real client. It is evidence, not a guess about text,
  and the same signal also feeds G2 (the client loop). Repeat use confirms a real business rather
  than someone trying the app once.
- **Rejected:**
  - **Text-quality scoring** (junk words like "test"/"abc", name length, zero prices) — guesswork,
    misclassifies real users with short names, and means reading what users typed (privacy).
  - **Completeness only** (business + client + 1 item + amount > 0) — "test / test / 100" passes.
  - **Prefill detection** — there is no prefill anywhere in the app, so there is nothing to detect.
    The real enemy is throwaway data, not our template.
- **Consequences:**
  - `invoice_shared` (fires only on a **confirmed** share — the user picks a target app in the OS
    chooser, not on opening the share sheet; tagged with `mode` and `target`) is the primary event.
  - ⚠️ **`invoice_shared` is not live yet** — it exists only on `feat/presentation-json-migration`
    and `fix/analytics-reliable-delivery`, not on `origin/main` or the released `VC_90_VN_140`.
    Until it ships, G1 cannot be measured from production.
  - `payment_added` is live (`EditInvoiceViewModel`).
  - Repeat-use is computed from data, not a new event.
  - The reporting surface already exists: the admin panel's `funnel-analysis` page.
