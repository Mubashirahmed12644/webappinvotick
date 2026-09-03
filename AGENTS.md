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

**Monetisation is a requirement, not a variable.** Never propose removing, delaying or disabling an
ad, ad gate or paywall to improve a funnel. Measure every one of them exhaustively — revenue, fill
rate and impressions **alongside** wait, drop-off and abandonment — and present the trade as a
question for the user, never as a finding. A funnel instrumented only for what ads cost will always
convict them. See `memory/monetisation-measure-never-assume.md`.

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

`invoice-kmp-app/PROJECT_RULES.md` holds the full change-risk system: **Tier 1** (data/schema
migration, financial logic, auth/identity — zero tolerance), **Tier 2** (sync engine, API contract),
**Tier 3** (monetisation, analytics, admin panel), plus a pre-push checklist.

⚠️ **`invotick-apis/PROJECT_RULES.md` does not exist** — this file claimed it did until 2026-08-23.
The backend's own rules live in `invotick-apis/CLAUDE.md`, which now also carries the deploy rules:
`stage` **is** production, and **never retry an old pipeline once a newer commit has deployed** —
a retry re-runs against the commit it was created for, so it ships the older image over the newer
one while every pipeline in the list stays green. That happened on 2026-08-23 and silently removed
three things from production. Universal rules: additive-only, idempotent, local-first, backward
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
- ⚠️ **Auth is opt-in, not default.** `AuthorizationInterceptor` returns `true` when a handler has no
  `@RequireRole` — no annotation means *any authenticated caller*, guests included. A new admin or
  webpanel controller is open until you annotate it. `/v2/admin/**` was additionally listed in
  `security.public-paths` and answered with no token at all until 2026-07-28. Details + what is still
  open before payment-gateway work: `memory/admin-panel-security-audit.md`.
- Read-mostly by rule; never recompute money client-side — show what the backend computed.

## 5b. The analytics pipeline (this is how G1 gets measured)

Flow: app records → local queue (`core/analytics`, its own Room DB) → flush → backend
`/v2/analytics/track` → admin panel reads it back.

> ⚠️ **Before touching ANY event, read [`AGENTS-EVENTS.md`](AGENTS-EVENTS.md).** It is the
> constitution for this system — one action one event, one screen one event, no shared ids, which
> channel is allowlist-governed, the backend query traps, and how to verify. Every rule in it was
> paid for by a defect that looked like data rather than a bug. Add to it whenever a rule is decided.

Two classes of event:
1. **Explicitly coded** events — `gateway.trackClick("name", params)`. These **always send**.
2. **Auto-captured taps** — a codemod stamped a stable `analyticsId` on every button/clickable, and
   `guardedTrackedClick` prefixes the screen, so the identity is `tap:<screen>:<File>.<label>_N`.
   Release builds send one **unless somebody switched it off**; debug builds send everything.

**Send policy — inverted on 2026-08-23.** `AnalyticsSendPolicy.shouldSend(key) = key !in denied`,
where `denied` comes from `GET /v2/analytics/denylist` at app start. It was an allowlist, and an
allowlist can only list keys that have already been seen — so a control added in a later release was
silent in release and undiscoverable for ever. Switching one off now takes effect from the panel with
no release. Full reasoning: `AGENTS-EVENTS.md` §1.5a.

⚠️ **The old allowlist was never wired at all.** `setOverride` had no caller and nothing ever fetched
`/v2/analytics/allowlist`, so with an empty bundled default the gate was a constant `false`: **no
release build has ever sent an auto-captured tap**, and the panel's Track toggle never affected one.
Every tap-based number from before 1.4.1 is debug-only for that reason.

⚠️ **Events from builds ≤ versionCode 90 are refused at ingestion** (`analytics.min-app-version-code`).
Their sessions are still stored, so "how much of the install base has updated" stays answerable. Until
1.4.1 rolls out, **production stores no new events** — this is intended, not a fault. See
`AGENTS-EVENTS.md` §3.11 and the Health Centre's *Old-build analytics traffic*.

Explicitly coded event vocabulary today — **as the shipped build sends it** (`origin/VC_93_VN_142`,
live as 1.4.2 / versionCode 94; re-verified against `analytics_events` on 2026-09-04). **Grep note:**
`trackClick(` is often a multi-line call, so a single-line grep silently misses events — always grep
with trailing context. **A name in this list is a claim about the app; when it stops matching rows,
the list is wrong, not the app.**

