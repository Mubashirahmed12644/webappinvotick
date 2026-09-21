# 0144 — A reinstalled phone shows the accounts it used before, and a guest comes back only with proof

**Date:** 2026-09-21
**Status:** decided by the owner 2026-09-21 — the proof is a **choice from a list**, not typing (section 3b). Being built.
**Tier 1** (identity and a guest's only copy of their work, goal G3). Owned by the sync agent (0051).
**Related:** 0053 (a guest's work joins an account only on a yes), 0111 (a deleted account), 0143 (a purchase follows
its phone's newest account), rule 11 and rule 28 of `.claude/agents/sync.md` (proof of a phone; a removed phone).

## The owner's words

> "kia ham user ki jitni bhi guest ids aur sign-in ids jo hamari app main use ho ker activities hui hain, inko is
> hisab sy save ker sakty hain ky user app uninstall kerky wapis reinstall kery to wo usko show ker dain ky tum ny in
> ids sy is app ko pehly use kia hua hy?"

Android and iPhone both. Then, the same day: *"isko splash sy move ker ky dikhana hoga"* — the screen comes after the
splash, never on it and never holding it. And a reference: Instagram's returning-user account picker.

## What the data says (production, read-only, 2026-09-21)

Source: `linked_device` (from 2026-07-20) joined with `analytics_sessions_v2` (from 2025-01-01), by the phone's id.
The all-zero id and our own test phones (memory `internal-test-accounts-and-devices`) are left out.

| | Count |
|:--|--:|
| Phones seen with an account | 6,054 |
| Phones that used 2 or more accounts | 192 (Android 178 of 5,765; 21 used 3 or more) |
| Phones that used 2 or more **guests** | 86 |
| Guests after which the same phone started another account | 284 (179 still an un-joined, open guest) |
| **Of them, guests with a live invoice, never used again anywhere** | **32 guests, 212 invoices, on 24 phones** |
| — the next account on that phone was a fresh guest | 31 (210 invoices) |
| — the next account was a signed-in account | 1 (2 invoices) |
| By month the phone moved on | July 2 (3 invoices), August 6 (173), September 24 (36) |
| Invoices per stranded guest | 1: 21 guests · 2–5: 10 · 21+: 1 (163 invoices, 16 clients, 5 businesses) |

All 32 have an Invotick ID. So on these phones the work still exists on the server, under a guest the phone no longer
knows. September alone: 24 guests. The data cannot tell a reinstall from a sign-out; both leave the same trace.

**Found while measuring:** Android's backup is on (`allowBackup="true"`, no rules), so on some reinstalls Android
already brings the whole app back — database, guest session and all. The 32 above are the cases where it did not.
It also restores `device_uuid_prefs` onto a **new** phone, which then speaks with the old phone's id. That is open
item 3, not part of this build.

## What the code says

- **Android:** the phone's id is SHA-256 of `ANDROID_ID`. `ANDROID_ID` is per signing key, per user, per phone; it
  survives a reinstall and changes on a factory reset. So a reinstalled Android phone already sends the same id.
- **iOS:** the id is kept in `NSUserDefaults`, which goes with the install, so every reinstall is a new phone.
- **A guest's key is its own id.** `POST /v1/auth/login-as-guest` with a guest's UUID returns that guest's pass.
  No screen, share link or answer shows a guest's UUID today, and nothing in this design will.
- **The guest-work claim (0053)** asks for the guest's UUID and a phone `linked_device` records for it. So a
  stable phone id opens nothing by itself: without the UUID there is nothing to claim.

## The design

### 1. What the user sees, and when

**Only on the first open of a fresh install** — no local data, no stored session, `is_first_open` true.

- The splash is unchanged: its guest sign-in, its ad wait and its routing stay exactly as they are.
- At the start of the splash, after the new guest has its pass, the app asks the server in the background:
  "which accounts has this phone used?" (a single call, 3 s limit, no retry on this open).
- **When the splash hands off:**
  - if the answer has arrived and lists at least one account → **the picker** is the first screen, in place of
    the usual landing;
  - if it has not arrived, failed, or is empty → the usual landing, exactly as today.
- **If the answer arrives after the hand-off,** it is never a full screen. It is a small card at the top of the
  landing (create-invoice or dashboard): "Pehle is phone par Invotick istemal kiya tha? **Purane accounts dekhein**".
  A tap opens the same picker as a sheet. The card goes when dismissed or chosen, and appears on at most 3 opens.
- **The ad and the picker take turns.** The splash's app-open ad is decided before the hand-off, so the picker only
  ever comes after it. The picker and the card never open while an ad is on screen.

**The mock** (our M3 theme, light and dark; `LAYOUT_RULES.md`: no fixed heights on text, rows that wrap at font 1.5,
`rememberSaveable`, width from `LocalWindowSize`):

```
┌──────────────────────────────────────────┐
│                 [Invotick logo]          │
│                                          │
│   Aap pehle is phone par ye accounts     │
│   istemal kar chuke hain                 │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ (G)  Guest · Invotick ID •••528    › │ │
│ │      163 invoices · 11 Aug 2026      │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ (G)  Google · a•••@gmail.com       › │ │
│ │      Invotick ID •••914 · 2 Sep 2026 │ │
│ └──────────────────────────────────────┘ │
│                                          │
│   [   Kisi aur account se sign in   ]    │  secondary
│                                          │
│   [       Naya shuru karein         ]    │  outlined, bottom
└──────────────────────────────────────────┘
```

Rows, newest first, at most 5: the kind (Guest, or the sign-in method: Google, Apple, email), the masked Invotick ID
(last 3 digits), for a signed-in account its masked email, the number of live invoices, and the last day this phone
used it. The avatar is a plain letter for the kind (G = guest), never a logo.

**No business name, no logo, no client, no full email or phone number.** Why, against the Instagram reference: a
phone is normally reset before it is sold, and a reset gives it a new id, so it shows nothing. But a phone handed on
without a reset (a family member, a shop, a second-hand phone) still has the old id. On that phone a business name
and logo tell a stranger whose phone it was, and the business name is what the guest's proof below asks for. The
Invotick ID, the date and the count are enough for the real owner to recognise their account.

### 2. A signed-in account

A tap opens the normal sign-in for that method (Google, Apple, email code), with the email filled in where the method
has one. Nothing new: the password, Google or Apple is the proof. The fresh guest from this install has done nothing,
so 0053's question never appears.

### 3. A guest account — how the data comes back

Weighed:

| Option | Protects against | Does not protect against | Cost |
|:--|:--|:--|:--|
| **(a) Same phone's id + a question the real owner knows** (built as a choice, 3b) | a sold phone (a reset makes a new id: nothing shown); a phone handed on unreset (the stranger does not know the names); a faked id (it still needs the answer) | someone who knows the owner's business name and holds the unreset phone — a family member, in practice | a small server check, a tries limit; works offline-to-server with no Google or Apple account |
| (a′) Same phone's id alone | a sold phone that was reset | any phone handed on unreset: the next holder gets the old owner's invoices and clients with one tap | none |
| (b) Google Block Store / iCloud Keychain hold the guest's own key | a sold phone (a different Google/Apple account); **also brings the work to a new phone** | a user with no Google/Apple account on the phone, or sync off | a new library on Android; on iOS a synced Keychain item; the key sits in the user's cloud |
| (c) Turn the guest into a signed-in account | everything, once done | nothing after the phone is lost — it must happen before | exists today (a sign-up moves the work, 0053) |

**Recommended: (a) now, (b) as a later step for a new phone, and (c) kept as it is.** (a) answers the owner's case,
the same phone after a reinstall, on both platforms, without trusting the phone's id alone. (a′) is rejected: one tap
on a phone passed on unreset would hand over a stranger's invoices, and G3 outranks the convenience.

How (a) works:
- The picker never holds a guest's UUID. Each row carries a short-lived reference the server signed for this phone.
- The user picks the guest's business and one of its clients from two short lists (3b).
- On a right answer the server hands the phone that guest's pass. The phone signs in as the guest and runs a full
  pull, which brings back every record the server holds. Work the old install never sent is gone with it; the
  screen says so in one line.
- The empty guest this install made is left alone: it has nothing to move.

### 3b. The owner's answer: the proof is a choice, not typing (2026-09-21)

> "saboot mangain, likhny ki soorat main nahi, selection ki soorat main — ky list main sy sahi wala chuny."

Picking one of several is easier to guess than typing, so the choice is built to stay a real proof:

- **Two rounds, one screen each, two taps in the good case.**
  1. "Is account ka business kaunsa hai?": the guest's business (the one with the most invoices) among **5 decoys**.
  2. "In mein se aap ka client kaunsa hai?": the client on the guest's latest invoice among **5 decoys**.
- **The answer is judged only after both rounds**, and a wrong answer never says which round was wrong. Otherwise
  each round could be guessed on its own (6 + 6 tries instead of 36).
- **Odds for a guess: 1/6 × 1/6 = 1/36 per try.**
- **3 wrong tries in total per guest, from any phone, ever.** After the third, that guest cannot be returned on a
  phone; its row says "Support se rabta karein" with the masked ID. So the most a stranger holding an unreset phone
  can get by guessing is 1 − (35/36)³ ≈ **8%**, against 1 − (15/16)³ ≈ 18% a day for 4 choices and 3 tries a day.
  The real owner has 3 chances, and a mistap costs one.
- **The decoys are made up, never read from our database,** so the screen never shows another customer's business or
  client. They come from fixed lists of common business and person names (Roman and Urdu script), shaped like the
  real answer: the same number of words, the same script and the same capitalisation, so the real one does not stand
  out. When the real answer is in a script the lists do not cover, that round uses the fallback below.
- **The same guest always gets the same decoys.** They are chosen from a key only the server holds, plus the guest,
  and only their order changes. If they changed on every try, the one name that stayed would be the answer.
- **Fallbacks, in this order, when a round has nothing to ask:**
  - no live business → an item name from the guest's invoice lines;
  - no live client → an item name, other than one already asked;
  - no item either → **the currency and the month of the guest's first invoice** ("PKR · Aug 2026") among 5
    made-up pairs of common currencies and nearby months.
- **What the choice reveals:** whoever holds the phone sees the real business and client name among 5 made-up ones
  each. That is the price of a choice over typing, and the owner accepted it. The picker's rows still show no name.

Tries are stored on the server (`returning_guest_tries`), never held in memory.

### 4. How it joins the existing rules

- **0053.** Returning to an old guest is signing in as that guest: no work moves between accounts. On the **card**
  (the user may already have started work), guest rows appear only while the current guest has no real work
  (an invoice, estimate or client) and nothing unsent. Otherwise only signed-in accounts are listed, and signing
  into one asks 0053's question as today.
- **0143.** The account chosen becomes the phone's newest, and the launch restore follows 0143 unchanged: a purchase
  the old guest held answers `ALREADY_YOURS`. Choosing "Naya shuru karein" leaves the old accounts untouched; a
  purchase then follows 0143's rules (it moves by itself only from a guest on no other phone, and counts toward the
  3 moves a year).
- **0111, and every account that must not come back.** Never listed: a closed or deleted account (`closed_at`,
  `is_deleted`); a guest that already joined an account (`upgraded_to_user_id`) — its account is listed instead;
  an account that removed this phone (`linked_device.revoked_at`, rule 28); the all-zero id; admin accounts.
- **The sold phone.** Reset → a new id → nothing is shown. Not reset → masked rows only; a signed-in account needs
  its own sign-in; a guest needs the answer.

### 5. iPhone: an id that survives a reinstall

- The id moves into the **Keychain**, saved as "this device only, after first unlock". It survives deleting the app,
  is never copied to iCloud or to another phone from a backup, and is erased with the phone. That matches Android.
- **No iPhone loses its identity:** the first run of the new build copies the `NSUserDefaults` id into the
  Keychain. A reinstall then finds the Keychain id and uses it. When both exist and differ, the install's own id
  wins, because that is the one its guest's proof was recorded under.
- **The old comment's reason, answered:** it kept the id per install so that "a reinstall could not speak for a
  guest whose data it no longer holds". That still holds: the id alone opens nothing. The guest's UUID never leaves
  the server without the answer, and the 0053 claim still needs that UUID.
- Keychain items outliving an app delete is Apple's behaviour today, not a promise. If Apple changes it, iPhones
  simply stop seeing the picker; nothing breaks.

### 6. Privacy and store policy

Checked from memory of the policies; **the exact pages must be re-read before release** (no web access in the
session that wrote this).

- **Google Play Data safety:** "Device or other IDs" is already collected (the phone's id goes with every sync and
  analytics call). Its purposes gain **Account management**, beside App functionality, Analytics and Fraud
  prevention. It stays "not shared".
- **Play User Data policy, persistent identifiers:** the advertising ID must not be connected to a persistent
  device identifier such as SSAID (`ANDROID_ID`) without the user's explicit consent. This design never touches the
  advertising ID. Android's own guidance on identifiers lists account and fraud uses as the place for `ANDROID_ID`,
  and we already hash it.
- **Apple App Privacy:** Identifiers → **Device ID**, linked to the user, purpose App Functionality; **not tracking**
  (it is our own random id, used only inside Invotick, never with another company's data). A random id in the
  Keychain is not fingerprinting. `NSUserDefaults` is already a declared required-reason API; the Keychain is not
  one.
- The picker shows no name, email or phone number, so nothing personal appears to whoever holds the phone.

### 7. What the server and the app need

**Server (`invotick-apis`):**
- `GET /v1/devices/this/accounts`, `@RequireRole(GUEST, USER)`. It reads `X-Device-Id`; the zero id or none answers
  an empty list. It returns at most 5 rows, newest first: the kind, the method, the masked ID and email, the live
  invoice count, the last use, and a signed reference valid for 15 minutes for this phone only. No UUID, name or
  full email is returned.
- `POST /v1/devices/this/accounts/question`, `@RequireRole(GUEST)`: the two rounds for one reference.
- `POST /v1/devices/this/accounts/return`, `@RequireRole(GUEST)`: the reference and both choices. It re-checks every
  rule in section 4, counts the try, and answers the guest's pass or a refusal (`WRONG_ANSWER` with tries left,
  `TOO_MANY_TRIES`, `NO_LONGER_AVAILABLE`) as 409 — never 401, which every build reads as "sign out".
- **A migration, alone and first, on its own branch, on the owner's word:** an index on `linked_device.device_id`
  (today the only index starts with `user_id`, so this read would scan all 6,231 rows), and a small table for the
  tries.
- A Health Centre line: returns offered, answered right, refused, locked.

**App (both platforms, on `VC_107_VN_147`):** the background ask on the first open, the picker screen and sheet, the
card, the question, the switch to the old guest with a full pull, and the iOS Keychain id with its copy-over.

**Events** (through the user-journey agent, per `AGENTS-EVENTS.md`; one action, one event, parameters not names):
- `returning_accounts_shown`: `surface` = `picker|card`, `guests`, `signed_in`, `wait_ms`.
- The choice is the press. The picker's rows and buttons carry their own auto-captured ids, with `kind` =
  `guest|google|apple|email` on a row, so no coded twin fires beside them (the 1.4.3 lesson).
- `returning_guest_answered`: `outcome` = `ok|wrong_answer|too_many_tries|no_longer_available|http_<n>|exception_<Class>`,
  `attempt`. It is coded, because the outcome is the server's, not a press.
- A dismissal is the screen's own close id with `method`, as 0023 says.

## Rejected

- **A typed answer** (the first recommendation). The owner chose a choice from a list (3b).
- **4 choices and 3 tries a day** (the coordinator's example). About 18% a day for a guesser, and it recovers every
  day; 6 choices and 3 tries ever is about 8% in total.
- **Decoys taken from other customers' rows.** They would show strangers' businesses and clients.
- **Saying which round was wrong.** It turns 1/36 into two 1/6 guesses.
- **The phone's id alone brings a guest back** (a′). One tap on an unreset second-hand phone hands over a stranger's
  invoices and clients.
- **The business name and logo on the rows,** as in the Instagram reference. They identify the previous owner to
  whoever holds the phone, and they are the guest's proof.
- **The picker on the splash, or the splash waiting for the answer.** It costs the splash pass-through the owner is
  raising to 98%.
- **A full-screen picker that interrupts after the landing** when the answer is slow. A card instead.
- **Returning the guest's UUID in the list.** It is the guest's key.
- **Listing accounts from `analytics_sessions_v2`.** It is analytics, with a 1970 start date in it. `linked_device`
  is the record of which account used which phone.
- **An iOS id in the synced (iCloud) Keychain.** It would make every phone of one Apple ID the same phone, and break
  rule 11's proof and 0143's "only this phone".

## Open

1. ~~The owner's question: a typed answer or the id alone?~~ **Answered 2026-09-21: a choice from a list (3b).**
   A support tool to give a locked guest its 3 tries back is not built.
2. (b) Block Store / iCloud Keychain for a **new** phone: a later decision, after (a) is measured.
3. Android backup copies `device_uuid_prefs` onto a new phone, which then sends the old phone's id. Excluding that
   one file from backup changes nothing on the same phone (it recomputes the same value). To decide separately.
