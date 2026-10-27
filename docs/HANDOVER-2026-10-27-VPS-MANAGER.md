# HANDOVER 2026-10-27 — the Invotick session that is also the KVM4 "super manager"

Written 2026-10-27 09:10 UTC by the outgoing Claude session, because the owner's tokens are at 99%. A team member continues
with their own Claude account **on this same Mac**. Read this file first, then `docs/HANDOVER.md` (servers, section "Servers (2026-10-06)"),
then `AGENTS.md`. **Every number below was true when written. Verify against git, the box and the panel before acting on a single line**
(the project's first rule: a check must be able to fail).

The owner is **Mubashir Ahmed** (MBA, not a developer). He runs five repos and a production box alone.

---

## 0. How to behave — the owner's rules (break none of them)

1. **Every reply that reports work carries the "📋 AAP KE LIYE" block** (table in a blockquote, rows 🔍 Mila / 🟢 Theek hua / 🟡 Baqi /
   🔴 Aap karein, 🔴 last, at most 10 lines, every claim with a number, never an empty 🔴 — write "kuch nahi"). Shape is in `AGENTS.md` §0.
2. **Roman Urdu, plain words, short.** No technical terms; explain with everyday comparisons. Words he uses himself are fine: sync, push, queue, server, DB.
3. **Anything he must copy goes alone in its own fenced code block** (command in a `bash` block, one command per block; URLs/IDs in a plain block).
4. **Questions to him: one at a time, explanation first in the reply, then ONE `AskUserQuestion` with 2-4 options, recommended first.** Never stall on a decision
   that is his: ask it at once, then finish. Design choices (how a screen looks) go to the design agent (`.claude/agents/design.md`), not to him.
5. **Releases, Play uploads, iOS archives only on his word.** Remote Config writes only after his explicit "yes" in chat (the auto-classifier blocks a flag write until then).
6. **Do not deploy while he tests. Routine deploys and ops are done and reported ("tell me, don't ask me")**; ask only for schema, releases, deletes, money.
7. **Never put a secret in chat, a file or a command line.** If he must give a key: a `read -rs` prompt command. Never `pbpaste`. Never relay a password a human chose.
8. **"Verify, then DELETE"** — nothing is deleted before it is looked at, and irreversible deletes need his explicit yes. Never touch secrets, keys, memory, transcripts, other projects.
9. **Delegate work to agents, route his messages; but a feature is not done until the admin panel can measure it** (`AGENTS.md` §7 items 10-11).
10. **Monetisation is a requirement.** Never propose removing/delaying an ad, ad gate or paywall; measure revenue AND cost and present the trade as a question.
11. Worktrees only in `~/Developer/Invotick/kaam/worktrees/`, removed once pushed. Never `git add -A` while an agent edits. Never parallel Gradle.
12. Do not self-verify with screenshot loops unless he asks. Finish, report, he checks.

Models: his own session runs Sonnet; hard thinking goes to an Opus subagent (memory `model-choice-is-my-job`).

---

## 1. Where everything is on this Mac (changed 2026-10-25)

- **Real folder: `~/Developer/Invotick`.** `~/Documents/Invotick` is only a symlink to it. Why: macOS blocks launchd jobs from reading `~/Documents`
  ("Operation not permitted"). `~/Documents` is NOT iCloud-synced (an earlier claim of mine was wrong). `.metadata_never_index` is inside, so Spotlight skips it.
- Repos: `Webinvotick/` (web + ALL docs), `invoice-kmp-app/`, `invotick-apis/` (default branch `stage` = production), `invotick-admin-panel/`, `invotick-exchange/`, `kaam/` (releases, ops-scripts, worktrees, research).
- Claude memory (the real one): `~/.claude/projects/-Users-ahmedmubashir-Documents-Invotick/memory/`. `~/.claude/projects/-Users-ahmedmubashir-Developer-Invotick[-Webinvotick]` are symlinks to it.
  `MEMORY.md` (the index) is over its size limit: trim long lines when you touch it; the newest entries are at the top.
- **Daily cleaner (Invotick only):** `kaam/ops-scripts/invotick-daily-clean.sh` (dry-run default, `--apply`), launchd `com.invotick.daily-clean` at 05:30, log `kaam/ops-scripts/invotick-daily-clean.log`,
  skip list `invotick-daily-clean.skip`. Last runs: 10-25 free 400 GB, 10-26 407 GB, **10-27 354 GB — 53 GB disappeared in a day; nothing in Invotick's rules did it. Find out what (another project's builds? Docker/colima? Simulator?).** Free space was 140 GB before the 10-25 cleanup.
