# 0078 — What the web writes reaches the phones, and a web delete takes its lines

**Status:** decided by the owner on 2026-09-13. They want an invoice made on the web to show on the phone, and when
it is deleted on the web, even days later, to disappear from the phone too ("Haan, dono karein"). Being built on
`fix/web-writes-reach-phones`.
**Related:** 0042/0067 (the server owns the version), 0069 Q2 (the phone's delete takes its lines), 0076,
`.claude/agents/sync.md` rules 15, 21 and 23.

## Context (2026-09-12/13)

- **REST writes never set `last_synced_at`.** The web's create, edit and delete are REST writes, so a phone's delta
  pull never sees them. They reach a phone only on a full pull. In 30 days that was 4 invoices, 43 items and
  65 products.
- **The web's delete (`InvoiceService.softDeleteInvoice`) marks the invoice deleted and leaves its lines live.** The
  phone's delete takes its lines since 1.4.6 (0069 Q2).
- **A deleted record stays on the server, marked deleted (soft delete).**

## Decided

- **Every REST write that changes a synced row sets `last_synced_at`** and moves `version` the way a sync write does.
  The next delta pull then brings it to every phone. A copy that changes nothing keeps its number (rule 15).
- **The web's invoice delete soft-deletes the invoice's live lines** in the same transaction.
- **Payments are untouched,** because every Payments-screen issue waits for that form's review.

## Rejected

- **Leaving web writes to the full pull.** A web edit could stay invisible on the phone for days.
- **Pushing a notification to phones on every web write.** The pull already exists; a bell is a later step (the sync
  structure discussion, "silent bell + pull").

## Consequences

- **Builds up to 1.4.5 drop a deleted row they don't hold.** An invoice made on the web and then deleted there before
  an old phone pulled it never appears on that phone, which is correct.
- **How long a deleted record stays on the server** is the owner's next decision (a retention policy for deleted
  rows).
