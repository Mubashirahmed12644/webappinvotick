# 0145 — A phone linked to a guest by QR is a guest, with the same Invotick ID

**Date:** 2026-09-21
**Status:** built (backend `fix/linked-guest-phone` and `fix/linked-guest-merge`, app `fix/147-linked-guest-phone`); not
deployed, not released. The owner answered the open question on 2026-09-21: **(a)**.
**Tier 1** (identity; a guest has no password to come back with). Owned by the sync agent (0051).
**Related:** 0041 (an account's premium reaches every device), 0053 (a guest's work joins an account), 0086 (the pull
bookmark), 0099 / rule 28 (a removed phone), 0144 (a reinstalled phone's account picker — built alongside, compatible).

## The owner's words

> "main ny ek guest user sy dosri device main QR code link ky through joda, to dosri device main data to aa gaya, but
> UUID nahi show ker raha yahan. Aur check kero ky or kia kia cheezain miss hain is flow main."

## What the data says (production, read-only, 2026-09-21)

- The guest is `cd860dc4` (Invotick ID 922440441), made at 09:51 UTC on the Samsung SM-G998B (`5144be8f`). The Xiaomi
  (`aea3c770`, 09:54) and the Pixel 7 Pro (`e2c25d6f`, 09:57) joined it by QR. All three `linked_device` rows are live;
  `platform` is NULL on all three.
- The Pixel reports its events under `user_id = cd860dc4` from 09:57:12 (153 events to 10:51). Before, for 25 s, it was
  its own guest `76031c98`, which holds 1 business ("Test Businees"), 1 invoice and 1 client on the server.
- The account's rows (1 business "Premium Testing", 1 invoice, 1 client) were all written by the Samsung.
- The account holds **no** premium on the server. The Samsung's two test purchases are bound to account `3073cee4`
  (the Samsung's earlier registered account), and our copies read EXPIRED since 09:22 and 10:07. The Samsung shows
  premium on Play's own flag.
- Ever: 41 links claimed, **29 into a guest** (24 browsers, 5 Android phones), 12 into a registered account.

## What the code says (1.4.7)

1. `DeviceLinkViewModel` signed every link in with `onLoginSuccess` — a registered session — whatever the account.
   The server's answer carried the pass, the id and the Invotick ID (`shortCode`), and no role; the phone dropped the
   Invotick ID. So the drawer showed "User" and no ID; Sign Out instead of Sign In / Create Account; and a 401 outside
   sync would sign the phone out to a sign-in screen no guest can pass (`AuthInterceptorPlugin`).
2. Sign Out on such a phone takes the registered path: its pass is revoked (only its own), its unsent work leaves with
   a drain pass, and its copy is erased once nothing is owed (`purgeOrDefer`). The account and the other phone are
   untouched. The phone can come back only by being linked again from a phone of the guest: with none left, the guest
   is out of reach.
3. The selected business is one setting per phone (`default_business_id`), never cleared on an account switch, and
   `ensureDefaultBusiness` filled it only when empty. The Pixel kept `76031c98`'s business, so the drawer found none of
   the account's selected: "Add Business" over "Premium Testing". A business added there is not the account's first,
   so it never became selected either — the drawer kept saying "Add Business".
4. The claim's body held the code alone, so the server never recorded an Android phone at the claim, and never let back
   in a phone that had been removed and was approved again (`DeviceLinkService.claim` readmits only with a `deviceId`).
5. An iPhone asked to be linked as `ANDROID` (hard-coded in shared code).

## Decided (the sync agent, on the owner's ask to fix the flow)

- **The server's answer says the account's role** (`role`), and for a registered account its `email` and `displayName`.
  A guest's stored email is an internal key and is never handed out. Additive.
- **The phone becomes what the account is** (`AdoptLinkedSession`): a guest session for a guest, a registered one
  otherwise. The role comes from the answer, or else from the pass's own `role` claim (the same server's word). The
  Invotick ID in the answer is kept at once, under the account. A registered account's profile is loaded for the drawer.
- **A phone that 1.4.7 stored this way comes back as a guest** at its first start on the fix: a registered session
  whose pass says GUEST is restored and stored as a guest (`SessionManager.asThePassSays`). Only a device-link ever
  stored a guest's pass that way.
- **A stored business the account does not hold is replaced by the account's first** (`DefaultBusiness.choose`).
- **The claim names its phone** (`deviceId`), and an iPhone says `IOS`.

## Rejected

- **Leaving the phone registered and only drawing the guest header.** The header is the least of it: the 401 path, the
  removed-phone notice (rule 28) and Sign Out all read the session's kind.
- **Reading the role only from the pass.** The answer is the contract; the pass is only the fallback for an older
  server.
- **Clearing the selected business on every sign-out.** Every sign-in path would then need to set it; choosing on
  mismatch covers every path, the link included.
- **A server-side fix for phones already on 1.4.7.** 1.4.7 ignores any field it does not know; nothing the server says
  changes what it stores. On 1.4.7 the Invotick ID appears after the app is closed and opened (the drawer asks the server
  once per start), and picking the business in Manage Business selects it.

## Still open

- ~~A linking phone's own earlier guest work is left behind, hidden~~ — answered (a) and built, below.
- **One guest on two phones, and one of them creates an account:** the claim moves the work and retires the guest
  (`is_active = 0`), and the other phone's guest pass stops working with nothing to tell it. Existed before this change
  (from either phone). Needs its own decision.
- **Sync between the two phones:** a phone's own push moves its pull bookmark, so a record the other phone wrote more
  than 60 s before can be skipped until a full pull (0086, decided, not built).
- **Premium:** correct by the server's copy. Whether the Samsung's purchase should have followed it into the new guest
  is 0143's question, the billing agent's.
- **Browsers linked to a guest** (24 of 29): the web's own handling was not checked here.

## The owner's question, and his answer (2026-09-21)

What should happen to a phone's own earlier work when it joins another account by QR?

- **(a) Ask before linking, and on "yes" merge the phone's own work into the linked account. — CHOSEN.**
- (b) Keep it hidden on the phone. — rejected: that is the defect.
- (c) Refuse to link until the person decides elsewhere. — rejected: a question on the spot is the same decision
  without sending the person away.

## Built for (a)

- **Asked before the link completes** (`LinkedPhoneWork.prepare`, app). After the claim, before the phone signs in
  with the pass it collected: a guest phone with any work of its own (a business, a product, an invoice, anything
  that syncs) sees "This phone already has its own work — 1 business, 1 invoice, 1 client. Add it to this account?"
  with **Add it** / **No, just link**. The screen is English, as the rest of it is; the owner's words were
  "Mila dein" / "Nahi, sirf jor dein".
- **One claim, not a copy** (`GuestWorkCoordinator.afterDeviceLink`). Yes is the move a "yes" after a sign-in makes:
  rows re-owned on the phone at once, nothing queued again, `POST /v2/guest-work` MOVE, pushes held until the server
  moves its copy; idempotent, resumed at every start, refusals named (`NO_PROOF`, `NOT_AN_ACCOUNT`, …, reported as
  `sync_failed stage=guest_claim`).
- **The server lets a guest account take it only here** (`GuestWorkClaim.claim`, backend `fix/linked-guest-merge`):
  the app's own yes or no, and only when the calling phone is linked to both the old guest and the account (the
  device-link claim records that). An old build's push and the repair still take work into a registered account
  alone. Suite 1322/1322; 3 of 3 new cases failed first.
