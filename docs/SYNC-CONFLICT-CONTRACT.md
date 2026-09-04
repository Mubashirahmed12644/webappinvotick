# Sync conflict contract

> **This file is the rule. The two implementations are copies of it.**
>
> - Server: `invotick-apis` — `SyncConflictPolicy.kt`, `AbstractSyncV2Support.checkNotStale`
> - App: `invoice-kmp-app` — `data/src/commonMain/.../sync/SyncConflictPolicy.kt`
>
> Both carry a test file named after this document, with one test per case id below. A change to
> either implementation that is not a change to this file is a bug, and the tests are what say so.

## Why this exists

The app's policy opens with *"Mirrors the server's SyncConflictPolicy exactly"*. That sentence was
the only thing holding the two sides together — the app had **no test for it at all**, while the
server had nine. And it was already untrue: the app has a rule the server does not (L6), and the
server has a fallback the app does not (P5).

A rule that lives in two repositories, in two languages, kept in step by a comment, drifts. The cost
of the drift is not a crash — it is two copies of somebody's invoice that disagree, with nothing
reporting it.

## What is being compared

One rule, applied in two directions:

| direction | incoming | existing | who decides |
|---|---|---|---|
| **PUSH** (device → server) | the device's record | the server's row | server |
| **PULL** (server → device) | the server's record | the device's row | app |

Both compare `updatedAt`, both allow a **1000 ms** tolerance, and both default a missing `existing`
timestamp to the epoch. `version` travels on every record and **neither side uses it to decide.**

---

## Push cases — the server decides

| id | situation | answer | why |
|---|---|---|---|
| **P0** | a record in the body cannot be turned into its DTO at all | reject **that record**, `MISSING_REQUIRED_FIELD`, and read the rest of the body normally | 21 upsert DTOs carry about sixty non-nullable fields between them. One of them arriving null used to fail the **whole request** at Jackson, before a line of service code ran — one device sent that body 250 times in a week and synced nothing at all in between. `SyncV2BatchDeserializer` reads each element on its own and sets the unreadable ones aside. `MISSING_REQUIRED_FIELD` rather than a new error name because every build in the field already knows that one, and almost every real case is exactly that. |
| **P1** | incoming strictly newer | apply | ordinary edit |
| **P2** | timestamps equal | apply | a retry of an operation that was applied is applied again; identical data, so it is idempotent, and refusing it would fail an operation that already succeeded |
| **P3** | incoming up to 1000 ms older | apply | clocks and round trips differ by less than a second all the time; refusing here would reject ordinary edits |
| **P4** | incoming more than 1000 ms older | reject `STALE_CONFLICT` | the server holds something newer |
| **P5** | incoming has no `updatedAt` but has `createdAt` | fall back to `createdAt`, then P1–P4 | a create that never carried an update time is still a real record. **The update path used to throw before ever reaching this rule** — 5 devices and 155 occurrences of `Missing update timestamp` on the live build — so the code disagreed with its own contract in 21 places. It now falls back the same way a create does. |
| **P6** | incoming has neither | reject | nothing to compare; guessing would overwrite on a coin toss |
| **P7** | the server row has no `updatedAt` | treat as epoch → incoming wins | anything beats nothing |
| **P8** | `CREATE` for an id the server already holds | run P1–P4, and on a win continue as an update | the device believed it was new; the server knows better, and the data is still the user's |
| **P9** | `DELETE` | **applied unconditionally — no staleness check exists** | see *Known gaps*, G2 |
| **P10** | any of the above, with `version` present | **ignored** | see *Known gaps*, G3 |

## Pull cases — the app decides

| id | situation | answer | why |
|---|---|---|---|
| **L1** | incoming strictly newer, local `SYNCED` | apply | mirror of P1 |
| **L2** | timestamps equal | apply | mirror of P2; ties go to the server |
| **L3** | incoming up to 1000 ms older | apply | mirror of P3 |
| **L4** | incoming more than 1000 ms older | keep local | mirror of P4 |
| **L5** | incoming has no `updatedAt` | keep local | **differs from P5** — the app has no `createdAt` fallback. It cannot fire today: `SyncV2PullResponse` declares `updatedAt` non-null, so the server never sends a record without one. Recorded because it is a real difference between the two files, and the next person to make the pull DTO nullable needs to find this line. |
| **L6** | the local row has unsent work (`PENDING_CREATE`, `PENDING_UPDATE`, `PENDING_DELETE`, `SYNCING`, `ERROR`) | **never overwrite, whatever the timestamps say** | **the server has no equivalent, and must not.** Only the device has unsent work. A timestamp comparison cannot be trusted to protect an edit made moments ago — the user would watch their own typing vanish with no error. The push decides the real outcome and reports a genuine conflict there, instead of resolving it in silence here. |

