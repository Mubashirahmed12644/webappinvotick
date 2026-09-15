# HANDOVER — read this first (written 2026-09-15 ~12:00 UTC)

The owner (Mubashir Ahmed) ran out of weekly tokens on his Claude account. A team member continues with **their
own Claude account on this same Mac**. This file is the bridge: it says what is live, what is half-done, what is
waiting on the owner, and exactly how to pick each thread up. Everything here was true when written — **verify
against git / production before acting on any single line** (the project's first rule, see
`memory/a-check-that-cannot-fail.md`).

---

## 0. How to start (for the new person)

1. Same macOS user (`ahmedmubashir`). Claude desktop → **Code** → open the folder `~/Documents/Webinvotick`.
   (Memory is stored on this Mac at `~/.claude/projects/-Users-ahmedmubashir-Documents-Webinvotick/memory/`, not in
   the Claude account, so it loads automatically for any account — **as long as the session is opened in this
   folder**.)
2. First message to Claude: **"Read docs/HANDOVER.md, AGENTS.md and memory/pending-work-queue.md, then continue."**
3. Loaded automatically every session: `AGENTS.md` (project constitution, via `CLAUDE.md`) and `memory/MEMORY.md`
   (index of ~150 memory files). Read the ones a task touches.
4. The owner speaks **Roman Urdu, plain words, not technical** (he is an MBA, not a developer). Every report carries
   the **AAP KE LIYE** block (AGENTS.md §0). Decisions are asked **one question at a time**, recommendation first.

## 1. Where the knowledge lives

| What | Where |
|---|---|
| Constitution: repos, goals (G1 > G3 > G2), invariants, rules | `AGENTS.md` (this repo) |
| Event/analytics rules | `AGENTS-EVENTS.md` |
| Every decision, with rejected options | `docs/decisions/` (index `README.md`; latest 0113) |
| Sync policy / billing policy (domain owners) | `.claude/agents/sync.md`, `.claude/agents/billing.md`, `.claude/agents/user-journey.md` |
| Memory (incidents, dated state, standing rules) | `~/.claude/projects/-Users-ahmedmubashir-Documents-Webinvotick/memory/` — index `MEMORY.md` |
| **The full backlog, newest first** | `memory/pending-work-queue.md` (top sections = 2026-09-14/15) |
| Deploy scripts of this week | session scratchpad (gone after the session) — pattern: fast-forward push to `stage`, watch the pipeline by FULL sha, prove from inside the box |

Repos (all under `~/Documents`): `Webinvotick` (web + docs), `invoice-kmp-app` (Android/iOS app), `invotick-apis`
(backend; branch `stage` IS production), `invotick-admin-panel`, `invotick-exchange`. Many `*-<topic>` folders next
to them are **git worktrees** of those repos, one per feature branch.

## 2. Standing rules that bite (full list: MEMORY.md "Standing rules")

- **Release builds (Android bundle, iOS archive/upload) only on the owner's word.** Play uploads are his.
- **DB migrations: ask the owner every time; ship the migration ALONE first**, then the code.
- **Backend deploy = merge to `stage`**; CI runs test → docker → deploy. **Never retry an old pipeline.**
- Production DB (`invotick_prod`, via `ssh -i ~/.ssh/invotick_ro root@82.112.253.168`) is **read-only**, counts
  only, bounded windows. Never `docker logs -f`; never `source` a Spring `.env`; never print secrets.
- **Never `git add -A`** (agents leave work in checkouts). Commit files by name.
- Web repo remotes: push **`gitlab` + `ghdev`**; `origin` is dead. Web `main` on ghdev deploys to production (Vercel).
- **Never silence an alert before diagnosing it with data** (`memory/never-silence-before-diagnosing.md`).
- **Lean token mode**: 1–2 agents at a time, cheaper model for simple checks.
- **One Gradle build at a time on this Mac.** Agents use the lock
  `L=/private/tmp/claude-501/invotick-gradle.lock; until mkdir "$L" 2>/dev/null; do …; sleep 20; done` (mkdir + pid).
- Version name moves only after a release is live on Play (1.4.6 → next is **1.4.7** once 105 is live).

## 3. What is LIVE right now