- **No is not hidden.** The work stays under its guest; its unsent part is sent under its own pass (0053's keep);
  the confirmation says so, and Linked Devices shows "Work kept apart on this phone … Add it to this account", which
  runs the same claim (`addKeptWork`).
- **Same-name business.** The phone reads the account's business names with the linked pass (`GET /v1/businesses`,
  existing) and names each of its own businesses with the same name: "both are kept, so you will see two businesses
  with that name; you can remove one in Manage Business". When the list cannot be read, the question says it could
  not check. Businesses are never merged into one: each carries its own invoices.
- **Premium** is not touched: a purchase follows its phone's accounts by 0143's rules.
- **The choice's event:** the two buttons are auto-captured taps, `DeviceLinkScreen.add_own_work_12` and
  `DeviceLinkScreen.keep_own_work_13`, plus `add_kept_work_14` (AGENTS-EVENTS §1.3: the automatic channel, switchable
  from the panel; no coded twin, §1.11). The server counts each move in `guest_work_claims_total{path="app"}`.
- **Only a guest's work is asked about:** the claim takes a guest's work and nothing else. A registered phone's work is
  on the server under its own account already.
- Guards: `APhoneJoiningAnAccountIsAskedAboutItsOwnWorkTest` (8; did not compile first, 15 errors), the 3 new cases in
  `AGuestsWorkMovesInOneStepTest`.

### Deploy order

**Server first** (`fix/linked-guest-merge`). An app with this change against today's server gets `NOT_AN_ACCOUNT` for a
guest account: the work would show under the account on the phone while the server keeps it under the old guest.

### Boundaries

- The claimed link waits for the answer in memory. If the app dies before the answer, the phone stays its own guest and
  must be linked again (the code is spent).
- The phone holds one pending decision. A later sign-in that asks its own question replaces a "no" kept here; the work
  stays on the phone under its guest, but the Linked Devices line goes.
- A registered phone that links elsewhere leaves its unsent work queued under its account until it signs in there
  again.
