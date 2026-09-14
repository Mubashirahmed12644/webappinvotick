# 0096 — The contacts already on the server are kept, for a marketing plan still to be made

**Status:** decided by the owner on 2026-09-14. Their words:
> "is ko rakho in contacts per ham app ki marketing ka koe plan banaingy ager result mila to contact list get kerny ka
> wo flow jo abhi band kia hy isko policy complainced ker ky dobara run keraingy"

**Related:**
- 0094, where the name lookup went;
- 0095, where the app stops sending and the server route closes later;
- `memory/contacts-upload-privacy.md`;
- G2 and G3.

## Context

- **What is stored:**
  - 393,974 contacts (a name and a number) from 510 accounts, mostly guests;
  - 2,407 of them with an email;
  - 544,179 raw copies, stored exactly as sent;
  - about 740 MB in all.
- **Nothing in the product reads it** since 0094. The admin panel's Contact Data page shows its counts and a list.
- **Builds up to 1.4.5 keep adding to it** until the server route closes (0095).

## Decided

- **Keep everything stored. Nothing is deleted:**
  - `contact_ingest_batches`;
  - `raw_contacts`;
  - `user_contacts`;
  - `contact_identities`;
  - `identity_claims`;
  - `identity_public_profile`.
- **The owner plans a marketing use of these contacts.** If it gives results, the upload returns in a form that complies
  with policy.

## Rejected

- **Delete it now.** This was the recommendation.
- **Delete it when the server route closes.**

## Before any use

This is written down so the plan starts from it.

- **The people in these lists never agreed to anything.** The users who uploaded them were told only that contacts were
  read "to quickly import clients".
- **Google Play's User Data policy** limits use of this data to what the user was told and would reasonably expect.
  - Marketing to the contacts is neither.
  - A violation can mean a rejected update or the app's removal.
- **Unsolicited marketing messages** are regulated.
  - Pakistan's PECA 2016 has a spamming section: the recipient's permission and an opt-out.
  - Australia, the EU and the US require prior consent, and the app has users in several countries.
  - This is not legal advice. The plan needs a lawyer's review before any message is sent.
- **Trust (G3).** A recipient learns that a friend's phonebook was uploaded, and the friend is our user. AGENTS.md:
  never trade G3 for G2.
- **A compliant route to the same goal:**
  - users invite people themselves, from their own phone (a share or invite);
  - the invoice share link, the existing G2 surface.
- **Security.** The data is stored in plaintext, and the admin panel lists it. A breach would expose about 394,000
  people who are not users.

## Consequences

- **The store stays and grows.** About 740 MB now, with 20–50 more lists a day until the route closes.
- **Unchanged:** the Contact Data page, and every other part of the product.