| Piece | State |
|---|---|
| Android on Play | 1.4.5 (101) live; **1.4.6 (105)** bundle built — the owner was creating the production release (screenshot 2026-09-15). File: `~/Documents/invotick-releases/invotick-1.4.6-105-release.aab` (sha256 `002a7a9d…e2ae`), code `invoice-kmp-app` `VC_102_VN_146` @ `d607e05e`. 102/103/104 files are superseded — never upload them. |
| iOS | TestFlight build 19 (1.4.6). **Not on the App Store yet** — first submission blocked by the audit (§5). Next build = **20**. |
| Backend (`stage`) | `df6f6a1` (batch23: correct sync refusals log WARN) → **batch24 `c289647` running** (§4.1). |
| Grafana alerts | batch22 `6b623a2`: `or vector(0)`, `last_over_time` bridges, new "Log Pipeline Silent" rule; 18/18 Normal. |
| Web (www.invotick.com) | `main` = `03a676f`: **/privacy-policy and /terms live** (Flixotech LLC, support@invotick.com, Wyoming law), `/privacy` → 308. |

## 4. IN FLIGHT — pick these up

### 4.1 batch24 — account-deletion migration, ALONE (owner said yes)
Pushed `c289647` to `stage` at 11:52 UTC 09-15, pipeline `2850548471`. The watcher died with the old session.
Check it, read-only:
```
ssh -i ~/.ssh/invotick_ro -o BatchMode=yes root@82.112.253.168 "mysql -uroot -N -B invotick_prod -e \"SELECT version, success FROM flyway_schema_history WHERE version LIKE '20260915%'; SELECT index_name FROM information_schema.statistics WHERE table_schema='invotick_prod' AND index_name IN ('idx_users_closed_at','idx_identity_claims_user_id'); SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='invotick_prod' AND table_name='users' AND column_name='closed_at';\""
```
Expect: `20260915.01 1`, both indexes, `1`. Also the pipeline status in GitLab (project `invotick/invotick-apis`).

### 4.2 Backend branches waiting (all pushed to GitLab, none on `stage`), in deploy order

| # | Branch | Head | What | Gate |
|---|---|---|---|---|
| 1 | `feat/account-deletion` | `3174e64` | POST /v2/account/delete, 30-day restore (409 ACCOUNT_CLOSED), eraser OFF (`account.erase.enabled=false`); 1066/1066 | after batch24 is proven |
| 2 | `feat/sign-in-with-apple-migration` | `19e9884` | `V20260915_02` user_identities.provider_refresh_token (INSTANT) | **owner's go, alone** |
| 3 | `feat/sign-in-with-apple` | `c4c334f` | Apple sign-in, token revoke on deletion (needs keys, §6); 1086/1086 | after #2 |
| 4 | `feat/apple-purchases` | `2beb01e` | StoreKit verification (JWS vs Apple Root CA G3), `/v1/billing/apple/notifications`; no migration; 1,092/1,092 | conflicts with `feat/renewal-key` on PublicRoutes.kt + security.public-paths → keep both |
| 5 | `fix/r-links-send-iphones-to-the-app-store` | `b1fb9557` | `/r/` links send iPhones to App Store id 6757918977; 1050/1050 | **only after the app is live on the App Store** |
| 6 | `chore/remove-apptrick-name` | `82d60a7` | docs/settings cleanup | any batch |

Batch several code branches into one deploy (the owner dislikes many restarts), never with a migration.
Older backend branches (renewal key, date-shapes, support view…) are tracked in `pending-work-queue.md`.

### 4.3 App branches waiting (invoice-kmp-app, all from `VC_102_VN_146` @ `d607e05e`, pushed, not merged)

| Branch | Head | What |
|---|---|---|
| `fix/146-app-store-review` | `05a8ee78` | iOS: ledger PDF hidden, Android-only wording, StoreWording, PrivacyInfo 9 types, **iPhone-only** (TARGETED_DEVICE_FAMILY 1), `LegalLinks` → invotick.com/privacy-policy + /terms |
| `feat/146-ios-admob` | `ec5a0c67` | iOS ads = Android (app open, interstitial, banner), GMA 13.9.0 SPM, **Google TEST ids** in `iosApp/Configuration/Config.xcconfig` (4 lines), ATT not on first open, NSPrivacyTracking true |
| `feat/146-ios-storekit` | `3a880869` | iOS premium via StoreKit 2 (Swift bridge), restore, paywall never dead-ends |
| `feat/146-delete-account` | `9b6eddfb` | Menu → Account → Delete Account (registered users only) |
| `feat/146-sign-in-with-apple` | `cd017d46` | stacked on delete-account; "Continue with Apple" on iPhone |
| `chore/remove-apptrick-name` | `447f0bf6` | test/comment rename only |

