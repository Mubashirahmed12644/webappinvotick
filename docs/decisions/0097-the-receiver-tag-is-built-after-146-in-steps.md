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

- **The wording.** Recommended: "Invotick par hai" rather than "verified".
- **The identity method.** Recommended: email first.
- **The receiver's defaults:** who may deliver to them, and whether they can be found.
