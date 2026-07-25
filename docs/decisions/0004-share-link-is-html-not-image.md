# 0004 — The share link is an HTML render, not an uploaded image

- **Date:** 2026-07
- **Status:** decided — live
- **Decision:** `/i/{token}` renders the invoice as HTML from the stored snapshot
  (`SharedInvoiceViewer` → `InvoiceDocument` / `A4PagedFrame`). The only image left is the small
  **OG social card** (`/api/og/{token}`).
- **Why:** an image duplicates data we already store, costs blob storage, cannot be translated, and
  cannot be selected/zoomed well. Rendering on demand costs processing, not storage.
- **Rejected:**
  - The earlier WebP-image share approach (app uploads a rendered image per share) — superseded.
- **Consequences:**
  - `imageUrl` and the upload path are vestigial; the page does not use them.
  - The OG card must keep its TTL + auto-delete; nothing ephemeral lives forever.
  - The snapshot is frozen at share time — old links do not gain new render fixes until re-shared.

See `memory/shared-invoice-preview-strategy.md`, `memory/storage-optimization-policy.md`.
