# 0069 — A full pull sends a child only with its parents; a record no pull can store costs a bounded number of full pulls

**Status:** decided for the read side and the phone's bound. Approved under the owner's "pending work start kro
apni tarteeb sy" (2026-09-12). The data repair and the root fix are the owner's (see "Open").
**Date:** 2026-09-13.
**Built:** backend `d916a6d` (`fix/pull-orphan-children`, on stage `f8a6722`); app `62c06408`
(`feat/146-full-pull-loop-bound`, for 1.4.6, on `VC_102_VN_146` at `aaf50279`).
**Related:** 0042, 0050, 0053, 0060, 0068, `.claude/agents/sync.md` rules 14, 20 and 21.

## Context (production, read-only, 2026-09-13)

- **A phone deletes an invoice alone, so its lines stay live.** 91 of the 95 invoices deleted this week left their
  lines live.
- **So the full pull sent live children of deleted parents:**
  - 2,833 lines of 716 deleted invoices, in 255 accounts;
  - 82 invoice-payment links of a deleted invoice;
  - 32 lines of deleted estimates;
  - 28 live invoices naming terms the user deleted, in 13 accounts.
- **A phone cannot store a line whose invoice it does not hold.** So it asked for a full pull again, and that pull
  failed the same way.
  - Phone `8298ede7` (vc101, one guest's only phone) sent 236 reports in 15 minutes. That is 59 lines of 11
    invoices deleted in March, × 4 full pulls.
  - Phones reporting it in 30 days, phones / reports:

    | Build | Phones | Reports |
    |---|---|---|
    | vc101 | 1 | 236 |
    | vc97 | 4 | 125 |
    | vc96 | 3 | 26 |
    | vc94 | 4 | 139 |
    | vc91–93 | 3 | 45 |
- **262 accounts (210 guests, 52 registered) would trap a new or reset phone today.**

## Decided

- **The full pull sends a child only with its parents.**
  - An invoice line goes only with its invoice, and an estimate line only with its estimate.
  - An invoice-payment link goes only with both its invoice and its payment.
  - For builds up to 1.4.5 this is the only fix, because they never keep a deleted parent.
- **The account's deleted terms that a live invoice names are sent as deleted rows.**
  - 1.4.6 keeps them (`TermsSyncHandler.applyServerDelete`).
  - Up to 1.4.5, `sanitizeEntity` clears the link, so the invoice still lands.
- **The delta is unchanged.** 30 such lines went by delta in 30 days.
- **On a 1.4.6 phone, a record no pull can store costs a bounded number of full pulls** (`PullRepair`).
  - Only a delta's miss asks for a full pull.
  - After a full pull that still fails, the next waits 1 h, then 6 h, then 24 h.
  - The app-update full pull is never held back.
- **A full pull reports each miss once, with `attempts`.** A delta's miss is not reported (0050).
- **Effect: accounts that would trap a new phone go from 262 to 8, on every build.**
  - 6 name another account's product (0053).
  - 2 trap only old builds: a deleted parent that 1.4.6 keeps.

## Rejected

- **Sending deleted invoices as deleted rows.** Old builds drop them, and 1.4.6 would store 716 invisible invoices.
- **Refusing to advance the cursor.** Already rejected in 0042.
- **A server cascade on delete, now.** A resurrected invoice would come back without its lines until 0042 phase 3.
- **A persisted report-once set.** One report per full pull, with `attempts`, gives evidence per build.
- **A quiet repair without a `last_synced_at` bump.** It would create reconcile drift on the originating phones.
  This is from the code, not measured.

## Open (the owner's decisions)

1. **Q1: repair the existing rows?** Mark the 2,833 lines, 82 links and 32 estimate lines deleted, each with
   version + 1 and the time now, so every phone learns.
   - Risk: 13 of those invoices belong to accounts with two or more phones. Where one is still live on a phone,
     its lines would show missing there.
   - The loop already stops with the server fix.
   - Recommended: not now. Do it once, after Q2 closes the source; otherwise about 90 more arrive every week.
2. **Q2: the root, a deleted invoice leaves its lines live.**
   - (a) The server deletes the lines with their invoice. This works on every build. It is unsafe until 0042's
     version rule ("a delete is the latest change"), because a resurrected invoice would come back without its
     lines.
   - (b) A 1.4.6+ phone deletes the lines with the invoice.
   - Recommended: (b) now, (a) after the version rule.

**Also open (not a decision):** 38 "Template: FOREIGN KEY" reports from vc94–97. Those builds send no ids, and the
data rules out a deleted parent, another account's parent and a missing parent. It needs the record id, which
1.4.5 sends.

## Measure after 1.4.6 (vc ≥ 102)

- "parent not on this device, full pull requested" per device. Before: 15 phones, 571 reports in 30 days.
- Full pulls per device per day from vc ≥ 102: after a failed repair, the gaps are 1 h, 6 h and 24 h.
- New deleted invoices whose lines stay live, per week. Before: 91 of 95.
