# HANDOFF — checkpoint before account switch (2026-10-27, ~09:30 UTC)

Read with `CLAUDE.md` (this folder). Longer version with traps, credentials' names and memory file list:
`Webinvotick/docs/HANDOVER-2026-10-27-VPS-MANAGER.md`. Everything below was true when written; verify against git / the box / the panel first.
This folder is not a git repo: the committed copy is `Webinvotick/docs/HANDOFF.md` on `gitlab`+`ghdev` branch `docs/1.5.5-measurement`.

## Current goal
Two jobs run in this one session:
1. **Invotick (G1 first):** read the three tests that shipped in Android **1.5.5 (versionCode 119, Play production 99% since 2026-10-22)** — first-invoice forms (tabs), signup invitation at exit, ad gate moved after Save — on the admin panel by arm, and keep the panel able to measure them.
2. **KVM4 "super manager" (`72.61.95.120`):** keep the shared box healthy for Invotick, Codlytics, Accplix POS and PMML by giving each project's agent the rules (they do their own work); deploys queue, never refuse (decision 0235). Plus Mac housekeeping (everything under `~/Developer/Invotick`, daily cleaner).
Right now the active micro-task is the account switch itself: the owner's tokens are at 99%, a team member takes over on this Mac.

## Done (with where)
- **1.5.5 (119) released**, 99%, 1.5.4 (118) fallback. Branch `invoice-kmp-app` `release/1.5.5` @ `754d509db`. Files `kaam/releases/invotick-1.5.5-119-release.aab`, `kaam/releases/mapping-1.5.5-119-754d509db.txt`, script `kaam/ops-scripts/android-155-119-release.sh`.
- Forms feature code: `invoice-kmp-app/composeApp/src/commonMain/kotlin/.../feature/document/invoice/.../presentation/firstforms/` (tabs, order from Remote Config), domain `firstforms/FirstFormsTabs.kt` function **`refusalAfterEdit`** (a refused field's error clears when that field is fixed); tests **`ARefusalClearsWhenItsOwnFieldIsFixedTest`**, **`TheCursorStaysInTheFieldBeingTypedInTest`**, guard **`EveryPressPassesTheGateTest`** (tabs' X is `TrackedIconButton`). Decision `Webinvotick/docs/decisions/0234-…`, registry row 160 in `docs/measurement/FEATURE-REGISTRY.md`, events `AGENTS-EVENTS.md` §1.40-1.42.
- Backend `invotick-apis` `stage` @ `3a11ba3` live (round 5, `FirstFormsReport`); panel `invotick-admin-panel` `main` @ `965bb55` live ("First invoice forms" section, harness 144/144).
- Remote Config (project `invotick-invoicemaker`) set with the owner's yes: `first_forms_order=A`, `first_invoice_post_arm=preview_first`, `first_invoice_gate_move_percent=50`, `signup_invite_holdout_percent=50`, `nudges_holdout_percent=25`; `first_forms_flow_percent` and `first_invoice_post_percent` unset (= 50). Backups `kaam/releases/rc-backups/remoteconfig-2026-10-2{2,4}-before-*.json`. Phones already dealt keep their arm for ever.
- KVM4 queue policy rolled out: `/usr/local/sbin/deploy-invotick|codlytics|pmml|pos` all queue versions (global lock `/run/kvm4-deploy.lock`); Mac `kaam/ops-scripts/ci-queue.sh` + `/Users/Shared/ci-queue`. Decision `0235` (committed 2026-10-27, commit `cfb003a`).
- PMML live on KVM4 (2026-10-24, tag r1; now r10), Accplix POS live (r55), Codlytics deploying through the queue. Box 2026-10-27: load 0.8, 6.5 GB available, disk 47%, all containers healthy.
- Mac: project moved `~/Documents/Invotick` -> `~/Developer/Invotick` (symlink left), memory keys symlinked, daily cleaner `kaam/ops-scripts/invotick-daily-clean.sh` + launchd `com.invotick.daily-clean` 05:30 proven. Free space 140 -> 400 GB (10-25).
- Good-practice "own folder, own cleanup" message sent to the other active sessions (PMML, Accplix, App Optimisation, BTC_ML_Bot, vendor-bill test) on 2026-10-25.

## In progress (exact places)
- **Unexplained 53 GB drop** on the Mac: free space 407 GB (10-26 05:30) -> 354 GB (10-27 05:30), log `kaam/ops-scripts/invotick-daily-clean.log`. No cause found. Nothing deleted.
- **Red `next_step_card` silence** (Release Impact / Health Centre check `feature-events-arriving`, 24 h window, 48 h grace, backend `FirstFormsReport` and the health check classes under `invotick-apis/src/main/kotlin/dev/backend/infotick/`): events from that card were 0. Needs Sunday/Monday data re-read, then a debug-build device test (emulator `pixel7_hygiene`, windowed). Not diagnosed to a root cause.
- **Uncommitted work that is NOT mine** (do not commit blindly; ask who owns it): `Webinvotick/` — modified `.claude/agents/billing.md`, `.claude/agents/sync.md`, `AGENTS.md`, `docs/HANDOVER.md`, untracked `.claude/agents/design.md` (local branch `feat/m3-theme-and-label-verification`, which must NEVER be merged to main); `invotick-apis/` — staged `.claude/settings.local.json`, `.gitlab-ci.yml`, `Dockerfile`, `build.gradle.kts`, `docker-compose.yml` on branch `chore/remove-apptrick-name`. The app repo checkout is on stale `VC_102_VN_146`: build from a worktree of `release/1.5.5` instead.
- Worktree `kaam/worktrees/Webinvotick-handover-1027` (pushed) — the daily cleaner removes it after 3 idle days; remove sooner with `git -C Webinvotick worktree remove`.

