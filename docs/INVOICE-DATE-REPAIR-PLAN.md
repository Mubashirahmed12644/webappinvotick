# Invoice dates the server holds one day early — repair plan

**Status, 2026-09-14:** decided as [0093](decisions/0093-invoices-proven-a-day-early-are-repaired-on-the-server.md); built,
not deployed. Nothing has been written to production.
- **Owner's word:** "Haan, plan banao" (2026-09-14), to plan the repair; "Haan, is tareeqe se" (0093), to build it.
- **Built** on backend `fix/invoice-dates-repair`:
  - `07525b7`: the register (V20260914_06), alone and first. Full suite 900/900.
  - `0bc9b05`: the endpoint, the echo guard, and the week's count. Full suite 921/921.
- **Not built:** §4.4's reading of an old build's midnight. The owner chose a week's count first (0093), and `0bc9b05`
  holds it.
- **The list:** backend `docs/sync/invoice-date-repair-group-a.sql`. It printed 1,745 invoices and 258 owners on
  2026-09-14.
- **Before anything changes,** the owner sees the dry run's exact count and gives a separate go.

**Anchors.** Every file:line below was read on:
- app `VC_102_VN_146` @ `85c29d93` (1.4.6), `VC_96_VN_144` (1.4.5), `VC_93_VN_142` (1.4.2), `VC_90_VN_140` (1.4.0),
  `origin/VC_87_VN_139_Live` (1.3.9), and `9c0b5ac1` (2026-04-20, the last app state before sync v2);
- backend `origin/stage` @ `8dfb5fa` (2026-09-14);
- web `ghdev/main` = `gitlab/main`.

Line numbers move. Re-read before editing.

**Data:** production, read-only, date-ranged, counts only, 2026-09-13 23:00–24:00 UTC.
- **Scope:** live invoices created in 2026 (6,535 invoices, 1,904 owners).
- **Excluded:** our four test accounts and seven test phones (memory `internal-test-accounts-and-devices`).

**Tier 1.** It rewrites a financial date on a guest's only server copy.

---

## For the owner (Roman Urdu, plain words)

**Meri samajh ye hai:** 1.4.0 tak ki app jab invoice ki tareekh server ko bhejti thi, to Pakistan jaise mulkon mein
server ke register mein **aik din pehle** ki tareekh likhi jaati thi. Phone ne sahi dikhayi, server ne ghalat rakhi.
1.4.1 se ye theek hai. Server akela sahi din nahi jaan sakta, kyun ke us ne sirf din rakha, waqt nahi.

**Data kya kehta hai:**

| | Invoices | Log | Server par din |
|:--|--:|--:|:--|
| **A** — May 4 se Aug 23 tak purani app ne likhi, saboot pakka | 1,745 | 258 | aik din pehle |
| **B** — May se pehle ki (2,523), ya baad ki jin ka saboot kamzor (72) | 2,595 | 791 | shayad aik din pehle |
| 1.4.1 ya nayi app ne likhi | 1,602 | 800+ | sahi |
| Baqi (Europe/Africa ke zero wale mulk, America, pata nahi) | 593 | — | sahi, ya faisla nahi |

- **Saboot:** phone ne jo invoice share ki, us ki copy mein phone ki apni tareekh hoti hai. 63 mein se 61 mein server aik din
  pehle tha, aur due date bhi.
- **Nayi baat:** jab bhi app update hoti hai, phone server se saara data dobara utaarta hai aur server ki tareekh apne
  register mein likh leta hai. Is liye jin phones ne update kiya, un par bhi ghalat din dikhne ka imkaan hai. Code yahi
  kehta hai; har phone ka alag saboot nahi.
- **Idea:** Group A ko server par hi aik din aage kar dein, 1.4.6 release se pehle. Phir 1.4.6 ka update khud sahi din
  har phone tak le jayega.
- **Faida:** web aur har nayi download foran sahi. **Nuqsan:** jo phone update se pehle kuch bheje, woh purani tareekh
  wapas bhej sakta hai. Is ke liye server par pehra (§4.3).
- **Sawal:** §7 mein, aik aik kar ke.

---

## 1. What the data says

### 1.1 The mechanism (code)

