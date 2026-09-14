# The receiver is on Invotick: analysis of the owner's requirement (2026-09-14)

**The requirement, in the owner's words (2026-09-14).** He gave it to his developer for a later stage. Clients in a
user's client list who are themselves Invotick users get a tag ("Invotick verified"). When anyone creates an invoice
in their name, they get a notification in their Invotick app.

He raised it while deciding on `/v1/lookup/phone`, asking two things:
- is removing that route tied to this requirement?
- and he wants a full critical analysis.

**Status:** analysis only. Nothing is decided or built.

## Is removing `/v1/lookup/phone` tied to it? No.

- **What the route returns** is `identity_public_profile.bestName`, with a confidence score and a photo URL. That is
  the name *other users* most often saved for a number in their uploaded address books.
  - They are names of people who are not users: 77,625 of them.
  - It is a Truecaller-style store.
  - The route has been admin-only since 2026-09-13. The app's Contacts "verify" (`ContactsViewModel.kt:124`) has shown
    no name since then, and it had 0 calls in 7 days.
- **The requirement needs a different fact:** is this client a verified Invotick user? The server already holds part
  of that:
  - `registered_phone_lookup`, a registered user's own phone, hashed;
  - the contact status endpoint's `isRegistered` and `registeredUserId`.
- **So the name lookup can go without touching the requirement.**
- **The requirement needs nobody's address book either.** The sender's own clients are the input.

## Today's numbers (production, read-only, 2026-09-14)

| | |
|:--|:--|
| Accounts | 14,731. 96.5% are guests, with no verified email or phone |
| Registered users with a verified email | 422 |
| Users with a phone | 20 |
| Clients | 6,306: 1,011 with a phone (16%), 313 with an email (5%) |
| Clients whose email is a verified user's email | 6 rows: 3 users, from 4 senders |
| Clients whose email is another user's business email | 38 rows, 13 owners |
| Clients whose phone (last 9 digits) is another user's business phone | 15 rows, 14 owners |

So today the tag could light up for about 60 of 6,306 client rows, under 1%. Reach grows only as receivers verify an
identity and senders store their clients' phone or email.

## Pros

- **G2:** a real reason for receivers to open the app. Every invoice becomes a delivery into Invotick, not only a
  WhatsApp image.
- **It joins the approval loop already built:** approve or reject on the shared invoice, and the decision push to
  the sender.
- **Engagement on both sides.**

## Risks, each with a mitigation

1. **Identity is missing.** 96.5% of accounts are guests.
   - Only a verified email or phone can be matched.
   - A business's typed email or phone is not identity: anyone can type any number.
2. **The wrong person.** A mistyped or recycled number would send a stranger someone's invoice (G3).
   - Match on verified identity only.
   - The notification says little ("an invoice from X"). Details open only inside the receiver's own account.
3. **Spam and fake invoices.** Anyone could invoice any verified user, and a "verified" tag would lend credibility to a
   scam invoice.
   - The receiver can allow or block a sender, and report.
   - The tag describes the receiver's account, never the sender's honesty.
4. **The word "verified".** Users read it as "Invotick vouches for them", but we only know they have an account.
   - Say "Invotick par hai" (on Invotick) instead.
5. **Being found.** The tag tells a sender that their client uses Invotick.
   - Give the receiver a setting that lets people who invoice them find them. The default is the owner's call.
6. **iPhone.** There is no APNs yet, so iPhones get no push until the owner sets it up. The in-app inbox still works.
7. **Storage.** The receiver's inbox points to the shared-invoice snapshot, never a copy (invariant 3).

## A phased plan, after 1.4.6

1. **The owner decides** the wording and the consent defaults.
2. **Identity:** verified email first, since it exists and costs nothing. Phone OTP later, since SMS costs money.
3. **The tag in the sender's client list.** The server answers only for the sender's own clients: a yes or no per
   client, never a name.
4. **Delivery.** On share, the matched receiver gets a notification and an inbox item. Both open the existing
   shared-invoice view, with approve and reject.
5. **iOS push,** once APNs exists.

**Measure:** tagged clients, notifications opened, installs attributed, and approvals.

## The owner's decisions (later, one at a time)

- Build it, and when. Recommended: after 1.4.6, in phases.
- The wording. Recommended: "Invotick par hai" rather than "verified".
- Identity. Recommended: email first, phone OTP later.
- Receiver defaults: who may deliver to me, and whether I can be found.
