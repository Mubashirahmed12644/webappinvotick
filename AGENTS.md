<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Invotick — project constitution

> **Read this file fully before proposing any plan.** It exists so the user does not have to
> re-explain the project every session. If something here is wrong or missing, fix the file —
> do not just fix the conversation.
>
> Lines marked `❓TODO(user)` are gaps I could not verify from code. Ask, then fill in.

## 1. What Invotick is

An invoicing product for small businesses: create invoices/estimates, share them, get paid,
track them. Live on Android (~4000 users), plus a web app, a public share-link view, and an
admin panel. Guests are the majority — **~96.6% of users are guests** (no account), which makes
data-loss and migration bugs unusually expensive.

### The three business goals (use these to break ties)

**G1 — Real-data activation (the biggest goal).** Every user who enters the funnel must end up
creating **at least one invoice with their own actual data** — their business, their client, their
items — **not** one filled from our sample/template values. Target is 100%; today it is likely
under 10%. An invoice made of our placeholder data is *not* activation.

**G2 — Cross-promotion / the client loop.** Our users' **clients** (the people receiving invoices)
should become Invotick users themselves. Every shared invoice is a growth surface.

**G3 — Trust.** An invoicing/accounting app lives on trust. Nothing may create the impression that
numbers are wrong, data is lost, or the app is careless — that is what makes a user uninstall.
A trust bug outranks a feature.

**Priority when two paths look equal:** G1 > G3 > G2. Never trade G3 away for G1 or G2 — a growth
trick that dents trust is a net loss.

Which existing track serves which goal:
- G1 → onboarding/funnel leaks (business form, splash login-wall), edit-invoice autosave, anything
  that reduces friction between "opened app" and "my own first invoice".
- G2 → share link + OG card, `/i/{token}` web view, deferred deep link, the approval loop, UTM.
- G3 → currency-on-invoice bug, duplicate invoice numbers, sync poison bug, DB migration safety,
  sent-invoice change transparency, contacts-upload privacy.

## 2. Repos — where everything lives

The authoritative source is **GitLab**, group `invotick`. GitHub copies are clones only.

| Piece | Repo (authoritative remote) | Local checkout | Deploy |
|---|---|---|---|
| **Web app** (this repo) | GitLab `invotick/ivotickwebapp` | `~/Documents/Webinvotick` | Vercel on push to `main` |
| **Mobile app** (Kotlin Multiplatform) | GitLab `invotick/invoice-kmp-app` | `~/Documents/invoice-kmp-app` | Play Store |
| **Backend** (Spring Boot) + admin API | GitLab `invotick/invotick-apis` | `~/Documents/invotick-apis` (default branch `stage`) | Docker → Hostinger VPS `:8085` |
| **Admin panel** (Next.js) | GitHub `Mubashirahmed12644/invotick-admin-panel` | `~/Documents/invotick-admin-panel` | Vercel → `admin.invotick.com` |
| **Exchange rates** (Spring/Kotlin) | GitLab `invotick/exchange-rate-service` | `~/Documents/invotick-exchange` | Docker on the same VPS |

⚠️ **Decoy — do not touch:** `~/Documents/invotickapis` is a stale GitHub clone
(`Touchpedia/invotickapis`, one "Initial commit"). The real backend is `invotick-apis`.

⚠️ The exchange-rate service lived only on a departed developer's personal GitHub until 2026-07-27,
and its rates had been 16 days stale because hourly fetching needs 744 requests/month against a
300-request quota. Its `/healthcheck` had been reporting `"All API keys exhausted"` to nobody the
whole time. Before trusting any converted figure, check `updated_at` — see
`memory/exchange-rate-service.md`.

Rules:
- **One person builds all of this.** Do not propose review workflows, approvals or Merge Requests as
  if they were established practice — `stage` has zero merge commits in its entire history, and work
  has always gone to it directly. An earlier version of this file asserted a "branch + Merge Request"
  rule that had never been used here; it was invented while writing the file, then quoted back as the
  user's own. Suggest process by all means, but as a proposal, and say it is new.
- **The pipeline is the safety net, not a reviewer.** `.gitlab-ci.yml` runs `test → docker → deploy`
  on the `stage` branch, with a real MySQL service, and deploy only runs if the tests pass. So the
  way to have CI verify a backend change is to merge it to `stage` — a failure blocks the deploy
  rather than reaching the VPS. Vercel does the equivalent for the web repos with per-branch preview
  deployments.
- ⚠️ CI's `test` job is `only: - stage`, so **nothing on a feature branch has been tested by CI** —
  only locally, if at all. Do not describe a feature branch as "green" on CI's authority.
- Flyway migrations have **no rollback**. Ship SQL and code separately (see `memory/deploy-safety-schema-changes.md`).
- If a repo is not checked out locally, say so instead of guessing at its code.

