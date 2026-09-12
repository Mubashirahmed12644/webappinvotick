# 0068 — A client is deleted like every synced record; a client in use is refused until the owner rules

**Status:** decided. Two approvals cover it: the owner's "pending work start kro apni tarteeb sy"
(2026-09-12), and the sync owner's "haan, alag chhota kaam". The rule for a client that is in use
belongs to the owner and is still open (see "Open" below).
**Date:** 2026-09-13.
**Built:** app `dcf97a79`, for 1.4.6, merged into `VC_102_VN_146`.
**Related:** 0059, 0060, `.claude/agents/sync.md` rule 20.

## Context (production, read-only, 2026-09-13)

- **A client deleted on the phone never reached the server.** `ClientRepositoryImpl.deleteClients`
  deleted the row outright and queued nothing, on all five paths. Of 6,027 clients on the server, 5 are
  deleted, and all 5 were deleted from the web. None came from a phone.
- **23 of 2,122 active phones pressed delete, 50 times in 17 days** (26 Aug–11 Sep).
  - 12 phones tried only clients that had an invoice. SQLite's RESTRICT refused every delete, and the
    snackbar showed "Failed to delete client: FOREIGN KEY constraint failed (code 1811…)".
  - 11 phones deleted a client with no invoice. It disappeared from the phone but stayed alive on the
    server and on the user's other devices.
  - There were 0 crashes.

## Decided

- **A delete is soft and queued.** The client is soft-deleted and a DELETE is queued under the client's
  own owner. Both happen in one transaction with the in-use check (`ClientDao.softDeleteUnlessInUse`).
- **Lists and counts skip a deleted client.** An existing invoice still shows its client's name, because
  it reads the client by id.
- **A delete pulled from the server lands SYNCED** (`markDeletedByServer`), so the phone does not send it
  back.
- **A client in use is refused.** If any invoice, estimate or payment points at the client, deleted or
  not, the whole selection is refused with a clear message: "this client has invoices, estimates or
  payments" (`ClientInUseException`). This is exactly where RESTRICT refused before.

## Open (the owner's decision)

1. **What should deleting a client that has documents do?**
   - (A) Refuse, with a clear message. This is built, and recommended for now.
   - (B) Hide the client from lists and keep the documents. This needs the server's pull gap (below)
     closed first.
   - (C) Delete everything with it. Not recommended: it destroys money records.
2. **The delete dialog makes two false promises.** It says the transaction history will be deleted
   forever, and that only premium users can restore. The app does neither. Recommended: make the text
   true.

## Rejected

- **A soft delete for every client, in use or not.** It leaves documents pointing at a deleted client,
  and it runs into the pull gap below.
- **Deleting the client's documents with it.** It destroys money records, and that call is the owner's.
- **Deleting only the unused clients in a mixed selection.** Users have always had all or nothing;
  changing that without asking is not ours to do.
- **Putting the refusal in the three view-models.** That is three copies of one rule.
- **A Room change to `customerId`.** It would rebuild the tables that hold guests' only copy of their
  invoices. 0060 rejected the same change.

## Consequences

- **The pull gap, on the server, is open.** `SyncV2PullService.fullPull` sends only live clients but
  every live document. So a new phone cannot insert a live document whose client is deleted (0 such cases
  today). Two paths can still create one:
  - the web's delete, which checks nothing;
  - the invoice screen's own client sheet, which can delete the selected client before Save.

  Close the gap on the server before any rule lets a client with documents be hidden.
- **Business and template still send a pulled delete back once.** It is the same shape as the client
  echo fixed here, and it is open.
- **Measure after 1.4.6** (vc ≥ 102):
  - deleted clients whose `last_modify_by` is a vc ≥ 102 phone, against confirmed delete taps (before:
    23 of 2,122 active devices);
  - `sync_failure` client DELETEs stay at 0, apart from `NOT_FOUND_ON_DELETE`;
  - `pull_apply` failures naming `customerId` stay at 0.
