# 0095 — The app stops sending the address book; the server's receiving route closes later

**Status:** decided by the owner on 2026-09-14. It is being built for 1.4.6. Their words:
> "server sy any waly rasty ko baad main band keraingy pehly app ky send kerny waly rasty ko band kerty hian jab app
> send hi nahi kery gi tu us rasty ko baad main bhi band kiya jaa sakta hy"

**Related:**
- 0094, which removed the name lookup built on this data;
- `memory/contacts-upload-privacy.md`;
- `docs/RECEIVER-ON-INVOTICK-ANALYSIS.md`;
- G3.

## Context

- **What happens.** "Import from contacts" reads every contact on the phone. The app then sends the **whole** list to
  `POST /v1/contacts/ingest`: names, numbers and emails, in plaintext.
  - The user picks one client, but all of the list is sent.
  - It sends again whenever the list changes.
  - On Android a background job retries it every 15 minutes until it succeeds.
  - This is verified in code for 1.4.5 (`VC_96_VN_144`) and 1.4.6 (`VC_102_VN_146`) alike.
- **What the user is told:** only "Invotick needs access to your contacts to quickly import clients when creating
  invoices."
  - Nothing says the list leaves the phone.
  - The website's privacy page never mentions contacts.
  - Play's User Data policy requires a prominent disclosure and consent before a contact list is uploaded.
- **What it gives: nothing in the product.**
  - Its one real use was the name lookup, removed in 0094.
  - `/v1/contacts/status` reads only the registered users' own numbers, and the app never calls it.
  - The owner's receiver requirement works from the sender's own clients.
- **Counts on 2026-09-14** (read-only, counts only):

  | Measure | Value |
  |---|---|
  | Accounts that uploaded | 530 (487 guests) |
  | Contacts stored | 393,974 |
  | Emails among them | 2,407 |
  | Raw copies | 544,179 |
  | Database space | about 740 MB |
  | Uploads a day, before 2026-09-03 | about 1 |
  | Uploads a day, since 2026-09-03 | 20–50 (276 in the week to 09-13) |

## Decided

- **1.4.6 stops sending the address book.**
  - Every call that sends it is removed:
    - the client form;
    - the invoice's client sheet;
    - the Android background job;
    - the debug Contacts screen's "Push All".
  - The upload plumbing is removed with them.
  - "Import from contacts" keeps working on the phone. Only the chosen client is saved, as today.
- **The server keeps `/v1/contacts/ingest` open for now.** It is closed later, once the app no longer sends.
- **The data already stored** is asked separately.

## Rejected

- **Closing the server route now as well.** This was the recommendation: accept and discard, so old builds stop at
  once, with no release. The owner chose the app first.
- **Keeping the upload behind a consent screen.** The people in the list would still not have agreed.
- **Leaving it as it is.**

## Consequences

- **Old builds keep sending.** Until phones move to 1.4.6, builds up to 1.4.5 keep sending lists (20–50 a day since
  2026-09-03), and the server keeps storing them.
- **The measure.** The daily count in `contact_ingest_batches` shows how many old-build phones still send. It falls as
  1.4.6 spreads, so it is the signal for closing the route.
- **Nothing else changes for users.**