Expected merge conflicts: `iosApp/iosApp/PrivacyInfo.xcprivacy` (app-store-review vs admob), `PremiumPaywallSheet.kt`
(app-store-review vs storekit), `project.pbxproj` (several). **Open decision for the owner:** these carry Android
changes too (account deletion, legal links). Since 1.4.6 (105) is going live, the next Android is **1.4.7**; iOS
build 20 stays 1.4.6 — decide the branch (e.g. a new `VC_106_VN_147`) before merging. iOS build 20 script exists
in the old scratchpad only; its steps: one Gradle run (tests with `--rerun`), Simulator launch check, build number
19 → 20 in `project.pbxproj` (2 lines), `xcodebuild archive` with the Admin API key `STX8X43K43`
(`~/.appstoreconnect/private_keys/`), prove new strings in the binary, `-exportArchive` with `iosApp/UploadOptions.plist`.

### 4.4 Web branch waiting
`feat/web-share-events-carry-link` @ `a148082` (gitlab + ghdev): share-page events carry `iv_doc` (link token,
server-side) + iPhone "Get it on the App Store" button + Smart App Banner (0110). **Deploy only after the app is
live on the App Store** (App Store page 404s until then), together with backend #5.

### 4.5 Suggested (not started)
- Chip "Send IP lookups to ip-api over HTTPS" — backend sends user IPs to ip-api.com over plain http.
- Website `/delete-account` page (Play Data safety needs a deletion URL) — owner question pending.

## 5. iOS first App Store submission — status
Audit (2026-09-15) found 5 FAIL: dead-end paywall, no account deletion, Google login without Apple login, "Google
Play" wording/links, ledger PDF errors; RISK: iPad, privacy manifest, stale policy. **All are built on the branches
above.** Remaining before submitting: merge + build 20, owner's console work (§6), real AdMob ids (test ads must
not reach review), App Store privacy labels (tracking = YES because of ads/IDFA), review notes, demo account,
sandbox purchase test. Draft review notes (English): "Invoice Maker by Invotick lets small businesses create,
preview and share invoices and estimates. No sign-in is required: on first launch the app creates a guest
workspace… Account deletion: Menu → Account → Delete account…" (update: the app now HAS ads and in-app purchases).

## 6. The owner's own actions (he knows; remind, don't do)
1. **Play**: publish 1.4.6 (105). The "no debug symbols" warning is harmless for 105.
2. **Install Android NDK** (Android Studio → Settings → Android SDK → SDK Tools → "NDK (Side by side)"). Then pin
   `ndkVersion` in `composeApp/build.gradle.kts` (release already has `ndk { debugSymbolLevel = "SYMBOL_TABLE" }`)
   and check the next AAB has `BUNDLE-METADATA/com.android.tools.build.debugsymbols`.
3. **AdMob**: iOS app (bundle `invotick.invoicemaker`, App Store id 6757918977) + units App Open, Interstitial,
   Banner → 4 ids into `iosApp/Configuration/Config.xcconfig`.
4. **App Store Connect**: Paid Apps agreement/tax/bank (24–48 h); subscription group **Invotick Premium** with
   `yearly_subscription` (1 year, level 1), `monthly_subscription` (1 month, level 2); non-consumable
   `life_time_purchase`; Play's prices, no trials; sandbox tester; optional In-App Purchase key; after backend #4
   is live: App Store Server Notifications V2 URL `https://stage.invotick.com/v1/billing/apple/notifications`.
   (Ids confirmed in `domain/.../billing/BillingProductIds.kt`, shared by Android and iOS.)
5. **Apple Developer**: enable Sign in with Apple on App ID `invotick.invoicemaker`; create a Sign in with Apple key
   → Team ID, Key ID, .p8 into the VPS `.env.prod` as `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`,
   `APPLE_SIGNIN_PRIVATE_KEY` (the owner pastes secrets; never through Claude).
