# 0019 — An invoice card carries two tags, because money and delivery are not one axis

**Date:** 2026-08-07 (decided earlier in conversation; recorded late — see "Why this is late")
**Status:** phase 1 shipped, phases 2–4 pending
**Touches:** `invoice-kmp-app` (list items, filter chips, save screens, `InvoiceStatus`),
`invotick-apis` (`shared_invoice`)

## The decision

Every invoice card shows **two** tags, not one:

| | Left tag — the document | Right tag — delivery |
|---|---|---|
| **Answers** | where is my money | what has the client done |
| **Values** | Draft · Issued · Partial · Paid · Overdue | Sent → Received → Approved / Rejected |
| **Source** | `InvoiceStatus` (local, computed) | the share record (backend) |

They are independent. An invoice can be **Partial and Approved** at the same time, or **Paid and never
opened**. Neither fact makes the other untrue.

### The delivery tag is a progression, and "Pending" is not part of it

Sent → Received → Approved/Rejected. Each step is a fact about something the client did (or, for
Sent, something we did to reach them), and each replaces the one before it.

**"Pending" is deliberately not shown**, even though the backend's `approvalStatus` is literally
`PENDING` until a decision arrives. It is the current badge's default and it has to go: every shared
invoice is pending, so the word distinguishes nothing — it is a label that appears on the majority of
cards while carrying no information. Worse, it *replaces* information: an invoice sitting at "Pending"
could have been opened and read, or never delivered at all, and the tag flattens that difference.
Sent and Received are the two states "Pending" was hiding.

So `PENDING` from the backend is not rendered as a tag; it means "no decision yet", and what shows
instead is how far the document actually got — Sent if it was shared, Received if `firstViewedAt` is
set.

## Why one tag cannot do it

The codebase already contains the failed attempt, and it is worth naming because it will otherwise be
re-proposed: **`InvoiceStatus.VIEWED`.**

It sits in the enum between `SENT` and `PARTIAL`. The list item has a label for it, the dashboard
counts it as outstanding, and the payment screens filter on it. And **nothing has ever assigned it** —
verified 2026-08-07: there is no write to `VIEWED` anywhere in the app. So "Viewed" cannot appear on
any card, and never has.

That is not an oversight anyone forgot to finish. It is what happens when a delivery fact is forced
into a money enum: to set `VIEWED` you must first decide what it *replaces*. If the client views a
partially-paid invoice, `VIEWED` would erase `PARTIAL` — you would be trading a fact about money for a
fact about attention. There is no correct value to write, so nothing was ever written.

Two tags remove the choice: the delivery tag changes and the money tag does not move.

## The four phases

1. **Rename "Post" → "Issued".** ✅ Shipped, `57d35c7b`. Six sites across invoices and estimates.
   Rationale in that commit: "Post" is the everyday word for *mailing* something, so it named the
   state "not sent yet" with the common word for "sent" — and it occupied the name the delivery tag
   needs. The enum value was left alone deliberately.
2. **`first_viewed_at`** (backend). `shared_invoice` records `viewCount` and increments it, but has no
   timestamp, and the batch status endpoint does not return one. **"Received" cannot be dated without
   this**, so it comes before phase 3.
3. **The two-tag card** (app). Today the approval badge already exists — but in the chips row next to
   Paid/Unpaid, not paired with the status. Phase 3 pairs them and adds "Sent"/"Received".
4. **`InvoiceStatus.SENT` → `ISSUED`.** Its own release. The value is persisted in Room and synced to
   the backend, so this is a data migration and older app versions will not understand a new value.

## Rejected

- **One tag with more values.** Above — this is `VIEWED`, and it is already in the tree not working.
- **Showing the delivery tag on every invoice.** An invoice that was never shared has no delivery
  state; a tag reading "Not sent" would add a column of noise to the majority case. The tag appears
  only when a share record exists, which is how the approval badge already behaves.
- **Keeping a "Pending" tag.** Above — it is the state of nearly every shared invoice, so it separates
  nothing, and it conceals the two states that do (Sent vs Received).
- **Deriving "Sent" from the `invoice_shared` analytics event.** Analytics is for measuring, not for
  driving UI, and that event is not in the live release anyway (see AGENTS.md §5b). "Sent" comes from
  the share record.

## Why this is late

Phase 1 shipped and the UI demo was approved in conversation, but the design itself was never written
down — so when that conversation was compacted, the only surviving record was a commit message and a
memory file. AGENTS.md §7.3 says to log a decision the moment it is made; this one was not, and the
reasoning above had to be reconstructed from the code. Recorded now so phases 2–4 have something to
build against.
