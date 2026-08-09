# 0020 — The payment tag goes; the card says it in words

**Date:** 2026-08-08
**Status:** accepted — implemented in the app
**Revises:** [0019](0019-two-tags-money-and-delivery-are-not-one-axis.md)

## The decision

The invoice card carries **one** tag, in its top-right corner: the delivery status — what the client
did with the document. The payment state is no longer a tag at all. It is carried by the amount and
the ageing line, in words and colour.

Decision 0019 put two tags there, delivery above payment. That split was right about the *axes* —
"what has my client done" and "where is my money" really are two questions — and wrong about how to
show the second one.

## Why the payment tag came off

**It never said anything the card was not already saying.** Taking each of the four payment states
and asking what remains without a tag:

| State | The tag | What the card says without it |
|---|---|---|
| Paid | `Paid` | amount in green · **Paid in full** |
| Part paid | `Part paid` | **Rs21,240** of Rs31,240 · the progress edge |
| Unpaid, in date | `Unpaid` | **Due in 6 days** |
| Overdue | `Overdue` | amount in red · **14 days overdue** · tinted card edge |

Four out of four are already stated, in words, in colour, at a fixed position. The delivery status is
the only thing on the card that nothing else reports — it comes from the share record, not from the
invoice.

**In one case the tag was worse than the text, not merely equal.** An invoice can be part paid *and*
overdue. There is one tag slot, so `calculateInvoiceStatus` has to choose, and it chooses lateness —
`isPastDue` is tested before `totalPaid > ZERO`. A client who has paid Rs21,240 of Rs31,240 and is a
fortnight late showed a single `Overdue` tag, and the money that *did* arrive was invisible in it.
The comment beside that branch already conceded the gap: it noted the amount was "not lost from the
card" because the figures below still showed it. The tag needed the text to be complete. The text
never needed the tag.

**Two tags did not survive the font scale.** Measured on a 360dp phone (328dp of usable row) in
Roboto at the card's own sizes:

| | needs | has | |
|---|---|---|---|
| 1.0× `TB2608009 · 14 days overdue` + Viewed + Overdue | 272 | 328 | 56 spare |
| **1.5×** the same row | **382** | 328 | **54 short** |
| 1.5× `Due in 6 days` + Approved + Part paid | 381 | 328 | 53 short |
| 1.5× the same row with **one** tag | 307 | 328 | 21 spare |

It fits at 1.0× with room left over, which is why it looked finished. At 1.5× a `Row` does not wrap
and does not ellipsise — the second tag is simply cut, silently. This is the failure
`LAYOUT_RULES.md` already names in six other places.

## What was rejected

- **Keeping both tags and dropping the ageing text.** `Overdue` loses the *14 days*, which is the
  actionable number. The text is strictly more informative than the tag.
- **Keeping both tags side by side on one line** (the arrangement that prompted this). Loses the
  two-axis distinction — they read as one undifferentiated strip — and is the 54dp overflow above.
- **Keeping the payment tag because a coloured pill scans faster down a list.** The ageing line
  starts at a fixed left edge too, and red/amber/green does the same sweeping. And the list already
  has filter chips: filter to Overdue and every payment tag on screen reads the same word.

## What this cost, and what covers it

- **A lone tag can be misread.** A card showing only `Approved` could be taken to mean settled. The
  red amount, the red ageing line and the tinted card edge on an overdue invoice argue against it.
  This is the one part of the change that touches trust rather than tidiness.
- **`Invoice.dueDate` is non-null**, so the "no due date, therefore no ageing text" gap does not
  arise for invoices. `Estimate.expiryDate` *is* nullable, and there the ageing line falls back to
  the document's own age — "Created 4 days ago" — rather than leaving the slot empty.

## The rest of the card

- The 42dp avatar is gone. It repeated the status a third time, in colour with no label, and it —
  not the text — was what set the card's height.
- `Paid: Rs0.00` and `Unpaid: Rs14,200` are gone: one reported an absence, the other repeated the
  number directly above it.
- `invoice.dueDate.toString()` rendered a full ISO instant. It is now the answer to the question it
  was there for: *Due in 6 days*, *14 days overdue*, *Paid in full*.
- The headline figure is the **outstanding balance**, with `of {total}` beside it when they differ.
  On an unpaid invoice they are the same number, so most cards are unchanged.
- Part payment is the card's bottom **edge**, not a row — a bar costs a line of height anywhere else.
- In multi-select the checkbox takes the corner slot instead of leading the row, so the text does not
  jump sideways when selection turns on.
- `DeliveryStatus.ISSUED` now draws no tag, like null. A share row is minted the moment the Invoice
  Created screen opens, so ISSUED means "a link exists" — from the client's side indistinguishable
  from never having been sent.

## Estimates

The same card, with one difference: an estimate has no money axis, so its single tag is a **merge**
of estimate status and delivery status. They describe the same events from two sides — a client
approving a shared estimate *is* the estimate becoming ACCEPTED — so showing both prints one fact
twice, and showing only delivery would lose the estimate accepted over the phone and marked by hand.
Order: Converted → Accepted → Rejected → Viewed → Sent → Draft.

`Expired` is deliberately not a tag: the ageing line says *Expired 3 days ago*, which is the same
fact with the number attached. The Discount / Tax / Shipping chips are gone — line-item arithmetic
already inside the total, printed on every card whether or not they held a value.

## Files

- `feature/document/common/.../ui/DocumentAgeing.kt` — new; the shared ageing model, calendar-day
  based, so the list's overdue calculation and the card's wording cannot disagree
- `feature/document/invoice/.../list/components/InvoiceListItem.kt`
- `feature/document/estimate/.../list/EstimateListScreen.kt` — `EstimateListItem`, `EstimateTopTag`
