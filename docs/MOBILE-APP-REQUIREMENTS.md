# Mobile App — Requirements for Web Parity & Correct Sync

**Purpose:** The webapp renders ONLY what the mobile app pushes to the server (see the "no fabrication" rule). Anything the web cannot show correctly traces back to a gap in what mobile syncs. This is the living list of what the **mobile app side** must do so that, before go-live, a web (or any other device) can reproduce a mobile-created invoice/estimate exactly.

**Status legend:** 🔴 open · 🟡 in discussion · ✅ done
**Last updated:** 2026-07-03

---

## R1 — Push asset IMAGES, not just IDs 🔴
**Problem:** A custom header was found on the server with `image: null` (header `abdd425e…`) even though the mobile showed it. The image file was never uploaded / its URL was never attached before the sync push.
**Requirement:** For every asset a user attaches (header, background, signature, stamp, business logo):
1. Upload the image via `POST /v1/uploads/batch` first → get the `/uploads/<file>` URL.
2. Write that URL into the asset's `image` field.
3. THEN push the record. Never push `image = null` when a local image exists.
**Impact if not done:** Web/other devices show no image for that asset.

## R2 — Normalize image URLs before push 🔴
**Problem:** Several asset images come back as `http://localhost:8081/uploads/…` (a dev/local origin).
**Requirement:** Store & push only the **relative** path (`/uploads/<file>`), never a `localhost`/absolute dev URL. (Mobile already has `toRelativeImagePath()` — ensure it runs on every asset before push.)
**Impact if not done:** Web cannot resolve the image (points at a device-local address).

## R3 — Preserve invoice/estimate ITEM ORDER 🔴
**Problem:** Invoice items have **no order/sequence field** on the server. REST and sync both return an order that does not match the mobile's on-screen order (e.g. mobile `Bdbs, 5, Hchchc, Hchchc` vs server `Bdbs, Hchchc, 5, Hchchc`). Web currently orders by `createdAt`, which cannot match a within-batch manual order.
**Requirement:** Add an explicit `orderIndex` (or `position`) to each invoice item and estimate item, set it to the user's on-screen order, and push it. (Needs matching **server** field — see server doc S2.)
**Web status:** ✅ already wired — the webapp reads `invoiceItem.orderIndex` and will order by it AUTOMATICALLY the moment it starts arriving (see `src/lib/givens.ts` `sortByOrder`). Until then it defaults to `createdAt` order. No web change needed when you send it.
**Impact if not done:** Item sequence can differ between mobile and web.

## R4 — System-default assets are not synced 🟡
**Problem:** System-default headers/backgrounds/stamps (ids `00000000-…`) are seeded **locally** in the mobile bundle (`HeaderSeeder.kt`, `BackgroundSeeder.kt`): `…0002-000N → header_N.png`, `…0003-0001 → background_1.png`. The server never stores/returns their images, so `GET /v2/sync/pull` omits them.
**Current web workaround:** the webapp ships the SAME images in `public/system-assets/` and maps the ids (`src/lib/system-assets.ts`). This works but must be kept in sync with the mobile bundle.
**Requirement (choose one, coordinate with server S1):**
- (a) Server seeds system-default assets and returns them in the pull with hosted image URLs (preferred — one source of truth), OR
- (b) Formalize the id→file mapping as a shared, versioned contract so every client bundles identical assets.
**Impact if not done:** New default assets added on mobile won't appear on web until the webapp bundle is updated.

## R5 — Set invoice `currency` explicitly 🟡
**Problem:** `invoice.currency` comes back as `""` (empty). Web falls back to client → business currency (worked here: PKR/₨).
**Requirement:** Set `currency` on the invoice at creation (from client/business), so it is unambiguous and not dependent on fallback.

## R6 — Document the "Invoice" title & template-style visual rules 🟡
**Observation:** The header title color adapts — **dark** text over a light header image (spice-jar example), **white** over a dark header image (tools example). Web currently uses white + shadow over any header image.
**Requirement:** Document mobile's exact rule (contrast-based? a template flag? a stored `titleColor`?) so web can mirror it precisely. Same for any `templateStyle` (1–4) specific decorative shapes/positioning that are drawn by the mobile canvas engine rather than stored as data.
**Web status:** ✅ already wired — the webapp reads `template.titleColor` and will use it AUTOMATICALLY when sent (see `src/lib/givens.ts`). Until then it defaults to white over a header image / theme-contrast otherwise.
**Impact if not done:** Minor title-color / decorative-shape differences on some templates.

## R7 — Footer brand logo (Invotick app icon) 🟡
**Problem:** The PDF footer shows the Invotick app icon (`Res.drawable.ic_app_icon`) + "Invoice generated using Invotick" + QR. This icon is a bundled app asset, not on the server.
**Current web workaround:** bundled the SAME `ic_app_icon.png` into the webapp (`public/system-assets/invotick-logo.png`) inside a white footer container, matching mobile.
**Requirement (future):** expose a brand/app config API (e.g. `GET /v1/app-config → { brandLogoUrl, refCodeUrl, tagline }`) so footer branding comes from ONE server source. Pairs with server **S4**.
**Web status:** ✅ already wired — `src/lib/givens.ts` `BRAND_LOGO` reads the intended `appConfig.brandLogoUrl` and defaults to the bundled logo; auto-inflates when the config API ships.

---

## How we use this doc
- Every time the web can't reproduce something mobile shows, we trace the root cause and add/□update an entry here.
- The mobile team implements these before go-live; we tick them ✅ as they land and re-verify on web.
- Server-side counterparts are tracked in [SERVER-SIDE-CHANGES.md](./SERVER-SIDE-CHANGES.md).
