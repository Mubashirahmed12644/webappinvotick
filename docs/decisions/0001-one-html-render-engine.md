# 0001 — One HTML render engine everywhere

- **Date:** 2026-07 (direction set earlier, recorded here retroactively)
- **Status:** decided — in progress, phased
- **Decision:** Render every invoice from a single HTML/CSS engine (`InvoiceDocument` + `A4PagedFrame`),
  used by the app WebView (offline bundle), the server render (online), and the web share page.
  The native Compose-Canvas renderer is a temporary yardstick and gets deleted at the end.
- **Why:** one engine unlocks receiver translation, admin-added templates without an app release,
  no share-image upload (storage), and app==web pixels.
- **Rejected:**
  - Keeping native Canvas and porting features into it — every new template needs an app release.
  - Rendering invoices to images server-side and shipping images — duplicates data, costs storage,
    breaks translation and selectable text.
- **Consequences:**
  - Offline and online renders must never diverge — any component change ships to both together.
  - Migration is phased and reversible behind a Remote Config flag; native stays until parity is proven.
  - Multi-page HTML layout (repeated header/parties/footer, column headers, pagination) is required work.

See `memory/html-render-migration.md`, `memory/offline-online-one-pattern.md`.
