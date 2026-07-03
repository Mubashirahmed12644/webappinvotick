# Server Side — Changes Log & Proposed Additions

**Purpose:** Every change we make (or need) on the backend/server is documented here BEFORE it ships, with its rationale and safety note. This pairs with [MOBILE-APP-REQUIREMENTS.md](./MOBILE-APP-REQUIREMENTS.md): a server change usually implies a matching mobile change, and vice-versa.

**Golden safety rule:** The backend serves ~4000 live mobile users. All server changes must be **additive and backward-compatible** — never change or remove existing fields/behaviour that the mobile app relies on. Prefer new optional fields / new endpoints. Test on staging, get a developer review, then ship.

**Status legend:** 🔴 proposed · 🟡 in progress · ✅ shipped
**Last updated:** 2026-07-03

---

## Changes actually made so far
**None.** The backend has NOT been modified. The webapp consumes the existing `v1` auth + per-user REST + `v2` sync APIs as-is, and works around gaps on the web side only (e.g. bundling system-default images). This keeps the 4000 users at zero risk.

---

## Proposed server-side additions (additive, backward-compatible)

### S1 — Return system-default assets in the sync pull 🔴
**Pairs with:** [R4](./MOBILE-APP-REQUIREMENTS.md#r4--system-default-assets-are-not-synced)
**What:** Host the system-default header/background/stamp images on the server (`/uploads/…`) and include their records (ids `00000000-…`) in `GET /v2/sync/pull` with real `image` URLs.
**Why:** So every client (web/iOS/new devices) resolves default assets from ONE source instead of each bundling its own copy.
**Safety:** Additive — adds records to the pull; existing clients ignore unknowns. No change to existing fields.

### S2 — Add `orderIndex` to invoice & estimate items 🔴
**Pairs with:** [R3](./MOBILE-APP-REQUIREMENTS.md#r3--preserve-invoiceestimate-item-order)
**What:** Add an optional `orderIndex: Int` column to invoice_items / estimate_items; accept it on push; return it on pull & REST detail; order items by it.
**Why:** Preserve the user's item sequence across devices (no order field exists today).
**Safety:** Additive nullable column + Flyway migration. Old clients that don't send it → fall back to `createdAt` ordering.

### S3 — (Optional) Include `businessId` + non-empty `currency` in REST invoice detail 🟡
**Context:** `GET /v1/invoices/{id}` omits `businessId`, returns `currency: ""`, and item objects lack tax fields — so the webapp reads the invoice from `/v2/sync/pull` instead (which has everything).
**What (optional):** Enrich the REST detail response with `businessId`, resolved `currency`, and per-item tax, so REST detail is self-sufficient.
**Why:** Simpler/faster single-invoice reads; less reliance on a full sync pull.
**Safety:** Additive fields only.

### S4 — App/brand config endpoint 🔴
**Pairs with:** [R7](./MOBILE-APP-REQUIREMENTS.md#r7--footer-brand-logo-invotick-app-icon)
**What:** Add `GET /v1/app-config` returning shared branding: `{ brandLogoUrl, refCodeUrl, tagline, qrTarget }` (hosted brand logo on `/uploads` or a CDN).
**Why:** One source for footer branding + referral QR across web/mobile; lets us update branding without shipping new app/web builds.
**Safety:** New read-only public endpoint; additive.

---

## How we use this doc
- Before touching the backend, add the entry here (what/why/safety) and confirm with the developer.
- On ship, move to "Changes actually made" with the migration id + date, and re-verify on web + a mobile smoke test.
- Keep S-items and their paired R-items in step so mobile & server land together before go-live.