- Other projects' sessions were told on 2026-10-25 to tidy only their own project and to propose (not do) a move to `~/Developer/<Project>`. Their replies go to the owner, not to you.
- **Mac builds queue:** `kaam/ops-scripts/ci-queue.sh` + folder `/Users/Shared/ci-queue` (1777). One heavy job at a time, FIFO, a second slot only while the Mac is quiet.
  Each project builds as its own macOS user with its own runner (Invotick: GitLab runner 56820544, tag `mac`, runs backend tests with docker; Accplix, PMML, Codlytics have GitHub runners — names as each project reports them, verify with `ci-queue.sh status`).
  macOS user `gh-pmml` + its own colima belong to PMML. Do not touch their folders.

## 2. Live state (verified 2026-10-27 ~09:00 UTC)

| Piece | State |
|---|---|
| Android app | **1.5.5 (versionCode 119)** in Play production at **99%** since 2026-10-22; 1.5.4 (118) is the fallback. Source: `invoice-kmp-app` branch `release/1.5.5` @ `754d509db`. Files: `kaam/releases/invotick-1.5.5-119-release.aab`, `mapping-1.5.5-119-754d509db.txt`, script `kaam/ops-scripts/android-155-119-release.sh`. Local checkout of the app repo is on an old branch (`VC_102_VN_146`): do not build from it; make a worktree from `release/1.5.5`. |
| iOS | Not released with the 1.5.5 changes. Decision for TestFlight/App Store is the owner's. |
| Backend | `invotick-apis` `stage` @ `3a11ba3` (round 5, FirstFormsReport); container `invotick-server` up 5 days, healthy. Local working copy is on branch `chore/remove-apptrick-name` with staged edits of someone else: do not commit from it. |
| Admin panel | `invotick-admin-panel` `main` @ `965bb55`; section "First invoice forms" live; harness 144/144. |
| Web | `Webinvotick` `gitlab/main` @ `d37c421`. Docs branch with the 1.5.5 decisions: `gitlab docs/1.5.5-measurement` @ `5a4165d` (+ this file and 0235, see §9). The local checkout has 6 uncommitted files that are other sessions' (billing.md, sync.md, AGENTS.md, HANDOVER.md, design.md…): commit only files you own, by name. |
| KVM4 `72.61.95.120` (ssh: `ssh -i ~/.ssh/invotick_kvm4 root@72.61.95.120`) | up 9 d, load 0.8, RAM 16 GB with **6.5 GB available**, disk 47% (104 GB free). Containers healthy: invotick-server, pos-web/api/db, pmml-web/backend/storage/postgres, portfolio-panel-* (the Codlytics stack, per its compose name — verify), monitoring (prometheus, grafana, loki, promtail, cadvisor, node-exporter). Deploy counters: pmml r10, pos r55, codlytics 40098148024. |

## 3. The 1.5.5 experiments (the owner wants to read these on the panel)

Remote Config project `invotick-invoicemaker`. A phone gets its arm **once, stores it, keeps it for ever**: a changed split applies only to phones dealt after the change. Always read the panel **by arm per phone** and note the change date.

| Key | Value now | Notes |
|---|---|---|
| `first_forms_order` | `A` | control; orders B and C need another release |
| `first_invoice_post_arm` | `preview_first` | |
| `first_forms_flow_percent`, `first_invoice_post_percent` | unset = code default 50 | |
| `first_invoice_gate_move_percent` | **50** (was 20, changed 2026-10-24) | gate moved after Save for a first invoice |
| `signup_invite_holdout_percent` | **50** (was 20 default, changed 2026-10-24) | signup invitation at exit |
| `nudges_holdout_percent` | **25** (was 20 default, changed 2026-10-24) | 4 equal arms: holdout + 3 variants |

Backups of the template before each change: `kaam/releases/rc-backups/remoteconfig-2026-10-22-before-*.json`, `…2026-10-24-before-*.json`. Undo = set the key back (20 / 20 / unset) or delete it.
**Method for Remote Config:** fetch the service account from the GitLab CI variable `FIREBASE_CREDENTIALS` with `glab api` into a 600 scratch file, publish with the template ETag (send `Accept-Encoding: gzip`, otherwise the ETag header is missing), read back, delete the key file. Template versions: 110-115. **Only after the owner says yes in chat.**

When to read: forms test ~2 weeks from 2026-10-22 (about 2026-11-05); signup test is limited by earned guests (~61/day): balanced split needs ~2,400 phones, **about 5-6 weeks** (mid-December). Decision 0233 and 0234, registry row 160, memory `release-155-119-live-2026-10-22`.

## 4. KVM4 — the shared box (my role as "super manager")

Projects on it, each its own agent/session, each does its own work: **Invotick** (mine, protected first), **Codlytics** ("App Optimisation Panel", ports 3210/3220), **Accplix POS** (`/srv/pos`, 3230-3239, accplix.com), **PMML UC Field Work** (`/srv/pmml`, ports 3240-3242, admin/api/files.pmmlisb.com; a **temporary client guest** — see below). Jariya runs as systemd + Postgres 16.

