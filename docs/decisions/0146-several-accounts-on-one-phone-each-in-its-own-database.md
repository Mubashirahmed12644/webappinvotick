# 0146 — Several accounts on one phone, each in its own database, switched from the drawer

**Date:** 2026-09-21
**Status:** **APPROVED 2026-09-21 — build now; ships in 1.4.9** (was 1.4.8 until the owner's footer hotfix took that
number the same day; see "The release number" at the end). The owner: *"abhi — aur live version 1.4.7 hai to tum
1.4.8 hi consider karo, wo hamara next live version hoga"*; shown that this holds the ready fixes back, he chose *"sab
1.4.8 mein, 4 hafte baad"*. Being built on app branch `VC_108_VN_149` (see "The owner's decision" at the end).
**Tier 1** where a switch could mix or lose data (the local database, the outbox, a guest's only copy), Tier 2 for
sync. Owned by the sync agent (0051).
**Related:** 0053 (a guest's work joins an account only on a yes), 0143 (a purchase follows its phone's newest account,
3 moves in 12 months — built, not deployed), 0144 (a reinstalled phone shows its previous accounts; a guest comes back
only with proof — built, deploying), 0145 (a phone linked to a guest is a guest), 0041 / 0047 (premium on the account
vs on the device), 0086 (the server keeps each phone's last pull), rules 11, 24, 28, 39 and 40 of
`.claude/agents/sync.md`.

## The owner's words

> "Side bar menu main multi user selection aur switch rakhni chahiye." (2026-09-21) — then: "pehle naqsha aur ginti".

The lead's view, to be tested rather than repeated: worth doing, but properly (one local database per account, so a
switch can never mix data), after 1.4.8, on top of 0144's returning-accounts list.

## What the data says (production, read-only, 2026-09-21)

Window: 90 days, 2026-06-23 → 2026-09-21 UTC. Source: `analytics_sessions_v2` (one row per app session, with the
account signed in when it started), cross-checked with `linked_device` (from 2026-07-20). Left out: the all-zero id,
`testing_devices`, and our own phones (memory `internal-test-accounts-and-devices`, plus 0145's Samsung `5144be8f` and
Pixel `e2c25d6f`).

### Who has more than one account on a phone

| | Count |
|:--|--:|
| Phones with a session in 90 days | 5,757 (Android 5,756, iOS 1) |
| Phones that used 2 or more accounts | **134** (2.3 %); 15 used 3 or more |
| — the same, from `linked_device` (live rows seen in 90 days) | 169 of 5,688 |
| Account changes on those 134 phones | 185 |
| — guest → new guest (reinstall or reset churn, 0144's case) | 96, on 56 phones |
| — guest → signed-in (a sign-up or sign-in; 0053 moves or asks) | 77, on 76 phones |
| — signed-in → guest (a sign-out) | 7, on 7 phones |
| — signed-in → another signed-in account | **1**, on 1 phone |
| Phones with **2 or more signed-in accounts** | **1** by sessions, **0** by `linked_device` |
| Phones where 2 or more accounts each hold a live invoice | 10 (one is our QA phone `cb77f607`); none has two signed-in accounts with work |

### Who switches back and forth (A, then B, then A again)

| | Phones |
|:--|--:|
| An account came back after another account on the same phone | **4** |
| — of them, our QA phone (`cb77f607`, account `edd209ed`) | 1 |
| — signed-in account → sign-out (a fresh guest) → the same account again | 3 (`22aa877f`, `3dce7f62`, `4a06cf71`) |
| — of those, the return came 1 h or more after leaving | 2 |
| **Two accounts that both hold work, used in turns** | **0** |

The three real returns are one person with one account who signed out and signed back in. On `22aa877f` a second
signed-in account (`488fb982`, 0 invoices) was opened for one session in between; its account with 211 invoices is the
one it came back to.

One phone (`a11d4425`, not on our test list) made **26 guests in 25 days**, 1 of them later signed up. It is reinstall
or data-clearing churn, the kind 0144 answers, not account switching.

**Limit of this count:** today a switch costs a sign-out, which erases the phone's copy once it is sent (0013), and a
guest cannot come back at all before 0144. So people who would switch may have stopped trying. The count measures
today's use, not the wish. **The signal to watch after 0144 is live:** `returning_accounts_answered` — how often a
reinstalled phone picks an older account over "Naya shuru karein", and how often the picker lists 2 or more
signed-in accounts.

### Businesses: the switch people may already have

| Accounts active in 90 days | 6,226 |
|:--|--:|
| with a business | 3,250 |
| **with 2 or more live businesses** | **173** (42 with 3 or more) — guests 144, signed-in 29 |
| **invoicing from 2 or more businesses** | **79** — guests 60, signed-in 19 |

The drawer's business selector already serves 173 accounts, more than every multi-account phone together (134), and it
is the likely reason a shop owner would want a second account at all: a second business.

### Found while measuring

- **The phone's push token is already on more than one account.** `users.notification_tokens` is a comma list, a
  sign-in adds the phone's token and nothing removes it at sign-out (`AuthService.updateNotificationToken` only
  replaces an old token when the phone names it). **77 phone tokens sit on 2 or more accounts** (of 4,061 accounts
  holding one). So today a phone can be told about an approval for an account it left.
- **One database already holds more than one account on some phones**, by design: a guest the user kept apart (0053
  "No"), a linking phone's own earlier guest (0145, open), and a signed-out account parked until its work is sent
  (`AccountDataPurger`). Its own comment says the safety of that "rested on every query everywhere remembering to
  filter by userId".

## What the code says (app `VC_107_VN_147` @ `64106a7f`)

- One Room database, `invotick_v2.db`, version 5, 29 tables. The 21 synced tables and `sync_queue` carry `userId`;
  `received_invoices` deliberately has none (device-local).
- **667 queries in 35 DAOs; 20 of the 35 never name `userId`**: payments, invoice-payment links, payment
  instructions, taxes, terms, templates, headers, backgrounds, stamps, signatures, expenses, merchants, categories,
  unit types, estimate lines, image metadata, reminders, the sync log, received invoices and the stats DAO. Many
  scope by business instead, which is safe only while every business belongs to the signed-in account.
- The database is a single Koin binding; 38 DAO and database bindings in `sharedModule.kt` hang off it, as do the sync
  handlers and the Android workers (`SyncWorker`, `SyncPushWorker`, `SyncPullWorker`, the two image workers).
- Phone-wide settings that are really per account: `default_business_id` (0145 found it pointing at another
  account's business), the pull bookmark and full-pull flags (`StoredSyncMetadata`), the removed-phone gate
  (rule 28), the drain tokens.
- Analytics keeps its own database (`analytics.db`). A batch whose `userId` was empty at queue time is filled at
  **send** time from the account signed in then (`AnalyticsApiImpl`, "UserIdEnrich").
- The DB file was renamed once (`invotick.db` → `invotick_v2.db`, around 1.3.8) and every phone's local data was
  abandoned. The file is never renamed again (`AppDatabase.kt`'s rule comment).

## Question 2 — the local data model

| | (a) One database per account | (b) Wipe and download on every switch | (c) One database, an account column on every row |
|:--|:--|:--|:--|
| **Mixing risk** | None by construction: the other account's file is closed. A missed filter cannot show a stranger's row, because the row is not in the open file. | None after the wipe; everything rests on the wipe finishing. | Every one of 667 queries, and every future one, must filter. 20 DAOs do not today. One miss shows a stranger's invoice. |
| **Unsent outbox at the switch** | Stays in its own file, with its own owner; sent later under that account's own pass (the drain path that exists). Nothing is lost, and it can never be sent under the wrong account. | Must be sent **before** the switch, or it is destroyed. Offline, the switch must be refused. A guest's never-sent work (most users are guests) would be at risk on every switch. | Stays in the one queue, tagged with its owner; the push must filter by owner (7 of 17 queue queries name `userId`). |
| **Disk** | One file per account: a few MB each for a normal account (images are files, kept per account). Cap 5 accounts. | Smallest: one account at a time. | One file; the same rows as (a). |
| **Switch time** | Close one file, open another: under 1 s, offline too. | A full pull: seconds to a minute, **online only**, and rule 26: the server's copy replaces the phone's. | Instant, but every screen must re-read with the new owner. |
| **From today's single database** | `invotick_v2.db` is **not renamed or split**: it becomes the home of the account signed in at the update. Every new account gets its own file. Guests kept in the old file (0053 "No", 0145's left-behind guest, parked accounts) stay where they are, exactly as today, until stage 3 moves each out by copy, count check, then delete. | Nothing to migrate, but the first switch wipes whatever else sits in the file. | A Room migration (Tier 1) plus an audit and a filter on every query; the rows already have the column. |

**Recommended: (a), one database per account.** It is the only model where a mistake in one query cannot mix two
accounts, and where an unsent write cannot be lost or sent under the wrong owner, offline or not. (b) is rejected: a
switch would destroy a guest's unsent work, needs the network, and would pour the server's copy over the phone's
(rule 26). (c) is rejected as the separation mechanism: it asks 667 queries, and every future query, to stay perfect.
It stays only as it is today, inside the legacy file.

How (a) is laid out:
- **An account register on the phone** (`accounts` in an encrypted store: Android Keystore-backed, iOS Keychain,
  "this device only"): account id, kind (guest / Google / Apple / email), masked label, Invotick ID, its pass, its
  database file name, last used. At most 5 accounts.
- **One Koin scope per account.** The database, its DAOs, the sync handlers, the outbox and the per-account settings
  (default business, pull bookmark, full-pull flags, removed-phone gate) live in the scope. A switch closes the scope,
  which closes the file, and opens the next. Nothing outside the scope may hold a DAO.
- **Files:** `invotick_v2.db` for the account that owned the phone at the update; `invotick_acct_<account id>.db` for
  each new one, each with its own Room version history (the same schema and migrations, so all files move together).
  Images for a new account go under `files/accounts/<id>/`.
- **Removing an account from the phone** runs `purgeOrDefer` on its file: the file is deleted only when nothing is
  owed; otherwise the account is parked and drained with its own pass, as today.

## Question 3 — switching back to a guest

**Keep the guest's pass on the phone; no proof while the phone still holds that guest.** A guest's pass is minted from
its own id (`POST /v1/auth/login-as-guest`), and a phone holding the guest's database file already holds all of its
work. A question there would guard nothing the phone does not already show, and a guest who fails it would be locked
out of their own work on their own phone.

- The guest's id and pass live in the register (Keystore / Keychain), never in a backup (Android backup rules must
  exclude it; 0144 found `allowBackup="true"` with no rules). A new pass is minted from the stored id, naming the
  phone (rule 28), when the old one expires.
- **0144's proof stays for the other case only:** a guest this phone no longer holds (after a reinstall). In the
  switcher that is the "Pehle wale accounts" row under "Account jorein", which runs 0144's flow unchanged.
- A phone the guest removed (rule 28) keeps the guest in the list, marked "Is phone se hata diya gaya"; a tap
  explains, it never signs in.
- A guest that has since joined an account (0053) drops out of the list; its account is offered instead.

## Question 4 — what each part must know about the active account

| Part | Must know | If it keeps the old account |
|:--|:--|:--|
| **Premium (0041, 0047, 0143)** | Android: Play's flag is the phone's, so ads stay off for every account on a premium phone (0047 already says another account's purchase makes this phone premium). The server grant of account A never becomes B's. | **0143 would burn the purchase's moves.** Its launch restore runs as the signed-in account and moves a guest's purchase by itself. Switching guest A → guest B → A would move it twice: 2 of its 3 moves in a year, for nothing. **Guard: a switch never runs the restore's move; the server's "newest account" is the account that most recently *joined* the phone (`linked_device.first_seen_at`), never the one active now.** |
| **Ads** | Only premium (above) and consent, which is the phone's. | Nothing, once premium is right. |
| **Analytics** | Each event's account at the moment it is recorded; a switch ends the session (`session_break`) and starts a new one under the new account. The queue is flushed before the switch. | Events recorded under A but sent after the switch are filed under B (`AnalyticsApiImpl` fills an empty `userId` at send time). Every per-account funnel would absorb the other account's steps. |
| **Notifications (FCM token)** | The phone's token belongs to **every** account in the register, and to no account removed from it. Each notice names its account; a tap on another account's notice asks "Account badlein?". | Today already: 77 tokens on 2+ accounts, never removed at sign-out. A notice for account B opened while A is active would open a document A's file does not hold, or none. |
| **Share links** | A link is minted, edited and revoked under the account that owns the invoice, with that account's pass. `received_invoices` stays the phone's, shown under every account (it is what this phone received). | A re-share after a switch would ask the server with the wrong pass: refused as someone else's record (an OWNERSHIP_VIOLATION class), or worse, a link is revoked by nobody. |
| **Offline HTML renderer** | Nothing of its own: it renders the snapshot it is given (invariant 2). The snapshot must be built from the open file. Any cached preview is keyed by invoice id, which is unique across accounts. | Only through a stale snapshot: a preview screen left open across the switch must close. |
| **Background sync (WorkManager, iOS `BGAppRefreshTask`)** | Each job is bound at enqueue to **one account id** and opens that account's file with that account's pass. The background pass pushes every account that owes work (outboxes never wait for a switch) and pulls only the active account. | A worker started under A that runs after the switch would push A's queue with B's pass — every record refused as another account's (rule 24's guard), or pull B's records into A's file. |
| **Sync bookmark (0086)** | Per account and per phone on the server, already 0086's design; on the phone it moves into the account's scope. | One bookmark for two accounts: each switch would skip or re-pull records. |
| **Removed-phone gate (rule 28)** | Per account. | A removal by account A would silence account B on the same phone. |

## Question 5 — the drawer

The drawer header becomes the account switcher; the rest of the drawer is unchanged. It follows 0144's picker rows
(kind letter, masked Invotick ID, count), not Instagram's photos and names: the same privacy reasoning as 0144 §1, a
phone is often shared.

Closed (today's header area):
```
┌──────────────────────────────────────────┐
│ (G)  Guest · Invotick ID 922440441  [⧉]  │
│      Sign in to save your data           │
│      [ Sign In ]   [ Create Account ]    │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ◉ 2 accounts is phone par         ▾  │ │  ← new row, only when 2+
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ▦  Premium Testing                ▾  │ │  business selector, unchanged
│ └──────────────────────────────────────┘ │
```

Open (a sheet, not a new screen):
```
┌──────────────────────────────────────────┐
│  Accounts                                │
│ ┌──────────────────────────────────────┐ │
│ │ (G) Guest · •••441           ✓ Abhi  │ │
│ │     3 invoices                       │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ (E) Email · a•••@gmail.com         › │ │
│ │     Invotick ID •••914 · 12 invoices │ │
│ │     2 cheezein bhejni baqi           │ │  ← only when its outbox is not empty
│ └──────────────────────────────────────┘ │
│                                          │
│  [ + Account jorein ]                    │
│  Is phone se account hatayein            │  text button, bottom
└──────────────────────────────────────────┘
```

- **"Account jorein"** opens: sign in with Google / Apple / email, "Pehle wale accounts" (0144's list, if any) and
  "Naya guest". **It never runs 0053's move:** the current guest stays a separate account. The drawer's existing
  "Create Account" on a guest keeps 0053 exactly (the guest's work becomes the account's). Two doors, two meanings,
  each said on its button.
- A switch shows a short full-screen wait ("Account badal raha hai…") while the outgoing account's queue is flushed
  for at most 5 s, then the dashboard of the new account. Never a half-drawn screen of the old one.
- `LAYOUT_RULES.md`: rows use `heightIn(min =)`, masked IDs shrink and never truncate, a row wraps at font 1.5, the
  sheet's open state is `rememberSaveable`, width from `LocalWindowSize`.
- Events (reviewed by the user-journey agent before any build): `account_switched` (`from_kind`, `to_kind`,
  `accounts_on_phone`, `outgoing_unsent`), `account_added` (`kind`, `door` = `sign_in|returning|new_guest`),
  `account_removed_from_phone` (`outcome` = `purged|parked`).

## Question 6 — size and order

| Stage | What | Server | Android | iOS |
|:--|:--|--:|--:|--:|
| **0 — before anything** | 0144 live (server + 1.4.8) and 0145 live; 0143 deployed **with the switch guard** ("newest" = newest to join the phone); 1.4.8 on most phones. | 1 | — | — |
| **1** | The register, one Koin scope per account, one file per new account, the legacy file kept as is; switch between **signed-in accounts and the current guest**; workers bound to an account; analytics flush + session break; the drawer sheet. | 1 | 10–12 | 3 |
| **2** | Background pass pushes every account that owes work; notices name their account and the token follows the register (add and remove); "Pehle wale accounts" inside "Account jorein"; remove-from-phone. | 2 | 3–4 | 2 |
| **3** | Guests kept inside the legacy file (0053 "No", 0145's left-behind guest) moved out into their own files — copy, count, then delete — so they become switchable. On the owner's go, with counts. | — | 3 | 1 |
| **Total** | | **~4 days** | **~16–19 days** | **~6 days** |

The app is Compose Multiplatform, so the drawer, the register logic and the scope are shared; iOS's own part is the
Keychain register, the per-account database path and the background pass.

A guard test per stage, red first: two accounts' files on real Room never show each other's rows through any DAO; an
unsent write survives a switch and is sent under its own account only; a worker enqueued for A never opens B's file;
a switch never moves a purchase; events recorded before a switch keep their account.

## Question 7 — risks, ranked

| # | Risk | Guard |
|:--|:--|:--|
| 1 | **Data mixing** — one account's rows shown or sent under another. | Model (a): the other account's file is closed; nothing outside the account scope may hold a DAO (a test fails on any DAO resolved outside it). |
| 2 | **A guest's unsent work lost at a switch or a removal.** | The outbox never leaves its file; a file is deleted only by `purgeOrDefer` when nothing is owed; the background pass drains every account. |
| 3 | **The legacy file** — the migration that makes it one account's home. | No rename, no split, no schema change in stage 1: it is only registered. Room migrations stay additive (invariant 5). |
| 4 | **A background job under the wrong account.** | Jobs carry an account id and open only that file with that pass; a job whose account left the register ends quietly. |
| 5 | **0143's moves burned by switching.** | "Newest account" = the one that most recently joined the phone; a switch never calls the move. Stage 0 prerequisite. |
| 6 | **A phone handed to someone else** sees every account in the list. | Masked rows only (0144); a guest's work is already visible to whoever holds the phone today; an optional app lock is a separate decision. |
| 7 | **Notices and analytics under the wrong account.** | Notices name their account; analytics flushes and breaks the session before a switch, and stamps the account when an event is recorded. |
| 8 | **"Account jorein" read as "join my work to it".** | Two buttons with two meanings: "Create Account" moves the guest's work (0053); "Account jorein" never does. |
| 9 | **Disk on a small phone.** | At most 5 accounts; the size of each is shown before removal. |
| 10 | **Effort spent where the data shows no use.** | Stage 0 first, and the go only on a demand signal (below). |

## Recommendation

- The lead's model is right: **if** it is built, one database per account, after 1.4.8, on top of 0144's list, and
  never (b) or (c).
- **But the count does not support building it now.** In 90 days, 1 phone of 5,757 used two signed-in accounts, and 0
  used two accounts with work in turns. The business selector already covers 173 accounts with 2+ businesses. The
  multi-account cases that do exist (134 phones) are reinstall churn and sign-ups, which 0144 and 0053 already answer.
- So: keep this design on file, build stage 0's 0143 guard anyway (it is needed by 0144 alone: a reinstalled phone
  choosing an older guest is also a "newest account" question), and decide on stage 1 after 0144 has been live 4
  weeks, from `returning_accounts_answered` and a recount of this table.

## Rejected

- **(b) wipe and download on every switch** — destroys a guest's unsent work, needs the network, and rule 26 pours the
  server's copy over the phone's.
- **(c) one database with an account filter on every row** as the separation — 667 queries, 20 DAOs without the
  filter today, and every future query must stay perfect.
- **Splitting or renaming `invotick_v2.db` at the update** — the one rename in the app's history abandoned every
  phone's local data.
- **A proof question to switch back to a guest the phone still holds** — it guards nothing the phone does not already
  show, and can lock a user out of their own work.
- **Instagram's photo-and-name rows** — the same reason as 0144 §1: a shared phone would show a stranger whose
  business it was.
- **Letting "Account jorein" run 0053's move** — it would turn an extra account into a merge the user did not ask for.

## The owner's question

Numbers ke baad: abhi banayein (1.4.9, ~4 hafte ka kaam), ya 0144 ke 4 hafte live rehne ke baad ginti dekh kar faisla
karein? (Recommended: ginti ke baad.)

## The owner's decision (2026-09-21)

- **Build it now**, not after 0144 has been live four weeks (the recommendation above was not taken). His words:
  *"abhi — aur live version 1.4.7 hai to tum 1.4.8 hi consider karo, wo hamara next live version hoga"*.
- **Everything ships together in 1.4.8, about four weeks out.** Shown that waiting holds back fixes that are ready
  today (0124, 0125, 0128, 0129, 0130, 0133, 0136, 0143, 0144, 0145), he chose: *"sab 1.4.8 mein, 4 hafte baad"*.
  Rejected by him: releasing the ready fixes first as a 1.4.8 and the switcher later.
- **The integration branch** is `VC_107_VN_148` (Android 1.4.7 is live as versionCode 106; 1.4.8 takes 107, the first
  code not yet used). Cut from `VC_107_VN_147` `64106a7f` on 2026-09-21 with every ready app branch merged.
- **Stage 0 changes shape:** 0143, 0144 and 0145 no longer precede the switcher by a release; they ride in the same
  1.4.8. The 0143 guard ("newest" = the account most recently joined to the phone) is on its backend branch already.
- Everything else in this design stands: model (a), no rename or split of `invotick_v2.db`, a held guest re-opened
  without proof, stages 1–3, and re-opening an account already on this phone is not a new move under 0143.

### Settled while building (the coordinator, 2026-09-21)

- **Release blocker, not a nice-to-have: every account's pass moves to the Android Keystore / iOS Keychain before
  the release that carries the switcher (1.4.9) ships.** Stage 1 keeps the parked accounts' passes in the app's own settings file (DataStore, where today's
  active pass already lives) as a step on the branch only. 1.4.9 is not released while any pass sits there, and the
  Android backup rules must leave the register out.
- **The app's own questions come one at a time** (`OnePromptAtATime`, app `8efce603`): the returning-accounts list
  (0144), the guest-work question (0053), the removed-phone notice (0099), then the premium question (0143). The one on
  screen is never pushed aside by a later one. A premium question asked for one account goes unanswered and is not
  remembered when another account is opened first, and a change of account never moves a purchase. The switcher's own
  prompts join this order.
- **Two branches that lived only on the owner's Mac are pushed and found already inside 1.4.8**, compared by behaviour
  (every file they change reads the same or newer on `VC_107_VN_148`): `ios/146-gestures-and-background-sync`
  `ee46d4e3` (iOS Koin starts once, background sync pass, WebView stamp drag and pull-to-close) and
  `feat/146-premium-never-taken-back` `a56d8071` (a confirmed grant is never unconfirmed, only Google's named refusal
  is final, billing calls send `X-Device-Id`, no blank-price plan). Nothing of either was merged; both are dead, and
  deleting them is the owner's word.

### The release number (the owner, 2026-09-21, later the same day)

- An urgent hotfix — premium users must not see the Invotick footer on their invoices, plus one crash and two ANRs —
  ships first as **1.4.8** (versionCode 107), built separately from `VC_102_VN_146`; its authors port the fixes onto
  `VC_108_VN_149`.
- So everything collected here, the ready fixes and the switcher, is **1.4.9**, versionCode ≥ 108. The integration
  branch is **`VC_108_VN_149` (canonical)**, cut from `VC_107_VN_147` `64106a7f`. The same work was first pushed as
  `VC_107_VN_148` (left at `2af037ac`, not deleted: deleting a branch is the owner's word). The hotfix must not reuse
  that name, or the owner deletes it first.
- The hotfix's footer change is ported onto `VC_108_VN_149` by its own agent (renderer bundle and snapshot mapper).
- The pass-to-Keystore/Keychain blocker above now blocks **1.4.9**.

### Stage 1 — built and green (2026-09-21), app `VC_108_VN_149` @ `c91225c6`

- **Built:** the register (one file, session and settings per account, one write per switch), the Koin split
  (`accountModules` rebuilt, `phoneWideModules` kept, no type on both sides), `AccountSwitcher` (send what is owed for
  5 s at most, screens let go, sync closes for good, background work stops, analytics session ends, rebuild, adopt the
  session; roll back if the other file cannot open), the drawer row and sheet, "Add an account" (sign in, new guest,
  go back), one wait screen, per-account start without the splash, the kill switch `account_switcher_enabled`, the
  one-prompt-at-a-time queue.
- **Proven by tests (889/889 unit, Android debug build, iOS simulator compile):** no row of one account in another's
  file through the 21 tables and the queue (real Room); an unsent write waits in its own file and goes only under its
  own account; an offline switch does not wait; a held guest comes back with its pass and no question; a sync built
  for one account never runs after the switch; the push token is registered for each account opened; a switch never
  moves a purchase; a premium question for one account goes when another is opened.
- **Server:** stage 1 needed none. 0143's "newest to join the phone" guard is on its own backend branch.
- **Not yet done, on the list:** run on a device in both themes at font scale 1.5; Keystore/Keychain for passes
  (**blocks 1.4.9**); stage 2 (every account's outbox sent in the background, the push token on every account in the
  register, notices naming their account, "Pehle wale accounts", remove from phone); stage 3 (guests inside the legacy
  file moved out, on the owner's go).

### Stage 2 — built and green (2026-09-21), app `VC_108_VN_149` @ `b8427160`, backend `feat/push-token-for-each-account-on-a-phone` @ `52dea8c`

- **The release blocker is built:** every pass — the open account's, every parked account's, the drain passes — lives
  in the vault (Android Keystore AES-GCM, file `invotick_passes` left out of backups; iOS Keychain "this device only,
  after first unlock"), never in the settings file. An updated phone keeps its session and the pass moves; a vault
  that fails keeps the pass where it was and never signs anybody out. Restored from a backup onto a new phone, a guest
  keeps its id and is signed in again by the existing recovery, a signed-in account signs in again. **Still to do
  before 1.4.9 ships: run it on a real phone of each platform** (Robolectric has no Keystore).
- **Parked accounts send their work in the background**, each under its own pass (push worker, background entry, iOS
  background pass); the open account's bookkeeping is untouched; one without a pass waits for its next opening.
- **Found and fixed on the way:** every drain push (a signed-out account's last work, a guest kept apart) moved the
  *open* account's pull cursor, so its next delta pull skipped what other phones had written meanwhile. Only the open
  account's own push moves it now (`faec959e`).
- **Notices:** the server sends each token with `accountId`; a notice for another account on the phone asks to switch.
  The token registration names the phone and its other accounts; the server keeps the token on each that already
  shares it from this very phone (`linked_device`). Builds up to 1.4.8 are unchanged. **Deploy order:** the backend
  branch sits on `fix/a-push-token-speaks-for-one-account` (`877f3dc`, not deployed) and goes with it or after it; no
  migration. The one-time token cleanup of that branch keeps each token only on the phone's last-used account, so run
  it before 1.4.9 spreads, or a multi-account phone's other accounts miss notices until each is opened again.
- **"Pehle wale accounts":** after "Start as a new guest", 0144's list is offered as after a reinstall; an account
  already on the phone goes to its own place.
- **Remove from this phone** (not the open account, not the one in `invotick_v2.db`): its work is sent first; while
  any is unsent nothing is removed; then it is signed out on the server with its own pass and the phone's token.
- **Stage 3 waits for the owner's go:** guests kept inside the legacy file moved out into files of their own.
