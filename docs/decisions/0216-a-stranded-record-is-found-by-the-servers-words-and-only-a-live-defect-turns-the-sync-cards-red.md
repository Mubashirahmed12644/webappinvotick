# 0216 — A stranded record is found by the server's words, and only a live defect turns the sync cards red

**Status:** built 2026-10-15 by the sync agent, under the owner's 2026-10-13 rule (*"Real sync failed ka har case report ho,
aur jab bhi report ho hum usay fix karein … jo real nahi hain, fixable nahi hain, unko sync failed mein report nahi
karna"*). **Gradle not run, nothing pushed, nothing deployed, nothing released.**
- Backend `fix/sync-defects-2026-10-15` off `origin/stage` `24f836a` (worktree `kaam/worktrees/invotick-apis-sync2`):
  test `8eac352`, fix `91976a0`, `ddeb864`.
- App `fix/153-sync-defects` (1.5.3, worktree `kaam/worktrees/invoice-kmp-app-153`): test `a158317f1`, fix `af81ef366`.
- No migration, no new event, no new column, no new API field.

**Related:** 0029, 0050, 0053 (rule 24), 0133/0136 (rules 37/38), 0161, 0214; ledger `kaam/research/sync-defects-2026-10-13.md`.

## 1. What production said (2026-10-15 ~09:17 UTC, admin API, read-only)

- Health Centre `sync-failures`: **CRITICAL, "38 sync defects affecting 52 devices"**, worst defect `_request HTTP_401`.
- Health Centre `refused-record`: **CRITICAL, "Account 33a46139: inventoryItems reported failing by the phone 632 times on one
  phone since 2026-09-19 … (UNKNOWN)"**.
- 130 signatures in the 30-day defect view. Every one last seen on 2026-10-14 or 10-15 was traced (§2).

## 2. Each active signature, its verdict and its root cause

Verdicts: **real** (a defect in our code), **aging out** (fixed by work already live), **old build** (only an update cures
it), **not a failure** (noise or a note). Occurrence counts are each row's lifetime count.