**Builds up to 1.4.0 save every invoice date as the phone's local midnight.**
- The invoice screen holds the date as a calendar day, defaulting to today (`CreateInvoiceUiState.kt:42`).
- It saves through `LocalDate.toInstant(zone)` = `atStartOfDayIn(zone)` (`core/common/…/Extensions.kt:55-57`), then
  `CreateInvoiceViewModel.kt:697`.
- The mapper sends the value as a UTC instant (`InvoiceEntityMapper.kt:154-155`, `toIsoStringOrNull`).
- The same code is in 1.3.9 and in `9c0b5ac1` (2026-04-20). That one pushed to the old endpoint `sync/push`.
- No create or edit path writes "now". The earlier note that some invoices kept a default "now" is not in this code.

**The server keeps the UTC day.**
- The push reads the date into a `LocalDate` (`SyncV2PushDtos.kt:420-421`; the old endpoint's `SyncDtos.kt:345` does the
  same), and the lenient read of an instant keeps its UTC day.
- The column has been a `DATE` since the first entity (`a486bf5`, 2025-12-04). The time of day is gone everywhere,
  backups included.

**So the direction of the time zone is all that matters.**
- **East of Greenwich,** at any positive offset, a local midnight is the previous UTC day. Every such date lands exactly
  one day early. So does the due date.
- **At UTC+0 and west of it,** the date lands on the right day.

**1.4.1 onwards sends the calendar day.**
- 1.4.2+ sends `toCalendarDateStringOrNull` (`InvoiceEntityMapper.kt:160-161`) and reads a pulled day as local midnight
  (`:204-205`).
- 1.4.1 (vc 91/92) was built outside git. Its data shows it was already right (§1.2).

**Every app update runs a full pull, and a pull takes the server's copy.**
- **The trigger:** since 1.4.2, the first start after every app update asks for a full pull (`AppViewModel.kt:108` on
  1.4.2, 1.4.5 and 1.4.6).
- **Server wins:** a pull replaces a synced invoice unless the phone's copy is more than 1 s newer: a newer server copy
  or a tie goes to the server (`SyncConflictPolicy.shouldKeepIncoming`; `InvoiceSyncHandler.kt:144-165`).
- **Bookkeeping:** the pull also copies the server's `updatedAt` into the phone's `dateUpdated` (`InvoiceEntityMapper.kt:231`).
- **Protected:** an unsent local row is not replaced (`localHasUnsentWork`, from 1.4.2).
- **Why it overwrote:** until 2026-09-11 the server stamped its own clock on creates and updates (rule 3). That is later
  than the phone's edit, so the server's copy won.

**A write made on the server outside a phone's push is skipped by some phones.**
- The delta pull reads `last_synced_at` (`SyncV2PullService.kt:274`).
- A push moves the phone's bookmark to the push answer's time (`SyncV2PushService.kt:208`; app `SyncPushHandler.kt:206-209`),
  and the pull rewinds only 60 s.
- So a phone that pushes before it pulls skips such a write until its next full pull (rule 25; the fix is 0086, decided,
  not built).

**The web shows exactly the stored day.** It reads `YYYY-MM-DD` as a calendar day (`src/lib/format.ts`,
`parseCalendarDate`, live).

### 1.2 The proof from the phones' own shares

Every share link stores what the phone displayed (`shared_invoice.snapshot`: `invoiceDate` and `dueDate`, dd/MM/yyyy,
602 of 633 invoice shares since July).

| Shares | Server against phone |
|:--|:--|
| Made and shared before 1.4.1 (before 2026-08-23 13:39 UTC), east, not written after the share | **61 of 63 one day early**, the due date too (61 of 61). The other 2 match on both |
| Shared in 1.4.1's window by owners on 1.4.1 | 12 of 12 match — 1.4.1 was right |
| Invoices made from 2026-08-28 (1.4.2+) | 484 of 484 match |
| Old invoices shared after the owner moved to 1.4.2+ | only 2: one matches the server, one was written after — too few to test §1.1's update pull |

### 1.3 The stored rows

The stored day **S** is compared with the invoice's local creation day **C**. Since May, C comes from the phone's own
creation time. Most invoices are dated on the day they are made.

