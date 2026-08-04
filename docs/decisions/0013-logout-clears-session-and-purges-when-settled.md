# 0013 — Logout clears the session, and deletes the account's data only once it is settled

**Date:** 2026-08-03
**Status:** Accepted and built (app), compiles clean; not yet verified on device
**Affects:** `NavigationDrawerViewModel`, `SyncManager`, new `AccountPurgeDao` /
`AccountPurgeRepository` / `PendingPurgeStore` / `AccountDataPurger`, `PreferencesKeys`

## What was found

A device holding `qatester935@gmail.com` was logged out and a different account logged in, with the
local database and DataStore captured before and after.

**The good news first:** there is no cross-account contamination. The old account's rows kept their
own `userId`, the new account's arrived under the new one, and the invoice list showed exactly the
new user's data — 7 invoices for the selected business, matching the database exactly. An early
reading of the push body suggested otherwise; the clients it carried turned out not to have existed
on the device before login at all. They arrived in the pull and were echoed straight back.

Two real defects sat underneath:

**1 — Logout never cleared the session.** Sitting on the login screen after logging out, DataStore
still held `session_state_type = AUTHENTICATED`, `session_user_id = edd209ed-…`, and a JWT for
`qatester935@gmail.com` valid for 90 days. Analytics was still reporting the old user's id.

`AuthRepositoryImpl.logout()` calls the server and nothing else. Its own comment says *"session
clearing is handled by SessionManager"* — but nothing called it. `ClearSession` existed, was wired
into `UserUseCases`, was registered in DI, and had **zero call sites**. Only the 401 interceptor ever
reached `SessionManager.logout()`.

**2 — A registered account's local data stayed forever.** `deleteGuestData` runs under
`if (isGuest)`, and there was no other path. After the switch the device held both accounts at once:

| | old account | new account |
|---|---|---|
| invoices | 90 | 25 |
| invoice_items | 260 | — |
| clients | 34 | 23 |
| businesses | 25 | 13 |
| payments | 14 | — |

`users` held both email addresses. Nothing displayed the wrong data, but that rested entirely on
every query everywhere remembering its `userId` filter. One omission puts a stranger's invoice in
someone's list — a **G3** failure, and it grows by a whole account on every login.

## Decision

**Clear the session on every logout, in `finally`.** Whatever else fails, the token goes.

**Delete the outgoing account's local data only when that account owes the server nothing.** When it
still owes something, keep the rows and park the account id in DataStore; retry after the next sync
settles, which is when the debt may actually have cleared.

"Owes the server" is two questions, both asked: any row not `SYNCED`, and any queue entry still
`PENDING`/`PROCESSING`/`FAILED`.

## Why not simply delete on logout

**96.6% of users are guests, and even a registered user can log out with unpushed work.** A row the
server has never seen exists nowhere else. Data outliving its account by a few sessions is
recoverable; data deleted before it was ever sent is not. That asymmetry decides it.

## The trap this would have fallen into

A naive "fully synced?" check **never passes**. Every business is seeded with default unit types,
categories, a tax, terms and a payment instruction — `isSystemDefault = 1`, ids of the app's
deterministic `00000000-…` form. On the test device 18 of them sat at `PENDING_CREATE` with
`retryCount = 0`: never attempted, never delivered, and they stay that way.

Counted, they would make the condition permanently false and the whole mechanism dead code that
looks alive. So they are excluded — they are app-authored boilerplate, not user work, and the app
writes them again for the next business.

**That they never sync is a separate bug and is not fixed here.** `AccountPurgeDao.strandedDefaults`
exists so the exclusion is reported on every run rather than quietly stopping to matter.

## Rejected

- **Delete unconditionally on logout.** The one outcome that is unrecoverable. Rejected outright.
- **Keep the data and rely on query filters.** What the code does today. It works until one query
  forgets, and nothing tells you which one.
- **Block logout until the queue drains.** Holds the user hostage to a network they may not have,
  for work they may not care about, on a screen whose only purpose is to leave.
- **Purge at app start instead of after sync.** A start-time check runs *before* the sync that would
  clear the debt, so every account would wait an extra launch. Hooked into `SyncManager` after
  reconcile instead.
- **Force-push before logout, then delete.** Sounds tidy, fails offline — the exact case where
  unsent work is most likely to exist.

## Also fixed on the way

`deleteAllGuestData` returns early when the user has no businesses, so its last step — deleting the
user entity — never ran for such an account, leaving the name and email behind. The purge deletes
`users`, `user_preferences` and `user_state` explicitly rather than depending on that path finishing.

## Still open (found, not fixed)

- **Login pulls before it pushes** — `/v2/sync/pull` at 18:29:29, `/v2/sync/push` 33s later. Push
  should go first, or unsent local work can be overwritten by the pull.
- **Pull-then-push echo** — the 34 clients that arrived in the pull were pushed straight back as
  `created`, bumping `version`, `updatedAt` and `lastModifyBy` on every login.
- **The seeded defaults never sync** (above).
- **`sessionId` does not change across an account switch** — one analytics session spanning two
  users.
- `SyncOrphanDao` covers 16 tables; 21 have `userId` + `syncState`. Missing: stamps, signatures,
  headers, backgrounds, templates.
- Push response: `⚠️ Server did not return invoiceItems results!`
- `coco melon:` debug logging in production code.

## Not yet verified on device

Compiles clean; the behaviour has not been exercised on hardware. Two cases matter most: a logout
with a genuinely dirty queue (must keep the rows and park the id), and a later sync draining it
(must then delete). The stranded-default exclusion is what makes the second case reachable at all,
so it is the one to watch in the log.