## Next steps (in this order)
1. Find the 53 GB (`du -sk` on `~/Library/Developer`, `~/.colima`, Docker data, `~/Developer`, `/Users/Shared`), tell the owner. Do not delete outside Invotick's own rules without his yes.
2. Re-read the panel (First invoice forms, signup invitation, gate move, nudges) by arm with data after the 2026-10-24 split change (note the date: only phones dealt after it carry the new split). Settle the `next_step_card` silence (see above).
3. Ask the owner, one question at a time, for the pending yeses: delete Xcode Archives older than the newest three Invotick (keep 1.0.2-34, 1.0.2-33, 1.0.1-33 and Jariya's); gzip 15 old `mapping-*.txt` in `kaam/releases`; delete 14 old AABs (versionCode 102-116). CoreSimulator 21 GB is shared: leave unless he says.
4. Wire `QUEUE TIMEOUT` lines of the four deploy logs into the Health Centre / Slack (a `HealthCheck` `@Component`, no new page). Watch for the first live proof of a waiting deploy, a `SUPERSEDED`, a timeout. Offer the controlled "two deploys at once" test (the owner has not answered).
5. Keep KVM4 watch: PMML move-out triggers (>2.5 GB RAM or 1.5 CPU for 10 min; MemAvailable < 3 GB or load > 2 for 10 min; `/srv/pmml/data` > 15 GB; real client users) — tell the owner. Review any compose / `.env.example` sha a project sends; install host files only after review.
6. When the owner asks for it: release 1.5.6 (forms test orders B and C; iOS carrying the 1.5.5 changes). Not before his word.
7. Optional, owner's schema decision: slim `analytics_events` indexes (panel statement cap is 15 s).
8. Then the older backlog in memory (`pending-work-queue.md` is partly stale — check each item against git): security rollout kisht 2, rating-flow redesign (owner picks A/B), iOS image-picker fixes, iOS e-mail login after sign-out.

## Decisions (what and why)
- **Deploys queue, never refuse for busyness (0235)** — a refusal costs the owner a person-step; waiting costs nothing; correctness refusals stay.
- **PMML is a temporary guest** — client project, moves to the client's own server when load/users say so; no off-site copy of client data; budget 3 GB.
- **Each project does its own work; the manager gives rules** (owner 2026-10-24) — no "waiting for the manager" excuses.
- **Balanced splits for every test (owner 2026-10-24)** — 50/50 (nudges 4 equal arms) so the answer arrives sooner; signup test still needs ~5-6 weeks because of ~61 earned guests/day.
- **Gate stays open, panel ready (owner 2026-10-22)** — 99% rollout, maximum data quickly.
- **Project lives in `~/Developer/Invotick`** — launchd cannot read `~/Documents` (macOS privacy), Spotlight/backups sweep it; `~/Documents` is NOT iCloud-synced.
- **First-forms card = option C "paper card"** (owner choice), order from Remote Config, preview-first road.
- **Releases, Remote Config writes and irreversible deletes need his explicit word** — classifier also blocks them.
- **12 flat-discount invoices are left alone** (owner 2026-09-27).

## Blockers
- Owner's yeses (item 3 above). Owner's own check of the paper card at 320 dp / font 1.5; French/Dutch error lines (shortened to 20 words) not approved.
- Signup test: needs weeks of earned-guest volume, nothing to unblock.
- Waiting on the owner for PMML: only if the PMML session reports DNS / runner / ghcr items (see `memory/pmml-pmmlisb-deploy-plan-2026-10-23.md`).
- Tokens: the owner's Claude account is at 99% — that is why this handoff exists.

## Do not do (tried and failed, or forbidden)
- Do not read an autoFocus value live in the item form (cursor jumped to price after the first letter); it is remembered once per tab open (guarded by `TheCursorStaysInTheFieldBeingTypedInTest`).
- Do not use a plain `IconButton` for tracked presses (`EveryPressPassesTheGateTest` fails); use `TrackedIconButton`. Gradle caches such source-scanning guards: deleting test-results is NOT a fresh run, use `cleanTestDebugUnitTest`.
- Do not claim `~/Documents` is iCloud-synced (it is not). Do not put launchd scripts/data under `~/Documents`.
- Do not ssh to KVM4 in bursts (>6 connects/30 s = refused for a while); one session per task. No `docker logs -f` left running.
- Do not patch another project's installer/bundle on the box; the project fixes it in its repo (the `/var/log` root:syslog 0775 exception is carried by PMML and Accplix).
- Do not run heavy ad-hoc analytics queries (they slowed the panel; 15 s cap): bounded, serial.
- Do not bulk-delete Xcode Archives / AABs without his yes; do not lower Docker Desktop's disk limit (wiped everything once); do not run Gradle in parallel.
- Do not use the headless emulator `pixel7_play` for UI checks (flaky); use windowed `pixel7_hygiene`. An ANR "onStopJob" under Mac load 18+ was transient.
- Do not build a release from the stale local app checkout; do not retry an old pipeline once a newer commit deployed; do not merge `feat/m3-theme-and-label-verification`.
- Do not set or relay human-chosen passwords through chat/DB; do not write secrets in files; do not touch pmmlisb.com apex/www; do not weaken ads/paywall.
- Do not re-propose cooldowns, load or time-window refusals for deploys (rejected by the owner, 0235).
- Do not read the iOS verdict from Gradle, only from Xcode; emoji in Gradle console output breaks the XML report.