6. **Vercel** (optional): team name "apptrick-s-projects" → rename (Apptrick is not involved; see §8).
7. Companies: **App Store account = Flixotech LLC (Wyoming, USA); Google Play account = Touchpedia LLC.**

## 7. Owner questions still open (ask ONE at a time, recommendation first)
- StoreKit: sandbox purchases grant premium (yes — reviewers test that way)? Create the IAP key now (yes)?
- Account deletion: turn the 30-day erase on after reading the purge list (yes, after the first real closure);
  erase analytics rows (yes); mention 400-day monthly backups in the policy (yes); recompute
  identity_public_profile (yes, follow-up); website /delete-account page (yes); Apple sign-in may re-admit a removed
  phone like Google (yes, built); store the Apple refresh token encrypted (optional follow-up).
- Ads (iOS): ATT prompt timing (not on first open — built); banner fixed 320×50 vs adaptive; **Google requires a
  consent message (UMP) for EEA/UK on both platforms — not built on Android either**; no Meta mediation on iOS.
- Android upload-key certificate says CN=Apptrick — changing it means an upload-key reset in Play Console (owner).

## 8. Things decided today (2026-09-14/15) — do not re-ask
- NoData alerts: diagnosed (124 clean minutes, 66 deploy gaps, 7 real) and fixed, not silenced.
- Template-missing sync refusals: all 4 invoices reached the server; product-deleted-before-push fixed in 1.4.6
  (0108); clientless drafts never go to the server — no nullable client on the server (0109).
- Share-loop events: `entry` on shared_invoice_opened (1.4.6), `iv_doc` on web events (0110).
- Account deletion: closed at once, erased after 30 days (0111). iPhone premium via StoreKit (0112). Sign in with
  Apple (0113). iPhone-only first release. iOS ads like Android, test ids until the owner sends real ones.
- Privacy policy answers: support@invotick.com; Flixotech LLC operates, Touchpedia LLC publishes on Play; contacts
  wording kept; server EU (France); UXCam = analytics only (recording was off); 30-day promises kept; Wyoming law.
- **"Apptrick" is not involved in Invotick — remove the name everywhere** (done in code on branches; outside code:
  Vercel team name, Android cert CN, Slack workspace).

## 9. Dated checks
- Invoice date repair (0093, runId `84e1a19e…`): 24 h check was due 09:20 UTC 09-15; 7 d check 2026-09-21.
- 24 h after 1.4.6 is live: re-count SyncV2 alert lines (account `3badd5c9`: 3 products never on the server) and
  the 563374d0 products/lines.
- Tonight 00:00 UTC: nightly disk-IO spike (36–48%); 09-13 hit 75% and exhausted the DB pool — watch.
- `memory/reminder-clean-orphan-lines-after-146.md` once 1.4.6 spreads.

## 10. Traps learned this week
- **zsh**: `"$B:refs/..."` is read as a `:r` modifier — write `"${B}:refs/..."`. Unquoted `$VAR` is not split.
- A background agent can stop "waiting for a watcher" that never fires — check `pgrep`/the Gradle lock and nudge it.
- Gradle may restore tests **FROM-CACHE**; to prove tests, run with `--rerun` and count the XML results.
- Public `/actuator/prometheus` answers 403 — read metrics from inside the box at 127.0.0.1:8085.
- Grafana loads alert provisioning only at start — `docker restart grafana` after a rules deploy.
- iOS build verdict is Xcode's, not Gradle's; use a concrete Simulator id, not a generic destination.

## 11. Credentials on this Mac (locations only — never print values)
GitLab API token: `memory/gitlab-api-token.md` · admin API token: `memory/admin-api-token.md` (old agent token is
dead; the owner mints a new one) · VPS read-only key `~/.ssh/invotick_ro` · App Store Connect Admin API key
`~/.appstoreconnect/private_keys/AuthKey_STX8X43K43.p8` (issuer in the old iOS scripts / memory
`ios-release-signing-and-upload.md`) · Android signing via `invoice-kmp-app/local.properties` (INVOTICK_* keys).
Git credentials are in the macOS keychain. **Anyone using this Mac user has these — the owner should know.**