---

## Scenarios — what the cases add up to

### S1 · One device, online, ordinary edit
Edit → `version + 1`, `updatedAt` = device now, row `PENDING_UPDATE` → push → **P1** → applied.

### S2 · One device, offline, several edits, then back online
The queue is drained `ORDER BY priority ASC, createdAt ASC` — oldest first — and each operation
carries a later `updatedAt` than the one before it, so each lands under **P1**.

The order is what makes this safe. If an operation fails and is retried *after* a later one has
landed, it arrives older than the server's row and hits **P4**. That is the production case behind
S5, reached from a single device with no second device anywhere.

### S3 · One device, offline, the server unchanged
Pull brings nothing newer; the local row wins by **L6** anyway. Push then applies under **P1**.

### S4 · Two devices, one account, near-simultaneous edits
Device A edits at 10:00:00 and pushes. Device B, still holding the older copy, edits at 10:00:05 and
pushes. B is newer → **P1** → B wins, and **A's edit is gone with nothing reported to anyone**.

Both records are `version 7`, because each device incremented its own copy from 6. A per-record
counter cannot order two independent edits, so today the clock breaks the tie and the later one
wins. This is last-write-wins, and it is the same on two Androids as on an Android and an iPhone —
**it is not a cross-platform problem, it is a "who owns the counter" problem.** See G3.

### S5 · A device offline for a week, the server changed meanwhile ⚠️
The device's edits carry last week's timestamps; the server's row is newer → **P4** →
`STALE_CONFLICT`. Then, in the app:

1. `resolveStaleConflicts` marks the queue row **TERMINAL** and reports `push_stale_divergence`.
   The push will never retry it — correct, it cannot succeed.
2. `markTerminal` changes **the queue row only**. The local record stays `PENDING_UPDATE`.
3. The next pull therefore hits **L6** and refuses to overwrite it.

**Push will not send it. Pull will not replace it. The two copies stay different for ever**, the app
shows the user's version, the server holds its own, and the only trace is one dropped-report event.
This is G1 and it is the most expensive thing in this document.

### S6 · The device's clock is behind
Every edit is stamped in the past, so every push is **P4**. The device syncs nothing and says
nothing. `version` would show 7 against the server's 6 and reveal the truth immediately — G3.

### S7 · The device's clock is ahead, then corrected
While it was ahead, the server stored a future `updatedAt` (the push path preserves the device's own
timestamp). Once the clock is corrected, every later edit is older than that future value → **P4**
for **every entity on that device** until real time passes it. Seven devices were in this state on
2026-09-04, carrying 41,569 occurrences between them.

### S8 · A create for a record the server already holds
**P8**. If the incoming copy wins, it continues as an update. If it loses, the app converts the
create into an UPDATE and re-queues it once — and skips even that if the record already carries a
terminal verdict, which is how one record reached 1,503 dropped-push events on one device.

### S9 · A delete queued offline, an edit made elsewhere since ⚠️
`deleteFromSync` performs **no staleness check** — it sets `isDeleted` and saves. A week-old delete
therefore wins over yesterday's edit. Deletes are soft, so the row survives and this is recoverable,
but the rule is unwritten and asymmetric with update. G2.

### S10 · The same operation sent twice
Identical `updatedAt` → **P2** → applied again with identical data → `SUCCESS`. The device stops.
This is the case that makes retries safe, and it is why P2 must never be changed to a rejection.

---

## Known gaps — recorded, not fixed

These are **behaviour as it stands today**. The tests lock them in so that nobody changes one side
by accident; changing them on purpose needs a decision entry, not a patch.

**G1 — a divergent record is divergent for ever.** S5. Push stops (TERMINAL), pull refuses (L6),
and `data.serverRecord` — which the server already sends with every `STALE_CONFLICT` and which
`SYNC_V2_MOBILE_PROTOCOL.md` §7 says to apply — is parsed into a `JsonElement` and never used.
Fixing it means choosing what the user sees: their edit replaced by the server's copy, or a prompt.

