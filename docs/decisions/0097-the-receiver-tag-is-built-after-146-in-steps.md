# 0097 — The receiver tag and notification are built after 1.4.6, one step at a time

**Status:** decided by the owner on 2026-09-14 ("1.4.6 ke baad, qadam ba qadam"). Nothing is built yet.

**Related:**
- `docs/RECEIVER-ON-INVOTICK-ANALYSIS.md`;
- `memory/receiver-on-invotick-requirement.md`;
- 0094;
- G2.

## Context

- **The requirement.** A client who uses Invotick carries a tag in the sender's client list. An invoice made in their
  name notifies them in their own app.
- **Today about 60 of 6,306 client rows could match**, under 1%. 96.5% of accounts are guests, with no verified email or
  phone.

## Decided

Build it after 1.4.6 is released, in steps, starting with verified email:
1. **The wording and the receiver's settings.** Each is the owner's decision.
2. **Identity.** Verified email first, because it exists and costs nothing. Phone OTP later, because SMS costs money.
3. **The tag in the sender's client list.** A yes or no per client, never a name.
4. **A notification and an inbox item.** Both open the existing shared-invoice view, with approve and reject.
5. **iPhone push,** once APNs exists.

After each step, measure four things:
- tagged clients;
- notifications opened;
- installs attributed;
- approvals.

## Rejected

- **Building it into 1.4.6.** It would delay 1.4.6, and it reaches about 60 clients today.
- **Not building it for now.**

## Still to decide, one at a time

- **The wording: decided on 2026-09-14 as "On Invotick"** (the owner chose "On Invotick (Recommended)").
  - Rejected: "Invotick verified", which users read as an endorsement that a scam invoice could borrow.
  - Rejected: a bare logo, which a new user would not understand.
- **Identity: decided on 2026-09-14 as automatic, from the user's own actions.** Nobody is asked to verify anything for
  this. The owner asked to "tie it to an action so the experience isn't spoiled".
  - Candidate actions, to be settled in the build:
    - the receiver opens the sender's shared invoice in the app while signed in, or approves or rejects it there;
    - the account's email is already proven (Google sign-in, or the sign-up code) and equals the client's email.
- **The receiver's side: decided the same day.**
  - A setting, "Show that I'm on Invotick", on by default, that the receiver can switch off.
  - A line in the privacy policy.
- **The sender's side, the owner's concern.** A sender may not want every client told that an invoice was made in their
  name.
  - **Decided on 2026-09-14** ("Sirf jab sender bheje"): the receiver hears only when the sender shares the invoice or
    sends a reminder. Creating an invoice alone notifies nobody.
  - Rejected: notifying on creation, and a per-client switch.
- **The goal behind it (the owner):** automatic payment-due messages from the sender to every client with a payment due.
  They go in the app for linked clients, and by WhatsApp.
  - Still to analyse: automatic WhatsApp sending goes through Meta's business platform, whose cost and opt-in rules must
    be checked, unless the sender taps send.
  - "Due" depends on payment status, which the owner's postponed Payments review owns.