The rules the owner set (full text: memory `vps-super-manager-rules`, decision `0235`):
- **Protect Invotick; do not guard others' insides.** My "go" is needed only for: new containers/RAM/CPU/disk budget, host root files (cron.d, sshd, sudoers, systemd, firewall, Caddy edge), docker daemon, DNS, money, and Invotick's own parts.
- **Do not do the projects' work.** Give their agents the rules; they write and own compose, scripts, workflows, health routes, backups. You review against the rules and do only what needs root/shared (create user, sudoers, Caddy site via `edge-enable`, slice, secrets generation, first watched deploy). Never let "waiting for the manager" become an excuse in either direction.
- **Deploys queue, are never refused for busyness (0235).** One deploy at a time on the box: global lock `/run/kvm4-deploy.lock` (flock, 90 min). Waits (outside the lock) for load/memory/the 02:00-02:59 UTC backup window; a newer request for the same project supersedes an older waiting one (`SUPERSEDED by r<n>`); 20-min hard limit then rollback; after 90 min `QUEUE TIMEOUT` (exit 9). Still refused: bad tag, older/rolled-back tag, wrong CPU arch, policy violation, missing secret/image, failed rollback.
  All four deploy scripts (`/usr/local/sbin/deploy-invotick|codlytics|pmml|pos`) are queue versions, each reviewed by an independent reviewer before install. **Never seen live yet:** a deploy that waited, a SUPERSEDED, a QUEUE TIMEOUT.
- **PMML is temporary here.** Move-out triggers (tell the owner): PMML containers above 2.5 GB RAM or 1.5 CPU for 10 min; MemAvailable < 3 GB or load > 2 for 10 min while PMML runs; `/srv/pmml/data` > 15 GB; real client users in numbers. No off-site (Drive) copy of its data. Budget 3 GB. The pmmlisb.com apex and www are the party's home page: never touch.
- Guard Rule G: stop a project's panel if MemAvailable < 1.5 GB for 5 minutes.

## 5. Open items, in the order to take them

1. **(You, now)** Find what used 53 GB on the Mac between 10-26 05:30 and 10-27 05:30 (`du` on `~/Library/Developer`, `~/.colima`, Docker, `~/Developer`, other users' folders you can read). Report to the owner.
2. **Panel silence `next_step_card`** (a Release Impact / Health Centre `feature-events-arriving` card): was red, expected cause = events not yet arriving for that card. Recheck with Sunday/Monday data (now available). If still 0, test on a debug build on the emulator `pixel7_hygiene` (windowed; the headless `pixel7_play` is flaky). Do not "fix" until you have seen the real events.
3. **Owner yeses still waiting** (ask in ONE question, items together is OK as separate questions one at a time): (a) delete Xcode **Archives** older than the newest three Invotick ones (keep 1.0.2-34, 1.0.2-33, 1.0.1-33 and Jariya's) — the classifier blocks bulk deletion without his word; (b) CoreSimulator 21 GB (shared tvOS/watchOS/visionOS runtimes, not Invotick's — leave unless he says); (c) gzip 15 old mapping files in `kaam/releases`; (d) delete 14 old AABs (versionCode 102-116) in `kaam/releases`.
4. **Prove the queue live** the first time two deploys overlap; add `QUEUE TIMEOUT` lines to the Health Centre / Slack (not done). An optional controlled "two deploys at once" test was offered to the owner; he has not answered.
5. **Accplix:** their push of `e288337`/`cc2a0d6` is done; confirm their next runs go through the Mac queue and the box queue. **Codlytics:** next release via the queue. **PMML:** review any compose/`.env.example` sha they send; first admin login steps and rollback drill are theirs/mine per `pmml-pmmlisb-deploy-plan-2026-10-23` §Open.
6. **Release 1.5.6 (only on his word):** the forms test needs orders B and C in a release; iOS has not shipped the 1.5.5 changes.
7. **Optional, owner's schema decision:** slim `analytics_events` indexes (the panel's 15 s statement cap bites heavy queries).
8. Older backlog (some items already shipped — **verify each against git before believing it**): memory `pending-work-queue.md` (long; its 2026-09-20 audit is partly stale), `security-rollout-2026-10-15` (kisht 2 onward), `rating-flow-redesign-2026-10-19` (code after 1.5.3, owner chooses A/B), `ios-image-picker-issues-to-fix`, `ios-email-login-fails-after-sign-out-2026-10-13`, `second-invoice-2026-10-19`, `twelve-flat-discount-invoices-left-alone` (do NOT repair).
9. Smaller: the French/Dutch error lines for the forms were shortened to 20 words (not approved by the owner); the owner's own check of the paper-card layout at 320 dp and font scale 1.5 is still his.

## 6. Traps that already cost something (do not re-learn)