**G2 — `DELETE` skips the conflict check entirely.** S9. **Decided 2026-09-05, not yet built** —
see decision [0036](decisions/0036-a-delete-must-say-what-it-is-deleting.md).

A delete must say **what** it is deleting: `[{id, version}]` instead of `["id"]`. The server then
answers in three ways, and none of them asks the user anything:

| the server holds | meaning | outcome |
|---|---|---|
| the same version | nothing happened since the user looked at it | **delete it** |
| a higher version | something happened to this record *after* the user decided to delete it | **refuse**, return the record, the device restores it locally |
| the delete carries no version (an older build) | nothing to compare | **delete it** — exactly as today |

Version rather than a timestamp for the same reason as everywhere else here: *"I am deleting v7"* is
a fact about the record, while *"I deleted it at 15:04"* is a fact about a clock the device owns.

**Why refusing is not a surprise.** The obvious objection is that a deleted record reappearing will
confuse somebody. It will not, and the owner's argument is the one that settles it: **the user's
most recent deliberate action was not the delete — it was the edit.** Monday's delete was made
without knowing about Tuesday. Tuesday's edit was made looking straight at the record. If they truly
wanted it gone they would have deleted it from the later device too, or left it alone. So the record
coming back *is* their own latest decision, which is why nothing needs to be asked and no dialog is
needed. Deleting it again costs one tap, and that delete now carries v8 and goes through.

And between the two possible mistakes, only one is recoverable by the person it happens to: a record
that comes back can be deleted again; work that vanished cannot be brought back by anyone who is not
reading the database.

**One honest wrinkle.** `version` is not bumped only by direct edits — `updateCurrencyCode` bumps it
when the user makes an *invoice* for that client, not when they edit the client. So the rule's
justification is not "you edited it" but the wider and truer **"something happened to this record
after you decided to delete it"**. A client whose invoice was written yesterday is not one to delete
on the strength of a decision made the day before that.

**G3 — `version` is carried, stored, and ignored.** The app increments it on every edit in
`commonMain`, so Android and iOS behave identically; the mapper sends it; the server writes it;
`SyncConflictRecord` holds it; `shouldKeepIncoming` reads it into `incomingVersion` /
`existingVersion` — **and only logs it.** Every decision above is made on a clock the device owns.

**Being measured now, not changed** (`SyncConflictPolicy.recordShadowVerdict`, live 2026-09-05). Every
conflict computes both verdicts, acts on the clock exactly as before, and counts what version *would*
have said:

```
sum by (outcome) (sync_conflict_shadow_total)
```

| outcome | meaning |
|---|---|
| `version_absent` | one side has no version — an old row, or one of the two entity types with no repository of their own |
| `version_equal` | version says nothing; the clock decides and always would |
| `agree_apply` | both apply it |
| `clock_beat_version` | **the clock refuses what version calls newer** — the wrong-clock devices (S6, S7) |
| `superseded` | **both refuse, and version explains it**: the incoming copy is an ancestor of the server's. Answered `STALE_CONFLICT` today — "failed" — when the truth is "your newer copy is already here" |
| `version_older_but_applied` | **the number that decides whether flipping is safe.** The clock applies what version calls older; if this is not rare, a version rule would start refusing writes that land today, and that is somebody's edit disappearing |

Two of those are the size of the prize and one is the size of the risk, and none of them could be
guessed. Read them before changing the rule, not after.

A version-based rule would answer S6 and S7 outright, and would turn P4 into three answers instead
of one: *newer* → apply, *equal* → already applied, *older* → **superseded, and therefore done** —
not "failed". Today the server says a record failed when what actually happened is that a newer
version of it already arrived safely.

It does not answer S4, where two devices independently produce `version 7`. That needs the counter
to belong to the server (client sends the version it edited from; the server compares, applies, and
returns the next one). That is the real cross-platform answer, because a rule the server owns is the
same rule for Android, iOS, and anything that comes later — but it needs an app release, and
`version` values in production must be checked first: if they are all 0 or 1, there is nothing to
compare.

## Before changing anything here

1. Change this file first.
2. Change both test files to match.
3. Then change both implementations.
4. `DELETE` and `version` (G2, G3) need a `docs/decisions/` entry, not just a commit.
