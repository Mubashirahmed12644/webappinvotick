# 0145 — A phone linked to a guest by QR is a guest, with the same Invotick ID

**Date:** 2026-09-21
**Status:** built (backend `fix/linked-guest-phone`, app `fix/147-linked-guest-phone`); not deployed, not released.
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

- **A linking phone's own earlier guest work** is left behind, hidden and unsent, under its old guest (the Pixel's
  `76031c98`: 1 business, 1 invoice, 1 client). No question is asked. The owner's question (below).
- **One guest on two phones, and one of them creates an account:** the claim moves the work and retires the guest
  (`is_active = 0`), and the other phone's guest pass stops working with nothing to tell it. Existed before this change
  (from either phone). Needs its own decision.
- **Sync between the two phones:** a phone's own push moves its pull bookmark, so a record the other phone wrote more
  than 60 s before can be skipped until a full pull (0086, decided, not built).
- **Premium:** correct by the server's copy. Whether the Samsung's purchase should have followed it into the new guest
  is 0143's question, the billing agent's.
- **Browsers linked to a guest** (24 of 29): the web's own handling was not checked here.

## The owner's question

What should happen to a phone's own earlier work when it joins another account by QR?