| East of Greenwich | S = C | Reads as |
|:--|--:|:--|
| Last written by 1.4.0 (07-02 → 08-23) | 1 of 363 (0.3%) | shifted, as the code says |
| Last written by 1.3.x (05-04 → 07-02) | 29 of 1,382 (2.1%) | shifted |
| Last written before 05-04 (old endpoint; C is the upload time) | 198 of 2,523 (7.8%), guests 177 of 2,260 | mostly shifted, but more same-day dates than the code explains — and it is not the web (guests have no web) |
| Written by 1.4.2+, made after 08-28 | 933 of 1,015 (92%) | right |
| Old invoices sent again later by a 1.4.2+ phone | 332 of 523 | many already put right by that later copy |

### 1.4 Where every live 2026 invoice stands

| Class | Invoices | Owners | Registered (invoices / owners) | Server's day |
|:--|--:|--:|--:|:--|
| **A.** East, last written 05-04 → 08-23 by 1.3.x or 1.4.0 | **1,745** | **258** | 319 / 57 | one day early — **proven** |
| &nbsp;&nbsp;of which 1.3.x (05-04 → 07-02) | 1,382 | 204 | | |
| &nbsp;&nbsp;of which 1.4.0 (07-02 → 08-23) | 363 | 70 | | |
| **B1.** East, last written before 05-04 | 2,523 | 780 | 263 / 50 | very likely early — not proven |
| **B2.** East, last written after 08-23 by a phone never seen on 1.4.1+ | 72 | 11 | 50 / 5 | likely early — not proven |
| Written by 1.4.1 | 38 | 16 | | right |
| Written by 1.4.2+ | 1,564 | 791 | | right |
| UTC+0 or west of Greenwich | 198 | 70 | | right on the server |
| Zone unknown | 167 | 27 | all registered | not judged |
| Never synced, edited on the web after the sync, or no writer | 228 | | | not judged (a web write is right) |
| **Total** | **6,535** | 1,904 | | |

- **A and B together:** 4,340 invoices, 993 owners.
  - By region: Pakistan 1,889 (580 owners), Myanmar 1,387 (30), Africa east of Greenwich 606 (183), India, Sri Lanka,
    Nepal and Bangladesh 275 (115), other Asia-Pacific 96, Europe 44 (summer time only), Middle East, Iran and
    Afghanistan 43.
- **Group A contains no invoice billed in a currency west of Greenwich.**
- **A late day:** no build produces one. East gets an early day or a right one; UTC+0 and west get the right day. The
  few rows with S > C are invoices dated ahead.
- **The Americas** (UTC+0 and west): 198 invoices, right on the server.
  - Builds up to 1.4.0 read a pulled day as UTC midnight, so after a re-download they show the day before. That is on
    the phone, not the server.
  - The "210 invoices, 77 owners" of 2026-09-11 was this phone-side effect. Nothing to repair on the server.
- **Deleted invoices** (819 in 2026) are left alone. 0079 purges them.
- **Payments share the defect in all likelihood.**
  - `payments.payment_date` is a `DATE`, and 1.4.0 sends it the same way (`PaymentEntityMapper.kt:62`).
  - Roughly 535 live payments from 199 owners, east of Greenwich, were last written before 1.4.1.
  - Not measured further: every Payments-screen issue waits for that form's review (owner, 2026-09-13).

### 1.5 The owners' phones (group A; latest analytics event)

| | Owners | Guests / registered | Invoices | Builds |
|:--|--:|:--|--:|:--|
| Active in the last 7 days | 34 | 29 / 5 | 1,194 | 1.4.4 20, 1.4.5 8, 1.4.2 5, 1.4.1 1 |
| Active 8–31 days ago | 26 | 16 / 10 | 158 | 17 on builds with no version code |
| Not seen in 31 days | 198 | 156 / 42 | 393 | — |

B1: 709 of 780 owners are not seen in 31 days (1,906 invoices); 42 were active in 7 days (422 invoices).

Phones active in the last 7 days, all accounts: 1.4.1 15, 1.4.2 879, 1.4.4 1,768, 1.4.5 550.

### 1.6 Who sees the wrong day in group A

- **The web:** 57 registered owners, 319 invoices.
- **Every re-download:** a sign-in on a new phone, a registered account's reinstall, a guest's sign-up followed by another
  phone.