## 3. North star (the direction every decision must serve)

**One HTML render engine everywhere.** Replace the app's native Compose-Canvas invoice renderer
with a single HTML/CSS renderer used three ways: app WebView (offline, bundled), backend/server
render (online), and web (`/i/{token}`, free tool).

Why this is the north star — it unlocks in one shot:
- receiver-language translation of the invoice,
- templates as **data** (admin can add a template without an app release),
- no share-image upload (storage saved),
- app pixels == web pixels,
- eventually: delete the native renderer.

Everything else (presentation JSON, snapshot mapper, parity harness) is a step on this path.
Full plan: `memory/html-render-migration.md`, `memory/presentation-json-architecture.md`.

## 4. Hard invariants — never break these

1. **Offline HTML == Online HTML.** Both render the same `src/components/invoice/InvoiceDocument.tsx`
   + `A4PagedFrame.tsx`. A change lands in **both at once**: rebuild the offline bundle
   (`npx vite build --config renderer/vite.config.ts` → copy `dist` into the app) **and** deploy the
   web. Never reason about them as if they may differ.
2. **One data source for render.** The app's `buildInvoiceSnapshot` (`InvoiceSnapshotMapper.kt`)
   produces `InvoiceSnapshot`, which is field-for-field the web's `InvoiceRenderData`
   (`src/lib/data.ts`). Add a render field → add it in **both**.
3. **Storage is money.** Prefer processing-on-demand over storing an artifact. Anything genuinely
   stored and ephemeral (OG card, preview image) needs TTL + auto-delete from day one.
4. **Shared-invoice snapshots are frozen.** A shared link's snapshot is captured at share time;
   old links do not pick up new render fixes until re-shared. Say this out loud when a fix
   "doesn't show".
5. **Room DB migrations are additive.** Version+1, `@AutoMigration`, `exportSchema`, keep old
   `N.json`. No destructive fallback — guests' data is device-bound.
6. **Invoice currency is client-locked** and must be stored **on the invoice**, not derived at
   read time (see `memory/currency-not-stored-on-invoice.md`).
7. **Data layer vs presentation layer stay separate.** Structured columns = queryable data.
   Presentation (colors, toggles, stamp/signature offsets, template) = one JSON per invoice, with
   asset **refs**, never base64.

## 4a. Layout rules — read before writing any screen

`invoice-kmp-app/docs/LAYOUT_RULES.md` holds the adaptive/accessibility rules, each with the bug that
produced it. The ones that bite hardest:

- **No fixed heights on anything holding text** — `heightIn(min =)`, never `height()`. A 32dp chip
  slices its own label at a large font.
- **Never assume two things fit side by side** — use `AdaptiveFieldPair`. This failed in six places
  and always silently: `Bank Transfe`, `2026-07-2`, `Percenta`, with no ellipsis to admit it.
- **Money and identifiers shrink, never truncate.** `HE260…` is not an invoice number; a total split
  across two lines reads as a total that might be wrong.
- **`autoSize` does nothing without a width constraint** — in a `Row` a `Text` gets unbounded width,
  so it never shrinks and is simply clipped. Needs `weight(1f, fill = false)`.
- **Ask the window (`LocalWindowSize`), never the device.** No `isTablet`.
- **Fix every copy** — the filter chip lived in six files; two were fixed and it looked done.
- **`rememberSaveable` for anything the user opened** — `remember` dies on rotate/fold/resize.
- **Verify on a device at `font_scale 1.5`.** One screen looking right proves one screen.

## 4b. Engineering rules that already exist — read them, don't re-derive

`invoice-kmp-app/PROJECT_RULES.md` and `invotick-apis/PROJECT_RULES.md` hold the full change-risk
system: **Tier 1** (data/schema migration, financial logic, auth/identity — zero tolerance),
**Tier 2** (sync engine, API contract), **Tier 3** (monetisation, analytics, admin panel), plus
per-repo pre-push checklists. Universal rules: additive-only, idempotent, local-first, backward
compatible, behind a remote kill-switch, staged rollout ready.

Two that bite most often:
- Any **new user-owned table** must be added to `UserMigrationDao.migrateAllUserData`, or
  guest→user migration silently orphans that data.
- Backend `ddl-auto=validate` — an entity edit without a Flyway migration fails to boot.

## 5. How each side is built

### Mobile app — `invoice-kmp-app` (Kotlin Multiplatform, Android live; iOS mostly stubs)
- Modules: `composeApp` (UI/features), `core/analytics`, `core/ads`, `core/ui`, `invoicePdf`
  (the native Compose-Canvas renderer being retired).
- Local DB: Room, `invotick_v2.db`, schema v2 (`invoices.presentationJson` added).
- Sync: local write + outbox + fire-and-forget push; reads always from the local DB.
- Offline HTML render: bundled `invoice-renderer.html` in composeApp assets.

