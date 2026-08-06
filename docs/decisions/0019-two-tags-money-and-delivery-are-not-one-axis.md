# 0019 — An invoice card carries two tags, because money and delivery are not one axis

**Date:** 2026-08-07 (decided earlier in conversation; recorded late — see "Why this is late")
**Status:** phase 1 shipped, phases 2–4 pending
**Touches:** `invoice-kmp-app` (list items, filter chips, save screens, `InvoiceStatus`),
`invotick-apis` (`shared_invoice`)

## The decision

Every invoice card shows **two** tags, not one:

Both live at the card's top right, stacked — **delivery on top, money underneath.**

| | Top tag — delivery | Below it — money |
|---|---|---|
| **Answers** | what has my client done | where is my money |
| **Values** | Sent → Viewed → Approved / Rejected | Unpaid · Partially paid · Paid · Overdue |
| **Shown when** | only if the document was shared | always |
| **Source** | the share record (backend) | computed locally from payments + due date |

They are independent. An invoice can be **Partial and Approved** at the same time, or **Paid and never
opened**. Neither fact makes the other untrue.

### The money tag has exactly four values

**Unpaid · Partially paid · Paid · Overdue.** Nothing paid within the due date; something paid; all
of it paid; and past the date with a balance outstanding. Between them they cover every case —
amount (none/some/all) × time (inside/outside) — so a fifth is not missing, it does not exist.

**"Unpaid" for the not-yet-due case, and this needed arguing.** The formally correct accounts-
receivable term is **Current**, which is what every aging report calls it. It was rejected for the
same reason "Post" and "Outstanding" were: it is a bookkeeper's word, and a small business that has
never read an aging report learns nothing from it.

"Unpaid" is not a compromise on accuracy either. Internationally, *unpaid* describes the **amount** —
it is silent about timing, and an invoice inside its due date is genuinely unpaid. The specific terms
for lateness are *overdue*, *past due*, *in arrears*. What made this worth checking is that in
everyday speech people say "unpaid invoices" and mean the ones they are chasing, which drifts toward
"late" — but that is colloquial drift, not the term's meaning. Beside "Overdue", the pair reads
itself: both unpaid, one of them late.

**Overdue outranks Partially paid** when both apply. Lateness is the fact the user has to act on, and
the part-payment is not lost from the card — the Paid/Unpaid amount chips below still show it.

**Overdue begins the day AFTER the due date**, compared as calendar days in the user's own timezone.
This was a real defect: `dueDate` is an `Instant` carrying the time of day the invoice was created
(it is set as `now + 7 days`), and the old `dueDate < now` therefore flipped an invoice to Overdue
partway through its own due date — at whatever o'clock it happened to be made. The client still had
the rest of the day and the app had already called them late. Two copies of this existed, in
`InvoiceListViewModel` and `SaveInvoiceViewModel`; both are fixed.

### The delivery tag is a progression, and "Pending" is not part of it

Sent → Viewed → Approved/Rejected. Each step is a fact about something the client did (or, for
Sent, something we did to reach them), and each replaces the one before it. A decision outranks a
view, because you cannot approve what you did not open.

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

(Three more values sit beside it — `CANCELLED`, `UNCOLLECTIBLE`, `REFUNDED` — and were verified on
2026-08-07 to be **never assigned anywhere either**, in the app or the backend. There is no way to
cancel or void an invoice in this product. They are leftovers in an enum written on 2026-06-08,
before the product had this shape; they are not features waiting to be finished, and this is a simple
invoice maker where advancement has to arrive as simplicity. The `when` branches map them to "Unpaid"
purely because Kotlin demands exhaustiveness.)

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