- ssh to KVM4 is rate-limited: **more than 6 connects in 30 s = "Connection refused" for a while.** One ssh session per task, put many commands in it. Never leave `docker logs -f` or any follower running (outage 2026-09-05).
- Never retry an old pipeline once a newer commit has deployed (ships the older image over the newer, 2026-08-23). A push to `stage` IS a production deploy.
- Flyway has no rollback: ship SQL and code separately. `ddl-auto=validate`.
- Backend builds only on JDK 21 (`JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`). Two tests need Docker MySQL `invotick-test-mysql` on 13306; never lower Docker Desktop's disk limit (it wiped everything once).
- Gradle caches source-scanning guard tests: use `cleanTestDebugUnitTest` for a fresh run. A clean build needs `--no-parallel`. After deleting/renaming an image, release only from a clean build.
- iOS test report: emoji in console output breaks the Gradle XML; run the kexe directly.
- Heavy ad-hoc analytics queries slow the panel (15 s cap): keep queries bounded and serial; no unbounded `findAll()`.
- The Remote Config split is dealt once per phone; a changed percentage never moves old phones.
- Classifier blocks: reading token memory files, flag writes before his yes, patching an installer on the box, bulk deletion of archives. Answer: ask the owner, route to the project, or split regenerable from irreversible deletes.
- `launchd` jobs cannot read `~/Documents`, Xcode DerivedData/Archives or git worktrees without full-disk access; keep job scripts and data under `~/Developer`.
- Bundle installers on the box: I never patch one; the project does (the `/var/log` root:syslog 0775 exception lives in PMML's and Accplix's repos).
- Webinvotick has THREE remotes and `origin` is dead: push `gitlab` and `ghdev`. Branches move under you (several sessions): work in a worktree from the exact remote branch.
- A name in an event list is a claim about the app; if it stops matching rows, the list is wrong, not the app. Before touching ANY event read `AGENTS-EVENTS.md`.

## 7. What NOT to do

Do not release, upload to Play, archive iOS, write Remote Config, delete Archives/AABs, change the age key, rotate secrets, change MySQL / invotick-server / shared Caddy main config / firewall / sshd / DNS, raise another project's limits, or restart production — without the owner's explicit word (or, for the routine deploys listed in §0 item 6, do and report). Do not repair the 12 flat-discount invoices. Do not treat the old VPS `82.112.253.168` as anything: it expired 2026-10-22.

## 8. Credentials and where they are (names only, never values)

Age backup key: owner's password manager (a copy named `invotick_age_backup.key` exists in `~/.ssh`; never print it). ssh keys in `~/.ssh`: `invotick_kvm4` (root on KVM4), `invotick_ro` (read-only DB), `invotick_deploy_ci`, `accplix_deploy`, `codlytics_deploy`. Admin API token: memory `admin-api-token`. GitLab: `gitlab-api-token` (dots; `whoami` first). Vercel: `vercel-api-token` (team `apptrick-s-projects`, every call needs `?teamId=`). Play uploader service account: `kaam/releases/play-uploader.json` (key ≠ permission: a release still needs his word). Hostinger API tokens in `~/.ssh`. Never call a credential expired without testing it.

## 9. Documents of this period

- Decisions: `0233` (gate move 20% for new users), `0234` (first-invoice forms become tabs, tested order, preview-first road), **`0235` (a busy machine queues a deploy; never refuses)** — 0235 was written 2026-10-24 and, until this handover, existed only in the working copy; it is committed with this file on `docs/1.5.5-measurement`.
- Registry: `docs/measurement/FEATURE-REGISTRY.md` (row 160), `AGENTS-EVENTS.md` §1.40-1.42.
- Memory to read: `release-155-119-live-2026-10-22`, `vps-super-manager-rules`, `pmml-pmmlisb-deploy-plan-2026-10-23`, `new-server-live`, `accplix-pos-live-2026-10-17`, `invotick-moved-to-developer-folder-2026-10-25`, `health-centre`, `signup-never-blocks-invoice-iap-ads`, `remote-config-is-mine-no-new-access-2026-10-19`, `release-impact-agent-2026-10-19`.
- Agents (in `Webinvotick/.claude/agents/`): `user-journey`, `sync`, `billing`, `release-impact`, `design`. Events/funnel work always goes through `user-journey`; premium through `billing`; sync through `sync`; what a feature should be measured by through `release-impact`.

## 10. First hour for the new person

1. Read this file, `docs/HANDOVER.md` top section, `AGENTS.md` §0 and §7, and the memory files in §9.
2. Run the daily-clean log check and item 5.1.
3. Open the admin panel Health Centre and Release Impact; compare with §2 and §3. If anything differs from this file, the file is wrong — fix the file.
4. Tell the owner, in the AAP KE LIYE block, that you have taken over and what you found.
