# 0146 — Several accounts on one phone, each in its own database, switched from the drawer

**Date:** 2026-09-21
**Status:** proposed — awaiting the owner. Design only; nothing built.
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