| Signature | Size | Verdict | Root cause (evidence) | Fix |
|:--|--:|:--|:--|:--|
| `935db355` inventoryItems UNKNOWN — the **refused-record** card | 27,035 / 8 phones, all vc 101 | **old build** | Not a server refusal at all: source APP, stage `push_gather`, "Product: local row missing for UPDATE". On 1.4.5 a product edited then deleted keeps `PENDING_UPDATE` with `isDeleted = 1`; before every push `SyncOrphanDao.orphanProducts` (no deleted filter) queues an UPDATE, `ProductDao.getProductById` (`isDeleted = 0`) finds nothing, `closeMissingRow` closes it and reports. Every push, for ever. The server never sees the record, so it has no answer it could give. Fixed from **versionCode 104** (`e97bacd05`: the gather falls back to `findForPull`; 103 does not carry it). 0 rows from any later build. | Cards: "Older builds, fixed in a later build" (§3.1). The refused-record card no longer says "the server keeps refusing" for a loop only the phone reports. |
| `3c0e038d` inventoryItems, `3e8fc683` invoiceItems, `dc3301d5` clients — OWNERSHIP_VIOLATION | 149+43 / 5, 175 / 3, 18 / 2; builds 106–116 | **real** (two defects) | (a) The open account is a **guest** whose phone holds records the server keeps under **another guest** "whose work has not joined" (trace `95400aac`: caller `89baed90`, owner `076b57b7`; trace `9d180a7b`: caller `f8cf253c`, owner `7f2c4eb4`). A guest makes no claim (rule 24), so it never joins; the app excluded exactly these from the renumbering (0136) on the premise that "it resolves itself". (b) **0136's renumbering has never matched a production row:** `StrandedRecordDao` asked for `lastError LIKE '%OWNERSHIP_VIOLATION%'`, but a queue row keeps `result.error`, the server's message (`SyncV2PushService`: `error = ex.message`), which never contains the code. `queue_renumbered`: **0 reports in 60 days**. | App `af81ef366` (§3.2). |
| `7c3493e4` clients, `c685b9b2` inventoryItems, `9481164c` invoiceItems — MISSING_ON_SERVER (drift) | 122 / 10, 102 / 7, 174 / 6 | **real**, downstream | Two causes. Products and lines: the same phones as above (`17f1bcf8`: "device 8, server 4", "device 25, server 3") — records stranded under another guest. Clients ("device 6, server 0" on guest `5a98f74c`, …): rows the phone holds SYNCED that the server does not hold under this account, most likely acknowledged under a previous identity and kept SYNCED by 0133 (by design). Not provable from the server: the drift says how many, never which. | 1.5.3 asks by id on a drift that stands (`34d903ce1`); "not held" is offered again; a record another account holds is then refused with its own id and — from `af81ef366` — renumbered. Proven only after 1.5.3's rows are read. |
| `a0b277c5` `_request` HTTP_401 | 336 / 22 | **mostly not a failure; 1 by design** | Guests, one occurrence each, builds 113–116: a stale pass ("bad signature" from before the 2026-09-04 key change; "Invalid authorization header" / "malformed" = an empty or unreadable pass), renewed by the same sync in the same second (ledger #10, 6 of 6 in Loki). The card's "signed in again" rule compared the phone's next accepted call with the row's `last_seen_at`, which is the report's **arrival** — 15–18 min later (the analytics flush) — so it never matched. One registered account (`b21c5b85`, 1.5.2): "Token revoked" ×43 in two days, a session the server ended on purpose. | Backend `91976a0`, `ddeb864` (§3.1). App 1.5.3 already stops a guest's 401 while its renewal runs (`de3dfc827`). |
| `77debb42` backgrounds, `070e7da3` taxes — "local row missing" | 43 / 19, 7 / 6; builds 105–116 | **real, fixed in 1.5.3** | Ledger #20: the screens hard-deleted the row with nothing queued. | App `5a3ec2153` (already on the branch). Card: set aside on older builds once 1.5.3 is on the store. |
| `860764f4` templates SQLException FK 787 | 12 / 6; builds 101–116 | **real, fixed in 1.5.3** | `pull_apply`, ledger #18 — **not** the missing-default-template save failure of `38c9b4942`. That save fix shipped as `39b3e8e87` in `release/1.5.2` (116). The server half (deleted header/background sent, `292584e`) is live; phones up to 1.5.2 drop a deleted parent they never held. | App `ecede64b1` (on the branch). Card: as above. |
| `4efe8752` invoiceItems `subtotal` UNEXPECTED_ERROR (MySQL 1264) | 33 / 2; builds 114, 116; last 10-15 00:57 | **real**, owner decision | A line whose subtotal is out of `DECIMAL(21,4)`'s range (over 10¹⁷). Refused alone (0080), retried, quarantined after 50. The phone lets such a number be typed. | Not built: a cap on money input is the owner's (§5 Q2). |
| `60ca4eb6` invoiceItems `inventoryItemId` INVALID_REFERENCE | 19,591 / 5; live only on one vc 97 phone | **old build** | A line naming a product deleted before it was sent; fixed from versionCode 104 (`e97bacd05`). | Card: set aside (§3.1). |
| `1b06402b` queue_stuck_backlog "0 … cleared", `7c1a0358` queue_revive, `24db3b27` queue_settled_as_held | 71 / 8, 21 / 7, 18 / 18 | **not a failure** | The phone's notes about repairs it made. The refusals behind them have signatures of their own. The cleared-backlog note is read by the stranded-work card, so the app keeps sending it. | Backend `91976a0`: set aside as "the phone's own note about a repair it made"; a backlog that has NOT cleared stays a defect. |
| `881040c2`, `b67ef52c`, `b50d0ad4` CANCELLED; `64ff5a8a`, `e35f03e3` AUTH_TOKEN_REJECTED | no device, no build | **old build / not a failure** | Builds up to 1.4.4 (no evidence). The card already set them aside as older builds; the page listed them as defects. | The page now applies the card's floor; "Job was cancelled" is set aside by name. |
| `56881939` invoices, `1aa018eb` clients — pull_apply FK | 1 / 1 each, one pull, 10-14 | **real, unproven cause** | One guest's full pull sent an invoice and a client whose business (and the invoice's template) it did not send: a deleted parent not sent, or another account's (0053 family). | Watch; 1.5.3 names the missing parents. |
| `fff2771f` stamps, `73bf978e` businesses — "userId does not match" | 13 / 2, 1 / 1; one push, 10-13 | **real, unproven cause** | One guest pass minted 3 s before a push whose rows still carried another owner's id (trace `7d28cc95`): most likely a push racing the re-owning of rows after an identity change. Not recurred since. | Watch; not renumbered (the copy would carry the same owner). |
| STALE_CONFLICT (`dd4386b0`, `1b0a4604`, …), INVALID_REFERENCE chain (`b501272a`, `e2218060`, …) | last seen 10-12 | **aging out** | Fixed by live work: `b36cf58` (identical copy), `cb4875d` (create with no time). | None. |

## 3. Decided and built

### 3.1 Backend — only a defect that shipped code can cure turns a card red

- **`FixedInALaterBuild`**: each sync-failure shape whose root cause a later Android build fixed, with the commit and the
  first build. On an older build the row goes to **"Older builds, fixed in a later build (an update is the cure)"** on the
  Device sync card, the refused-record card and the Sync health page — **only once that build is on the store**
  (`health.sync-failures.released-version-code`, default 116 = 1.5.2). Live now: the product loop and the lines naming a
  never-sent deleted product (both 104). Dormant until 117: screen hard deletes, the template pull FK.