### Backend — `invotick-apis` (Kotlin 1.9.25 / Spring Boot 3.5.5 / Java 21 / MySQL 8)
- ⚠️ Package is `dev.backend.infotick` — **"infotick", not "invotick"**. Don't "fix" it.
- ⚠️ **Builds only on JDK 21.** The Mac's default `java` is 26, and Gradle fails with a bare
  `What went wrong: 26.0.1`. Use the JDK bundled with Android Studio:
  `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew …`
- `./gradlew test`: **268/268 is the clean baseline**, but two of them (`SpringContextBootTest`,
  `MigrationsApplyToLiveSchemaTest`) need a MySQL on `127.0.0.1:13306`. That's the `invotick-test-mysql`
  container (db `invotick_test`, root password `test`) — start Docker Desktop and
  `docker start invotick-test-mysql` first. Without it those two fail with `ConnectException` and you
  see 266/268; don't mistake that for the baseline, because `SpringContextBootTest` is the pre-push
  gate that catches a broken Spring bean graph.
- Port **8085**. Flyway migrations `V{YYYYMMDD}_{NN}__{desc}.sql`, `ddl-auto=validate`.
- Conventions: UUID string PKs, soft delete (`is_deleted` + `deleted_at`), audit columns, UTC
  everywhere via `InstantAttributeConverter`.
- Auth: JWT, stateless, 90-day expiry, revocation list, OTP flows, progressive security tiers.
- Key routes: `/v1|v2/auth`, `/v1|v2/sync/push`, `/v1/webpanel/**` (20-min cached aggregations),
  `/v1/contact/**`, `/v1|v2/analytics/track`, `/v2/shared-invoice/{token}`.

### Web app — `Webinvotick` (this repo; Next.js 16 App Router, React 19, Tailwind v4)
- `src/app/i/[token]` public share view · `src/app/embed/render` server-data render for the app's
  Online tab · `src/app/api/og/[token]` OG card (Vercel Blob) · `/free-invoice` public tool.
- `renderer/` is a **separate Vite single-file build** that produces the app's offline bundle from
  the same React components. Same components, two build targets.
- `src/app/api/backend/[...path]` proxies to the backend so browsers on blocked networks work.

### Admin panel — `invotick-admin-panel` (Next.js 16, all pages `"use client"`)
- Pages: `funnel-analysis`, `live-events`, `live-event-config`, `screen-flow`,
  `userBasedScreenFlow`, `users`, `users-map`, `health`, `contact-data`,
  `utm`, `ip-stats`, `api-access`, `testing-devices`, `inventory-items`, `invoice-preview`.
- **Health Centre (`/health`)** is the dashboard for everything that fails silently. **A new check is
  a `@Component` implementing `HealthCheck` — never a new page.** This is a **standing instruction
  from the user**, not a preference: anything health- or monitoring-related, from now on, goes into
  the Health Centre — folded into an existing check, or as a new one. A page with rows is a
  drill-down behind a card (`detailPath`), never a sidebar entry. `sync-health`, `billing-health` and
  `exchange-rates` still exist, but only as drill-downs behind their cards: each was a nav item of
  its own, each already held the evidence, and neither got opened on the ordinary day when the thing
  it watched started failing. Details + the two design rules: `memory/health-centre.md`.
- One API client: `lib/api.ts`; browser calls go through the same-origin `/backend` rewrite.
- Read-mostly by rule; never recompute money client-side — show what the backend computed.

## 5b. The analytics pipeline (this is how G1 gets measured)

Flow: app records → local queue (`core/analytics`, its own Room DB) → flush → backend
`/v2/analytics/track` → admin panel reads it back.

Two classes of event:
1. **Explicitly coded** events — `gateway.trackClick("name", params)`. These **always send**.
2. **Auto-captured taps** — a codemod stamped a stable `analyticsId` (`<FileSlug>.<label>_N`) on
   every button/clickable. These are firehose-scale, so release builds send one **only if it is
   allowlisted**; debug builds send everything.

⚠️ **`AnalyticsAllowlist.DEFAULT` is currently EMPTY** — deliberately cleared on 2026-07-14
(commit `92a3bb96`) to rebuild the list via Live Event Discovery, after a 41-key seed on 07-13.
So in release builds **auto-captured taps send nothing** unless the backend override
(`GET /v2/analytics/allowlist`) supplies keys. Check this before trusting any tap-based number.

Explicitly coded event vocabulary today. **Grep note:** `trackClick(` is often a multi-line call, so
a single-line grep silently misses events — always grep with trailing context.