- **Phones that updated to 1.4.2 or later:** by the code in §1.1, they took the server's day at their first start after
  the update. That covers most of the 34 active owners.
- **Share links made from those phones** carry the early day, and a link is frozen (invariant 4). Links made before the
  update carry the right one.
- **Server reports that group by date** (revenue by month, overdue from the due date) are off by a day. An invoice dated
  on the 1st sits in the previous month.

## 2. Corrections to what we believed

**"The phone keeps its own copy, which is right."**
- It holds only until the phone's first full pull after it wrote the invoice.
- Every phone that updated to 1.4.2 or later ran one at its next start. The pull took the server's copy (§1.1).
- **This is code, not proven per phone.** The data cannot see a phone's copy: only 2 shares after an update exist.
- **The data does show some phones got in first.** They sent the right day before the pull (332 old invoices are right
  now), because an unsent row is protected from the pull.

**"Builds up to 1.4.1."** The shift comes from builds up to 1.4.0. 1.4.1 already sent calendar days: 12 of 12 shares,
and 33 of 39 of its rows are same-day.

**"Some invoices kept the default 'now'."** The default is today at local midnight in every app state read (1.3.9, 1.4.0,
2026-04-20). It shifts exactly like a picked day.

## 3. Options

### (a) A 1.4.6+ app pass that re-sends the day the phone shows

**How it would run:**
- **The path:** an UPDATE of the whole invoice with a fresh time, as 0057 does.
- **The version rules it meets:**
  - it passes `checkNotStale`;
  - the clock still decides, because 0042 phase 3 is off;
  - a copy that changes nothing keeps its number (0067);
  - 0058's corrected clock is not built.
- **Once only:** guarded by a one-time flag in the phone's settings, and run before the first pull after the update.

**What it can repair:** only invoices whose phone still holds the right day, and runs 1.4.6.
- **Updated phones are out:** by §1.1, a phone that ran 1.4.2–1.4.5 already holds the early day and would send it
  back as if it were right.
- **The phones still holding right days:** those that never ran 1.4.2+ and never re-downloaded.
  - In group A that is 1 active owner on 1.4.1 in 7 days.
  - Builds up to 1.4.0 cannot run the pass at all.

**Old builds and the web:** nothing reaches old builds. The web is unchanged until a phone runs the pass.

**Risks:**
- **It fights a server repair.** A pass on a phone that still shows the early day puts it back with a newer time.
- **Travel:** a phone that changed time zone shows another day.
- **Two phones** send two days. **A re-install** has nothing to send.

**Measure:** the days re-sent, per phone; the census in §1.4.

**Verdict: rejected.** Its source of truth is mostly gone, and it would undo (b).

### (b) A server rule for the proven subset (group A) — recommended

**A row is provable when all four hold:**
1. **Its last write came from a build up to 1.4.0.** Every app write before 2026-08-23 13:39 UTC did: that is 1.4.1's
   first event, and the rows before it show no same-day dates to speak of (1 of 363).
2. **The writer was east of Greenwich at that time.** The zone is the owner's login zone, and any positive offset gives
   exactly one day.
3. **Nothing wrote the row after:**
   - `last_synced_at` is set;
   - no web edit after the sync (`updated_at` at most 5 s after `last_synced_at`);
   - after 0067, a writer is named.
4. **The era's code is in git** (1.3.9 and 1.4.0 cover 05-04 → 08-23), and the phones' own shares agree: 61 of 63.

Then the day the phone showed is the stored day + 1, for the invoice date and the due date.

**What reaches whom:**
- **The web** shows the right day at once for 57 owners.
- **Phones on 1.4.2–1.4.5** take it at their next full pull (the 1.4.6 update), or at a pull that no push came before.
  Once 0086 is built, they take it at every pull.
- **Builds up to 1.4.0** read the day as UTC midnight. East of Greenwich that shows as the same day, which is right.

**Risks:** §5. **Measure:** §6.

**B1 and B2 are not provable to this standard:**
- no share exists before July;
- 7.8% of B1 already reads as the upload day;
- the app's code before 2026-04-20 was not read.

What would make them provable is a record of the day each phone showed: a share, or a phone that still holds its
first copy. None exists for most of them.

### (c) Leave it as it is