- **Repair notes** and **"Job was cancelled"** are set aside by name.
- **A guest's stale or empty pass** counts as recovered when the phone was accepted again up to **30 minutes** before the
  report's arrival — only a guest (looked up by id), only the phone's own report, only "bad signature", "malformed",
  "Invalid authorization header", "Token expired". Never a registered account. Unknown role gets no allowance.
- **A session the server ended on purpose** ("Token revoked", "This device was signed out.", "This account was deleted.") is
  set aside on its own line with its devices.
- **The page applies the card's floor**, so it no longer lists as defects the rows the card calls older builds.
- **The refused-record card** says "the server has not seen them" when only the phone reports the loop.

### 3.2 App (1.5.3) — a record another account holds gets its own number

- `StrandedRecordDao.strandedRecords` matches **the server's sentence about this record's own id** ("`<Entity> <its id>`
  does not belong to authenticated user."), plus the code for the old test seeds.
- **A refusal for a number the record names** ("… reference `<id>` …", a line's invoice) is never renumbered — a new number
  would be refused again for the same reference on every push. Instead, when the named record is renumbered, such writes go
  back in line in the same transaction (`reviveRefusedFor`), because their reference now names the new number. Without it
  a line stayed TERMINAL for ever: the held-ask (0161) offers a record again at most once.
- **A payload refusal** ("userId does not match") is never renumbered: the copy would carry the same owner.
- **When the open account is itself a guest** (read from storage, rule 47), "belongs to a guest whose work has not joined"
  is stranded too. A registered account's such record is left for its claim, as before.

## 4. Rejected

- **Raising the card's floor** (94 → 104 or 116) to make the cards green. It would hide every defect on those builds,
  including ones no later build fixed; the per-shape list hides only what a named commit cured.
- **Setting a shape aside on a build whose fix is only built, not released.** Until the fix is on the store nothing cures
  the newest build, and the card must stay red for it.
- **Putting 401s in the per-shape list.** 1.5.3 cures a guest's report, not a registered account's stale pass; the row does
  not say which, so the role decides, not the build.
- **Putting the drift in the per-shape list.** 1.5.3's ask-by-id plus the renumbering should cure it, but that is a claim
  until 1.5.3's rows are read.
- **A server-side guest-to-guest claim on push** (move `076b57b7`'s whole work into `89baed90` when the phone proves it held
  both). It keeps ids and leaves no copy behind, but it moves ownership between accounts outside the user's decision — 0053's
  ground. Left as an owner question (§5 Q1).
- **Telling the 1.4.5 phone to stop through the held-ask (0161).** That phone never sends the record and does not run the
  ask (1.4.9+). There is no request to answer.
- **Stopping the phone's repair notes at source.** The stranded-work card reads the "cleared" note; the notes stay evidence.
  Moving them to an event of their own is an event-system change (AGENTS-EVENTS, the user-journey agent), not done here.
- **Renumbering a record refused for a reference.** A loop of new numbers.

## 5. Open — the owner's decisions

1. **Guest-to-guest work on one phone (four guests, 1.4.7–1.5.2 today).** 1.5.3 gives each stranded record a new number
   under the phone's own guest; the other guest's copy stays on the server, unused. Alternative: the server moves the
   other guest's whole work into the phone's guest, proven by the phone, keeping the ids (no copy left). Ownership moves
   between accounts, so it is the owner's word.
2. **A money field's upper limit.** Two phones typed a line worth more than 10¹⁷; the server cannot store it and the line
   is refused for ever. A cap in the app (e.g. 99,999,999,999,999.99 per amount) is a money rule.
3. **When 1.5.3 is on the store**, set `health.sync-failures.released-version-code=117` (and 0214's floor stays 117). That
   is a config change on the box, not a release.

## 6. Numbers to read after the deploy, and after 1.5.3 is wide

- **After the backend deploy:** refused-record → OK (its only red loop, `33a46139`, moves to the older-builds line).
  Device sync stays **red**: the ownership refusals, the drift, the backgrounds/taxes/templates of 1.5.2 and the subtotal are
  real defects on the newest build, and their cure is 1.5.3 or an owner decision. Expect the 401 devices to fall to the
  ones not seen again since their refusal plus the session-ended line.
- **After 1.5.3 is wide and the setting is 117:** `queue_renumbered` reports > 0 for the first time (expect the four guests
  above, then the drift phones); `3c0e038d`/`3e8fc683`/`dc3301d5` from builds ≥ 117 → 0; backgrounds/taxes/templates from
  ≥ 117 → 0; MISSING_ON_SERVER from ≥ 117 falls.