- **Activation:** `invoice_created`, `ci_save_clicked`, `ci_preview_clicked`, `ci_save_validation_failed`,
  `ci_celebration_shown`, `Invoice_preview_create_click`, `DB_create_Invoice_click`, `Draft_click`,
  `Discard_click`, `Create_Invoice_Backpress_click`, `estimate_created`, `estimate_converted_to_invoice`
- **G1 primary — proof an invoice is real:** `invoice_shared` (fires only on a **confirmed** share:
  the user picks a target app in the OS chooser, tagged `mode` + `target`) and `payment_added`.
- **Form-typing proxies:** `business_form_text_add`, `client_form_text_add`, `item_form_text_add` —
  fired **once per form**, on the first non-blank keystroke in the *name* field. They prove the user
  started typing, **not** that the data was real. Plus `*_form_dismissed`, `Business/Client/Item_added`.
- **Auth:** `login_success`, `register_success`, `guest_login_success`, `otp_verify_success`
- **Growth (G2), receiver side:** `shared_invoice_opened`, `shared_invoice_opened_by_owner`,
  `shared_invoice_create_own_click`, `shared_invoice_approved`, `shared_invoice_rejected`,
  `shared_invoice_open_failed`, `shared_invoice_decision_failed`, `invoice_share_link_fallback`
- **Money/ads:** `premium_click`, `watch_ad_click`, `ad_shown`, `ad_dismissed`, `ad_load_failed`,
  `ad_show_failed`, `app_open_ad_loaded`
- **Notifications:** `notification_permission_shown` / `_allowed` / `_denied`
- **Lifecycle:** `app_cold_start`, `app_foreground`, `app_resumed`, `app_paused`, `app_background`,
  `app_heartbeat`, `nav_screen_view`

**G1 measurement (decision [0006](docs/decisions/0006-g1-real-invoice-metric.md)):** a real invoice =
confirmed share **or** payment recorded; repeat use is the supporting signal. Nothing is prefilled
anywhere in the app, so the enemy is **throwaway data**, not our template.

⚠️ **`invoice_shared` is not live yet** — present only on `feat/presentation-json-migration` and
`fix/analytics-reliable-delivery`, absent from `origin/main` and the released `VC_90_VN_140`.
G1 cannot be measured from production until it ships.

Known defect: `memory/analytics-session-attribution-bug.md` — events after the first batch can
arrive with `sessionId=null`, undercounting admin reports.

## 6. Glossary (use these words precisely)

- **Snapshot** — frozen invoice data used for rendering (`InvoiceSnapshot` app-side, `InvoiceRenderData` web-side).
- **Presentation JSON** — per-invoice design config (colors, toggles, stamp/sign offset+size, asset ids).
- **Token** — opaque id in a share link `/i/{token}`; editing an invoice **mints a new token** and revokes the old one.
- **Parity harness** — the 3-tab compare on the app's "Invoice Created" screen: Native (temporary yardstick) / Offline HTML / Online HTML.
- **Offline bundle** — self-contained `invoice-renderer.html` built from `renderer/` and shipped in the app's assets.
- **OG card** — the social thumbnail image for a share link; the link page itself is an HTML render, not an image.

## 7. Working agreement (how the user wants me to operate)

1. **State assumptions first.** Before any plan, open with *"meri samajh ye hai: …"* (2–4 lines).
   The user corrects in one line instead of losing a whole plan.
2. **Idea → pros/cons → plan → UX → decisions → then code.** Do not jump straight to code when
   the user brings an idea.
3. **Log every decision** in `docs/decisions/` the moment it is made — including the options that
   were **rejected**. Most wrong turns come from re-proposing something already rejected.
4. **Roman Urdu**, short answers, technical terms kept but glossed in quotes.
5. **Do not self-verify** with screenshot/device loops unless asked. Finish, report, user checks.
6. Prefer Maestro flows + logcat/API traces over tapping coordinates and reading screenshots.
7. Unexplained state changes on the shared test device are usually the user, not a bug — ask first.

## 8. Where the rest of the knowledge lives

- `docs/decisions/` — decision log (what was decided, why, what was rejected). **Read the index before planning.**
- `~/.claude/projects/-Users-ahmedmubashir-Documents-Webinvotick/memory/` — per-topic memory files, indexed by `MEMORY.md`.
- `docs/MOBILE-APP-REQUIREMENTS.md`, `docs/SERVER-SIDE-CHANGES.md` — cross-repo contracts (this repo).
- `invoice-kmp-app/PROJECT_RULES.md`, `invotick-apis/PROJECT_RULES.md` — change rules + pre-push gates.
- Backend docs: `invotick-apis/` holds `SYNC_V2_MOBILE_PROTOCOL.md`, `AUTH_API.md`, `WEBPANEL_API.md`,
  `analytics.md`, `AppFlow.md`, `HANDOVER.md`.
- Each repo has its own `CLAUDE.md` with build commands and local conventions — read the one for the
  repo being touched.