- **The web** keeps showing the day before: 319 invoices in A, 632 in A and B.
- **Every re-download** shows it.
- **Every future app update** hands the early day again to any phone that still holds the right one.
- **Nothing is at risk** of being moved wrongly.

**Verdict:** rejected for A, which is proven and a G3 matter. Recommended for B1 and B2 until a proof exists.

### Also rejected

- **One server rule for every eastern row, B included.** B1's same-day excess and its unread code mean some right dates
  would move a day late.
- **Asking each user.** There is no screen for it, and 709 of 780 B1 owners are gone.
- **Reading the day from the invoice number.** It holds the month only.

## 4. The plan, if the owner says yes to A

### 4.1 Order

1. **The ledger migration, alone and first** (rule 10). It adds the new table `invoice_date_repair` with these columns:
   - invoice id, owner id, run id, group;
   - the old and new invoice date, the old and new due date;
   - the old version, old `last_synced_at` and old writer;
   - `repaired_at`, `undone_at`.
   It touches no existing table.
2. **The backend code, in the next batch:** §4.2–§4.5.
3. **The dry run on production.** It writes nothing and answers exact counts by group, owner, region and build. The owner
   gives the go on those numbers.
4. **The real run,** group A only, **before 1.4.6's staged rollout.** The update's full pull then brings the right day to
   every phone that updates.
5. **Measure** (§6), and undo if anything reads wrong.
6. **B1 and B2** only with a new proof, and a separate go.

### 4.2 The repair endpoint (shaped like R1's `GuestWorkRepairController`)

`POST /v1/webpanel/invoice-dates/repair`, role ADMIN.

- **A dry run** unless the body says `"dryRun": false`.
- **The input** is the exact list the dry-run query produced: `{id, invoiceDate, dueDate, lastSyncedAt}`.
  - The query writes the list to a file on the VPS, and the call reads that file. Ids never pass through chat.
- **One transaction per owner.** A row moves only if it still holds exactly the listed values; otherwise it is skipped,
  with the reason.
- **Each moved row:**
  - both dates move one day later;
  - `version` + 1, and `last_synced_at` = now, so a delta pull picks it up;
  - the writer is nobody, as 0078's receipts do;
  - **`updated_at` is kept.**
    - Stamping the server's clock would make every queued phone edit made before the repair "older than server state",
      so it would be refused (rule 3).
    - Keeping it lets a phone that holds the early day take the repair on a tie.
  - one ledger row.
- **The answer:** counts per group, per owner and per skip reason, never values.
- **Undo:** `…/repair/undo {runId}` restores the old days wherever the row still holds the new ones.

### 4.3 The echo guard, 120 days

- **Where:** `InvoiceSyncV2Service.updateFromSync` (`FinancialSyncV2Services.kt:272-273`).
- **The rule:** a copy of a repaired invoice may carry exactly the ledger's old invoice date and old due date while the
  row holds the new ones. The row then keeps the new dates and takes every other field.
- **Why it is an echo:** only a phone that has not yet pulled the repair holds exactly those two old days. They are the
  days §1.2 proved wrong.
- **Evidence:** counted as `invoice_date_repair_echo_total{build}`, logged at INFO and never at ERROR. Grafana's
  `invotick-sync-failure` rule pages on one ERROR line.
- **With 0067:** a copy whose only difference was the dates then changes nothing and keeps its number.

### 4.4 Old builds that still write (evidence first)

