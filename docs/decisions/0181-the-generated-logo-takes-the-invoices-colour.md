# 0181 — The app's own logo takes the invoice's colour

**Date:** 2026-09-28 · **Owner's decisions, same day** (mockups `logo-colour-mockup.html`, `logo-on-every-header.html`)
**Web:** `feat/generated-logo-follows-colour` off `main` · **App:** `feat/generated-logo-follows-colour` off
`VC_113_VN_149` (`029f0349`). Not merged, not deployed, not released. **No schema change, no backend change.**

## What the owner decided
1. The logo the app draws for a business with none (initials in a ring) is drawn in **the invoice's own colour**:
   the template's accent, or the one picked in Customize, and it follows a change. Tones from that one accent (HCT):
   ring, initials and word T35 · tile T95 · inner disc T90 · outline T80, 2 px on the 794 px sheet. Same shape.
2. **Improvement A:** where the header photo behind the tile is light, the outline is T35.
3. **Improvement B:** Modern Minimal and Simple White get accents of their own (they had none, so the renderer's
   blue #0D4DC0).
4. An uploaded logo is **never** recoloured, and **every existing business keeps its logo exactly as it is**: only
   businesses made after this ship get the colour-following logo.
5. The Create card shows the logo in the document's colour; the business forms, with no invoice, show the app's blue
   and one line: *"On your invoices, this logo takes each invoice's colour."*

## Where "this logo is generated" lives — no schema change
On **the logo's own address**, as a fragment: `/uploads/9f1c.jpg#generated-logo`. Before the upload, on the local file
name: `business_<id>_<time>_generated-logo.jpg`. (`GeneratedLogo.kt` in the app, `generated-logo.ts` in the web.)

- The server already stores `businesses.logo` as the phone sends it; every other phone reads it back in the pull, and
  the web in its sync. So the fact reaches every device and the web with **no column, no migration, no backend code**.
- A fragment is never sent in a request, so every build fetches the same file. The new app strips it before a request
  and when naming the downloaded file.
- **It clears itself.** A logo the person uploads is a new file at a new address with no mark — from this build, an
  older one, or the web. A column would have to be cleared by the server whenever the logo changed without it, or an
  old phone's upload would be drawn over as a generated mark.
- A business made before this has no mark, so its picture is shown as it always was.

**Rejected:**
- *A `logo_generated` column* (backend Flyway + Room v8): needs the owner's schema word and a deploy order, and still
  needs server logic to clear it when an older phone uploads a picture.
- *A key inside `footer_settings`*: the footer's JSON; builds from 1.4.9 rewrite it without unknown keys, and a footer
  reset writes `{}` — the fact would be lost by an unrelated action.
- *`businesses.description`*: every app push sends it back null, so it would be erased on the next edit.
- *Reading the pixels*: the app cannot tell an old baked picture from an upload, and a pixel read can differ between
  the app and the web.

## Backward compatibility
- The baked picture is **still stored in the logo field** for new businesses (now drawn in the new tones of #0D4DC0, in
  Nunito), so 1.4.8/1.4.9, their offline bundles and every renderer before this show a logo.
- The snapshot carries `business.logoGenerated` (and `headerLight`) **only when true**; otherwise the JSON is what it
  was. A frozen share link has neither, so it shows its picture. The web deployed before the app changes nothing;
  the app released before the web shows the picture on share links until the web deploys.
- An older build that pulls a marked address saves the file as `….jpg#` (it takes 4 characters after the last dot);
  the bytes are the same picture, read by path. The new build names it `.jpg`.

## Improvement A — how "light behind the tile" is known
Once, not at render time. `scripts/measure-header-surround.mjs` lays each seeded header out as InvoiceDocument does
(cover into 794 × 165 at centre 30 %) and reads the 8 px around the 112 px tile. **Light = median L\* ≥ 65.**

| header | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|--|--|--|--|--|--|--|--|--|--|
| median L\* | 58.0 | **100** | 52.9 | 13.7 | 47.8 | **69.5** | **86.2** | 57.5 | 42.8 |

So header_2 (Simple White), header_6 (Creative Green) and header_7 (Warm Orange) are light. The three ids are written
into the code on both sides (`SeededLook.LIGHT_HEADER_IDS`, `LIGHT_HEADER_IDS`) and pinned by a test in each. The app
sends `headerLight` in the snapshot; the web's own render reads it from the template's header id. A header that is a
plain band of the invoice colour counts as light when that colour's tone is ≥ 65 (the renderer computes it from the
colour, the same way offline and online). **A photo the person chose themselves is not measured and keeps T80** —
measuring it once at choose time would need somewhere to store the answer.

## Improvement B — the two accents
Material's quantizer + score on each header photo, then its primary tone T40, then checked by eye against the table
band and the totals:
- **Modern Minimal → #9F4200** (top score #E2702E, the orange wood). White on it 6.45:1.
- **Simple White → #715C24** (top score #FFE19C, the yellow triangles). White on it 6.44:1.

Runner-ups seen and not taken: #8A3900 (T35 of the wood) and #B22B12 (the pliers' red) for Modern Minimal; sage
#4D635C, peach #8F4E0B and coral #9C423A for Simple White.

New phones get them from `TemplateSeeder`. A phone seeded before gets them at start from `fillSeededAccents`:
`UPDATE templates SET color = … WHERE id = … AND isSystemDefault = 1 AND isCustom = 0 AND color IS NULL` — idempotent,
and a colour anybody chose lives on their own template (`isCustom = 1`), so it is never touched.

⚠️ The template picker's thumbnails are designer pictures (`template_1.webp`, `template_2.webp`): Modern Minimal's
shows a black band, Simple White's a black band with a mustard logo box. They never showed the renderer's blue either;
they are unchanged here.

## Invariants
- **1 (offline == online):** the mark is drawn by `GeneratedLogo.tsx` inside `InvoiceDocument`, sized by arithmetic on
  Nunito's advance widths (`generated-logo-metrics.ts`, generated from `renderer/fonts`), never by measuring text. The
  bundle was rebuilt into both app copies.
- **2 (one data source):** `SnapshotBusiness.logoGenerated` / `InvoiceSnapshot.headerLight` == `InvoiceRenderData`
  `business.logoGenerated` / `headerLight`.
- The tone function exists twice (Kotlin `M3Palette.tone`, TS `tone`); one table of 12 seeds × 4 tones is pinned in
  both tests, hex for hex.

## Events, monetisation
None changed.
