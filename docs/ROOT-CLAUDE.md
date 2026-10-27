# Invotick — everything lives in this folder

This folder holds the five project repos and the working folder. A session opened here gets the same rules as one
opened in `Webinvotick`: the project constitution is imported below, and this folder's memory is the same memory
(a link to the Webinvotick memory).

**New session: read `HANDOFF.md` (this folder) first, then `Webinvotick/docs/HANDOVER-2026-10-27-VPS-MANAGER.md`.**
This folder is NOT a git repo; each repo below is. `HANDOFF.md` and this file are mirrored into git at
`Webinvotick/docs/HANDOFF.md` and `Webinvotick/docs/ROOT-CLAUDE.md` (branch `docs/1.5.5-measurement`) so they survive a disk loss.

## Folder structure

- `Webinvotick/` — web app (Next.js 16 App Router, React 19, Tailwind v4) + ALL docs: `AGENTS.md` (constitution), `AGENTS-EVENTS.md`
  (analytics rules), `docs/HANDOVER*.md`, `docs/decisions/` (decision log, latest 0235), `docs/measurement/FEATURE-REGISTRY.md`, `.claude/agents/`
  (`user-journey`, `sync`, `billing`, `release-impact`, `design`), `renderer/` (Vite build of the offline invoice bundle).
- `invoice-kmp-app/` — Kotlin Multiplatform app (Android live, iOS TestFlight/App Store): `composeApp/`, `core/{analytics,ads,ui}`, `data/`, `invoicePdf/`,
  `docs/LAYOUT_RULES.md`, `PROJECT_RULES.md`, own `CLAUDE.md`. Local DB Room `invotick_v2.db` (+ `invotick_phone.db`).
- `invotick-apis/` — backend, Kotlin 1.9.25 / Spring Boot 3.5.5 / Java 21 / MySQL 8, package `dev.backend.infotick` (sic, do not "fix"), default branch `stage` = production.
- `invotick-admin-panel/` — Next.js 16, all pages `"use client"` (Vercel -> admin.invotick.com). `invotick-exchange/` — exchange-rate service (Spring/Kotlin, systemd on the VPS).
- `kaam/` — `releases/` (AAB, mapping files, `rc-backups/`, Play uploader key), `ops-scripts/` (release scripts, `ci-queue.sh`, `invotick-daily-clean.sh`, `new-vps/`),
  `research/`, `worktrees/` (ONLY place for git worktrees, `<repo>-<topic>`, removed once pushed).
- **Location (moved 2026-10-25):** the real folder is `~/Developer/Invotick`; `~/Documents/Invotick` is only a symlink to it
  (macOS blocks launchd jobs from `~/Documents`). A daily cleaner runs at 05:30: `kaam/ops-scripts/invotick-daily-clean.sh`.
- **Servers (moved 2026-10-05/06):** production is the new VPS `72.61.95.120` (KVM4, shared with Codlytics, Accplix POS, PMML): backend in docker, Caddy edge,
  native MySQL, exchange, Jariya, monitoring, backups to Drive. The old VPS `82.112.253.168` expired 2026-10-22. A push to `stage` deploys to the new box.
  Details: `Webinvotick/docs/HANDOVER.md` -> "Servers (2026-10-06)", decision `0210`; box policy `0235`.

## Build and run commands (taken from each repo's own CLAUDE.md / scripts — re-check there)

- Backend (JDK 21 ONLY): `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` then in `invotick-apis/`:
  `./gradlew test` (clean baseline is the suite's full count, see AGENTS.md §5; two tests need Docker MySQL `invotick-test-mysql` on 127.0.0.1:13306),
  `./gradlew bootRun --args='--spring.profiles.active=local'`, `./gradlew bootJar`, one test: `./gradlew test --tests "dev.backend.infotick.controller.SyncV2ControllerApiTest"`.
- App (in `invoice-kmp-app/`, never parallel Gradle): `./gradlew :composeApp:compileDebugKotlinAndroid`; unit tests per module via `tools/report/report.sh --unit-only --scope ":feature:expense:testDebugUnitTest"`;
  a fresh (non-cached) guard-test run: `cleanTestDebugUnitTest`; clean builds need `--no-parallel`. Release: ONLY on the owner's word, script pattern `kaam/ops-scripts/android-155-119-release.sh`
  (clean worktree from the release branch, `clean` then `:composeApp:bundleRelease --no-parallel --no-build-cache --no-configuration-cache`, check versionCode/versionName first).
- Offline invoice bundle: in `Webinvotick/` `npx vite build --config renderer/vite.config.ts`, copy `dist` into the app (web and bundle must change together, AGENTS.md invariant 1).
- Web (`Webinvotick/`) and panel (`invotick-admin-panel/`): `npm run dev` | `npm run build` | `npm run lint`; panel also `npm run check:contrast`, `check:csv`, `check:screen-map-nav`.
  Webinvotick has THREE remotes, `origin` is dead: push `gitlab` AND `ghdev`.
- KVM4: ONE ssh session per task (`ssh -i ~/.ssh/invotick_kvm4 root@72.61.95.120`; more than 6 connects in 30 s locks you out). Deploy = push to `stage` (CI `test -> docker -> deploy-invotick`); never retry an old pipeline.
- Mac build queue: `kaam/ops-scripts/ci-queue.sh acquire <project>` / `release` / `status`.

## Coding and working conventions (full text: AGENTS.md, imported below)

Roman Urdu replies with the "AAP KE LIYE" block; additive-only DB migrations (Room `@AutoMigration`, Flyway with no rollback, `ddl-auto=validate`); every new user-owned table goes into
`UserMigrationDao.migrateAllUserData`; every backend handler carries `@RequireRole` or is listed in `PublicRoutes.kt`; layout: no fixed heights on text, `AdaptiveFieldPair`, money shrinks never truncates;
one action = one event (read `AGENTS-EVENTS.md` before touching an event); a feature is not done until the panel measures it; behaviour in the repo, secrets in `.env.prod`.

## Rules the owner has already given (never break; full list in HANDOFF.md §Do not do and the handover file §0)

Releases/Play/iOS archive only on his word · Remote Config writes only after his yes in chat · never weaken an ad/paywall · no secret in chat/file · verify-then-delete, irreversible deletes need his yes ·
deploys on KVM4 queue, never refused for busyness (0235) · protect Invotick first, do not do other projects' work, give them rules · worktrees only in `kaam/worktrees/` · routine deploys are done and reported.

@Webinvotick/AGENTS.md
@~/.claude/owner-working-rules.md