- **The counter:** `sync_invoice_date_shape_total{shape=calendar_day|instant_local_midnight|instant_other, build}`.
- **The reading, behind a switch that defaults to off** (the pattern of 0056's `EstimateDayGate`):
  - an instant that falls exactly on a quarter hour, with zero seconds, is a local midnight;
  - its day is the next UTC day when the UTC time is 12:00 or later, otherwise the same UTC day;
  - that is exact from UTC−11:45 to UTC+12:00. No owner is beyond that.
- **Not needed for the repaired rows,** because §4.3 covers an old build's edit of them. It matters only for new invoices
  from phones on 1.4.0 or older.

### 4.5 Guards — each fails first on today's code

- **`AnInvoiceDateRepairMovesOnlyTheListedRowsTest`:**
  - a dry run writes nothing;
  - a real run moves exactly the listed rows by one day, both dates;
  - `version` + 1, and `last_synced_at` moves;
  - `updated_at` survives a following query and a fresh read-back (rule 3);
  - a second run changes nothing;
  - a row changed since the list is skipped;
  - undo restores.
- **`ARepairedDateIsNotSentBackTest`:** an old-days copy keeps the new days and applies its other fields. Any other date
  applies as sent.
- **`AnOldBuildsMidnightIsItsDayTest`:** Karachi, Kolkata, Yangon, UTC and New York midnights. A non-midnight instant is
  read as today. A calendar day is read as itself.
- **App, `ARepairedInvoiceDateReachesThePhoneTest`** (Robolectric, real Room, `SyncRoomFixture.pull`):
  - a phone holding the early day, with `dateUpdated` equal to the server's `updatedAt`, takes the repaired day on a tie;
  - a phone with an unsent edit keeps its edit;
  - it tests shipped code, so it needs no release.
- **Suites:** the backend suite at its `stage` baseline, including `SpringContextBootTest`. App `:data:testDebugUnitTest`.

## 5. Risks and guards

- **A phone whose own copy changed:**
  - *It took the early day in an update's pull.* It gets the repair at its next full pull, and until then §4.3 turns its
    edits' old days into echoes.
  - *A build up to 1.4.0 pulled its own copy back and then edited.* That drifts a second day, and the rule restores only
    one.
    - It cannot be detected, and it is rare: those builds pulled their own rows back only at a sign-in.
    - The 2 shares of 63 that match the server may be this.
- **Two phones:** 2 of 1,107 writing accounts, both ours. Both pull the same row, and §4.3 covers either.
- **Re-installs:** a registered account's full pull brings the repaired day. A guest's reinstall is a new guest, so
  nothing changes.
- **Time-zone travel:** the zone is the owner's last login, not the zone at the write.
  - A phone that moved from west to east after writing would be repaired wrongly.
  - Group A holds no invoice in a western currency. The dry run lists any owner whose login zone and invoice currencies
    point in opposite directions, and today there are none.
- **The pull bookmark:** a phone that pushes before it pulls skips the repair until a full pull (rule 25).
  - The 1.4.6 update's pull and 0086 carry it.
  - §4.3 keeps the web right meanwhile.
- **A deliberate change to exactly the old days** within 120 days would be kept at the repaired days. That is
  implausible, and it is counted.
- **The owner's figures move.** An invoice dated on the 1st returns from the previous month to its own.

## 6. How to measure

**Before (today):**
- groups A, B1 and B2 as in §1.4;
- 61 of 63 old shares one day early.

**After the real run** (6 h, 24 h, 7 d; read-only and date-ranged):
- **The ledger:** its count equals the dry run's.
- **The census:** re-run §1.4. Group A has 0 left, apart from the skipped rows, each with its reason.
- **Reverts:** ledger rows back at their old days. Expect 0.
- **Echoes per build per day,** normalised by the build's active phones. These are the phones not yet reached. They
  should fall as 1.4.6 spreads and 0086 ships.
- **Shares of repaired invoices:**
  - the snapshot's day equal to the server's means that phone has taken the repair;
  - one day earlier means it has not yet.
- **Unchanged:** STALE_CONFLICT devices per active device, and no ERROR line containing `SYNC`.
- **Health Centre:** one line, repaired / skipped / echoes kept / reverts (an existing card or a new `HealthCheck`, never
  a page).

**Once 1.4.6 is on most phones:** re-read B1 and B2.

## 7. The owner's questions — one at a time, recommendation first

1. Group A ki 1,745 invoices (258 log) ki tareekh server par aik din aage kar dein, pehle dry run ki exact ginti dekh kar?
   **Mashwara: haan.**
2. Group B ki 2,595 invoices abhi na chheden, jab tak har aik ka saboot na mile? **Mashwara: haan, abhi chhor dein.**
3. Ye kaam 1.4.6 release se pehle ho, taake update khud sahi tareekh har phone tak le jaye? **Mashwara: haan.**
4. Server par aik chhota naya register (table) banaen, jis mein har badli hui tareekh ki purani aur nayi tareekh likhi ho,
   taake zaroorat par wapas kar saken? Ye pehle akela jayega. **Mashwara: haan.**
5. Agar koi phone purani ghalat tareekh wapas bheje, to server nayi tareekh rakhe aur baqi tabdeeli le le — 120 din tak?
   **Mashwara: haan.**
6. 1.4.0 ya is se purani app wale phone ab bhi kabhi tareekh bhejte hain. Pehle aik hafta sirf ginti karen, phir faisla
   karen ke server un ki "raat 12 baje" wali tareekh ko sahi din samjhe? **Mashwara: haan, pehle ginti.**
7. Payments ki tareekh mein bhi yahi masla lagta hai (takreeban 535 payments). Ye Payments form ke review tak ruka rahe?
   **Mashwara: haan, ruka rahe.**

## 8. Rules this proposes (for `.claude/agents/sync.md`; not written there)

1. **An app update's full pull puts the server's copy over every synced record, and a tie goes to the server.**
   - Evidence: `AppViewModel.kt:108`, `SyncConflictPolicy`.
   - A wrong value on the server reaches every phone at its next update.
   - Fix the server before the release that updates the phones.
2. **A server-side repair of synced rows:**
   - keeps the device's edit time;
   - moves the receipt: `version` + 1, `last_synced_at` now, writer nobody;
   - keeps a ledger of the old values;
   - is a dry run by default, and runs one owner per transaction;
   - waits for the owner's go on the dry run's exact counts.

   A copy that brings a repaired record's old values back is an echo, and the repaired values stay.

## Appendix — the classification, exactly

- **Scope:** invoices created 2026-01-01 → 2026-09-15, excluding:
  - owners `qatester935@gmail.com`, `talhayounas665@gmail.com`, `test27@gmail.com` and `test28@gmail.com`;
  - rows whose last writer's id starts `0c4dfc92`, `adba2cfe`, `aea3c770`, `8d2b3d6c`, `800c50dd`, `edc7136c` or
    `93b5a382`.
- **Zone:** `users.last_login_ip` → `ip_records.timezone` → the offset in minutes at the time of the row's last write.
  - Europe's summer time runs 2026-03-29 → 10-25. Morocco's Ramadan window is left out.
  - East means an offset above 0.
  - An IANA zone that is not listed is unknown.
- **The class, first match wins:**

```sql
CASE
  WHEN is_deleted = 1                                              THEN 'deleted'
  WHEN last_synced_at IS NULL                                      THEN 'never_synced'
  WHEN updated_at > last_synced_at + INTERVAL 5 SECOND             THEN 'web_edit_after_sync'
  WHEN last_synced_at >= '2026-09-12 19:13:00'
       AND last_modify_by IS NULL                                  THEN 'no_writer'
  WHEN last_synced_at >= '2026-08-28 07:36:17'                        -- 1.4.2's first event
       AND (owner_first_vc93_event <= last_synced_at + INTERVAL 1 DAY
         OR writer_first_vc93_event <= last_synced_at + INTERVAL 1 DAY) THEN 'written_by_142plus'
  WHEN zone_offset_at_write IS NULL                                THEN 'zone_unknown'
  WHEN zone_offset_at_write <= 0                                   THEN 'zone_zero_or_west'
  WHEN last_synced_at < '2026-08-23 13:39:04'                         -- 1.4.1's first event
       AND last_synced_at >= '2026-05-04'                          THEN 'A'
  WHEN last_synced_at < '2026-05-04'                               THEN 'B1'
  WHEN (owner_first_vc91_event IS NULL OR owner_first_vc91_event > last_synced_at + INTERVAL 1 DAY)
   AND (writer_first_vc91_event IS NULL OR writer_first_vc91_event > last_synced_at + INTERVAL 1 DAY) THEN 'B2'
  ELSE 'written_by_141'
END
```

- **The first-event times** come from `analytics_events`, 2026-08-20 → 2026-09-15:
  - `owner_first_vc93_event` and `owner_first_vc91_event` by `user_id`, with `app_version_code` ≥ 93 or ≥ 91;
  - `writer_first_…` the same, by `app_instance_id` = `BIN_TO_UUID(last_modify_by)`.
- **The creation day** for §1.3 is `DATE(created_at + INTERVAL offset_at_creation MINUTE)`.
- **The share test** parses `snapshot->'$.invoiceDate'` and `'$.dueDate'` with `%d/%m/%Y`, then `%Y-%m-%d`.
