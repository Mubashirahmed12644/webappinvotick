# 0191 — A document made on this phone is never answered on it

**Date:** 2026-09-30.
**App:** `fix/owner-never-decides-own-invoice` (`b1c0c08fd` the rule, `02e7f0c29` the other account's document opens in
that account), off `780f4ef63`. Not merged, not released. **Backend:** the 409 `viewerIsSender` guard
(`82f5dec` on `stage`). **Data:** `kaam/ops-scripts/reset-self-decisions-2026-09-30.sh`, for the owner to run; undo with
`restore-self-decisions-2026-09-30.sh`. **No schema change.**

## What happened
- On 2026-09-29 the owner tapped his own share links on his own Pixel. The app opened them as a receiver's invoice,
  and he could answer them. TE2609002 and TE2609003 were declined; TE2609005 and E-TE2609001 were approved.
- It was not only a test phone. Two real senders approved their own estimates:
  - E-NS2609001 (Ghana, 2026-09-16);
  - E-US2609001 (2026-09-25).
- 16 of the 17 first opens of an estimate link in the app (2026-08-25 to 09-29) were the sender's own. Each one dated
  the link "viewed" for its sender.
- **Root cause** (`ReceivedInvoiceViewModel.load`). The owner check had three gaps:
  - it was switched off in debug builds;
  - it looked only in the invoices table, so an estimate never matched;
  - it looked only in the open account's file, so another account on the same phone counted as a receiver.

## What was decided
1. **A document made on this phone is never answered on this phone.** The phone reads who made it from the rows
   themselves: invoices and estimates, in every account's file, in every build (`DocumentsMadeOnThisPhone`).
2. **The open account's own document** opens as its saved invoice or estimate, the screen with Send. This holds for
   every way in: a link tap, the install referrer, and Tools → Received. It is not dated "viewed", and it is not kept
   as received.
3. **Another account on this phone made it** (the owner's first answer). The app asks, in a small sheet: "This invoice
   was made in your other account '…' on this phone. Open it there?"
   - **Open** switches through the drawer's own switch. It then opens the document on that account's saved screen.
   - **Cancel** changes nothing and goes back.
   - When no switch can show it, the document stays read-only, with a line naming the account:
     - the maker has no place of its own on this phone, or its rows are not in its own file;
     - a switch is already running;
     - the place has gone;
     - the file would not open. This case also says "Couldn't open your other account" and counts `error_shown`.
   - Approve and Decline are never offered, in any case.
4. **The server refuses a decision by the account that made the document** (409 carrying `viewerIsSender`). Nothing
   is recorded. The app withdraws the answer, reports `error_shown` and `shared_invoice_decision_failed`
   `reason=sender`, and opens the sender's own document when the phone holds it.
5. **The wrong data is repaired** (the owner's second and third answers).
   - Every self-decision goes back to PENDING: the 2 real users' and all the internal ones, 10 links.
   - The false "viewed" date is cleared on the real estate links that only their own sender opened: 11 links.
   - 2 more links were first opened by their sender and then by the web page. Their date moves to the first web view.

## The owner's answers (2026-09-30)
1. On the read-only screen for another account's document, the owner asked for the app's own preview screen instead
   (*"usky liye alag sy screen banany ky bajaye jis jo app ki preview screen hy jahan send ka button hy wahin naviagate
   kerna theek nhi rhy ga ager han to ye kro warna koe better option batao"*). Yes: it opens there, after one question,
   because reaching it means opening that account.
2. **(a)** Reset every self-decision back to PENDING: the 2 real users and all internal ones.
3. **(b)** Clear the false `first_viewed_at` on the real estimate links that only their own sender opened.

## Rejected
- **A separate read-only screen for another account's document.** This was `b1c0c08fd`'s first form. The owner chose
  the preview screen. The read-only view stays only for when the switch cannot happen.
- **Switching without asking.** A switch closes every screen of the account being left. It is the person's to decide,
  exactly as in the drawer.
- **Answering on behalf of the other account.** Approving an invoice is the receiver's act. Decision 0154 makes each
  *receiver's* action an account's; it never made the sender their own customer.
- **Trusting the build type or the server alone.** The debug switch is what let the owner answer his own links. The
  server knows only the account that asks, and the web page is anonymous.
- **Leaving the self-decisions in place.** A sender reading "Approved" for something their customer never saw is a G3
  fault.
- **Deleting the links.** Some may still reach their real receivers.
- **Clearing the "viewed" date on links someone else also opened.** Five links stay as they are:
  - E-LA2609001: 3 views against 2 opens by its sender, and the web page kept no link id before 2026-09-21. The other
    viewer and the time are unknown.
  - E-DC2609001: approved on the web by its receiver.
  - E-GE2609002 to 005: already dated by the web page.

## Events
No new event name (AGENTS-EVENTS §1.1, §1.31).
- `shared_invoice_opened_by_owner` gains `account` (`open|other`).
- With `account=other` it also carries `switched` (`true|false`), and, when false, `reason`
  (`cancelled|no_place|busy|not_on_this_phone|failed|too_many_accounts`).
- `shared_invoice_decision_failed` gains `reason=sender`.

## What the phones do after the repair
- **The sender's phone** reads each link's status from the server every time its list opens, and keeps nothing.
  Its tag goes back to its true state on the next open of the list.
- **Nothing ever pushes a decision back.** A decision is sent only by the Approve / Decline call, never by sync.
- **The phone that answered** keeps its own copy in its Received list, still "Approved" or "Declined". When a copy
  from the server says PENDING, the app keeps the decided one (`ReceivedInvoiceMerge`).
  - This affects only those phones: the owner's, the Ghana phone and the E-US phone.
  - From this build, a sender never reaches that screen again.
  - On an older build, the sender could answer again. The server refuses only when the call carries the account's
    pass.
