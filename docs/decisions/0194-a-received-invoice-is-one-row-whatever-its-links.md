# 0194 — A received invoice is one row, whatever its links

**Date:** 2026-09-30, from the owner's iOS screenshot of Tools → Received ("aik invoice 2 time show kr rhi hy … sab sy
neech wali not available keh rhi hy"). **App:** `fix/received-list-one-row-safe-area` (`f0ba99de2`), merged into
`release/1.5.1`. Not released. **Schema:** the phone's own store `invotick_phone.db` goes v1 → v2 with three empty columns
(`@AutoMigration`, `1.json` kept). Nothing is deleted.

## What was wrong
- A share link is a *link*, not an invoice. Editing an invoice mints a new token and the next send retires the old one.
  The phone stored one row per token, so the retired link stayed in the list as a dead duplicate
  (TE2609003 twice; the older row answered "not available").
- The list's top bar ignored the status-bar inset: on iOS the back arrow was drawn over the clock and could not be
  tapped. `BusinessLedgerTopBar` had the same fault; 36 top bars were checked, only these 2 were wrong.

## Decided
- **One row per sender document.** Identity = the server's `invoiceId` + `documentType`, which every copy the phone
  holds also carries. The row shows the newest link the phone received, and that link's own status. The server resets
  the approval to pending after an edit, so the receiver answers the new amount.
- **Rows already duplicated on phones:** filled once from each row's own stored copy at app start and hidden on read,
  never deleted. A row whose copy has no id stays on its own, as before.
- **A link the server calls gone for good (410/404/403)** says so on the row: "This link no longer works. Ask the sender
  to send it again." (17 languages). Offline says nothing. No new event: `shared_invoice_open_failed` already carries
  `entry=received_list` and `reason`.
- Amounts use the app's thousands separators (`PKR 1,316.00`); money shrinks, never truncates.
- The kill switch is the phone store's existing `received_phone_store_enabled`.

## Rejected
- **Deleting the older rows.** A receiver's data on the phone is removed only with a reason the receiver can see.
- **Keying by invoice number.** The number is the sender's text and can repeat across senders and businesses.