- **Activation:** `invoice_created_success`, `ci_save_clicked`, `ci_preview_clicked`,
  `ci_save_validation_failed`, `ci_celebration_shown`, `Saved_clicked`, `Draft_click`, `Discard_click`,
  `create_inv_discard_dailog_shown` (sic), `discard_dialog_closed`, `estimated_success` (sic),
  `estimate_converted_to_invoice`
- **G1 primary — proof an invoice is real:** **`invoice_shared_success`** (fires only on a **confirmed**
  share: the user picks a target app in the OS chooser, tagged `mode` + `target`; **live since 1.4.1**)
  and `payment_added`. `estimate_shared` is the estimate twin.
- **Form-typing proxies:** `business_form_text_typed`, `client_form_text_add`, `item_form_text_add` —
  fired **once per form**, on the first non-blank keystroke in the *name* field. They prove the user
  started typing, **not** that the data was real. Plus `business_add_success`, `client_add_success`,
  `add_item_success` / `Item_added`.
- **Abandonment:** a sheet's **own per-sheet close id** (`invoice_create_client_screen_close`, …)
  carries `method` (`close_button` | `swipe` | `scrim_or_back`) and `had_input`. There is **no**
  separate dismissal event: one action, one event, with parameters — decision
  [0023](docs/decisions/0023-one-dismissal-event-the-method-is-a-parameter.md). These are
  auto-captured, so the **send policy** decides whether they ship; do not add a channel that bypasses it.
- **Auth:** `login_success`, `register_success`, `guest_login_success`, **`guest_login_failed`**,
  `otp_verify_success`, `guest_merge_notice_dismissed`
- **Growth (G2), receiver side:** `shared_invoice_opened`, `shared_invoice_opened_by_owner`,
  `shared_invoice_create_own_click`, `shared_invoice_approved`, `shared_invoice_rejected`,
  `shared_invoice_open_failed`, `shared_invoice_decision_failed`, `invoice_share_link_fallback`
- **Money/ads:** `premium_click`, `watch_ad_click`, `ad_request`, `ad_loaded`, `ad_shown`,
  `ad_dismissed`, `ad_load_failed`, `ad_show_failed`, `ad_dialog_dismissed`, `app_open_ad_loaded`
- **Notifications:** `notification_permission_shown` / `_allowed` / `_denied`
- **Lifecycle:** `app_cold_start`, `app_foreground`, `app_resumed`, `app_paused`, `app_background`,
  `app_heartbeat`, `session_break`, `screen_view`, `network_changed`, `app_exit_dialog_shown`

⚠️ The names this section carried until 2026-09-04 (`invoice_created`, `Business_added`,
`business_form_text_add`, `Client_added`) return **zero rows** on the live build; a funnel built on
them reads as steps nobody reached. Memory: `g1-real-data-metric-gap`.

**G1 measurement (decision [0006](docs/decisions/0006-g1-real-invoice-metric.md)):** a real invoice =
confirmed share **or** payment recorded; repeat use is the supporting signal. Nothing is prefilled
anywhere in the app, so the enemy is **throwaway data**, not our template.

✅ **`invoice_shared_success` is live** (1.4.1+; 44 firings / 33 sessions in the 7 days to 2026-09-04),
so G1 **can** be measured from production now. The earlier note that it was not live referred to the
name `invoice_shared` on pre-release branches.

~~Known defect: `memory/analytics-session-attribution-bug.md` — `sessionId=null` after the first batch.~~
**Fixed in 1.4.2** — 0.0 % NULL session ids across 81,834 events on versionCode ≥ 94 (measured 2026-09-04).

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

- `AGENTS-EVENTS.md` — **event management constitution**: the rules, the incidents behind them, the
  verification standard, and the open suggestions. Read before adding, renaming or removing an event.
- `docs/decisions/` — decision log (what was decided, why, what was rejected). **Read the index before planning.**
- `~/.claude/projects/-Users-ahmedmubashir-Documents-Webinvotick/memory/` — per-topic memory files, indexed by `MEMORY.md`.
- `docs/MOBILE-APP-REQUIREMENTS.md`, `docs/SERVER-SIDE-CHANGES.md` — cross-repo contracts (this repo).
- `invoice-kmp-app/PROJECT_RULES.md` — change rules + pre-push gates. The backend equivalent is
  `invotick-apis/CLAUDE.md` (there is no `invotick-apis/PROJECT_RULES.md`); it also holds the deploy rules.
- Backend docs: `invotick-apis/` holds `SYNC_V2_MOBILE_PROTOCOL.md`, `AUTH_API.md`, `WEBPANEL_API.md`,
  `analytics.md`, `AppFlow.md`, `HANDOVER.md`.
- Each repo has its own `CLAUDE.md` with build commands and local conventions — read the one for the
  repo being touched.
