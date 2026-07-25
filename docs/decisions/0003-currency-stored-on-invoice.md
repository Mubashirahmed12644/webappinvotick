# 0003 — Store currency on the invoice; client-locked

- **Date:** 2026-07-25
- **Status:** decided — migration not started
- **Decision:** Persist the invoice's currency **on the invoice row** and sync it to the server.
  Currency stays locked to the client once chosen and never changes afterwards.
- **Why:** currency was never persisted (no entity column), so the server fell back to USD and every
  server-rendered surface lied — e.g. `IT2607007` PKR 8,668 showed as 2.4M on the dashboard.
  In production **100% of invoices mismatch**.
- **Rejected:**
  - Deriving currency from the client at read time — that reasoning *is* the bug; a client's currency
    can change or be missing, and old invoices then re-price themselves.
  - Converting currencies per invoice on the dashboard — removed; cards now show their own currency.
- **Consequences:**
  - Room v2→v3 additive column + sync field + a safe backfill of old invoices from the client's currency.
  - Dashboard needs per-currency summaries rather than one blended total.

See `memory/currency-not-stored-on-invoice.md`, `memory/dashboard-currency-and-all-businesses.md`.
