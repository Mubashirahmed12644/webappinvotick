# 0143 — A purchase follows its phone's newest account: by itself from a guest, with a yes from a signed-in account, three times a year

**Date:** 2026-09-21
**Status:** decided by the owner 2026-09-21; built on branches — backend `feat/purchase-moves-to-the-latest-account`
`9b6f8a6`, app `feat/148-premium-moves-with-consent` `e0d42101`, panel `feat/purchase-move-reset` `e641466`. Nothing
merged or deployed.
**Tier 1** (money and trust, goal G3). Rules 1, 3, 4, 9 and 11 of `.claude/agents/billing.md` still hold unchanged.

---

## The owner's words

> "ager ek premium device sy jo bhi latest yani aakhri wali UUID ho, us ko premium assign ker dain aur old wali UUID
> sy hata dain … aur ye turn bhi ham limited dain — ek premium device sy just 3 latest UUID ko premium diya ja sakta
> hy, 4thi per deny ker dena chahiye."

After the pros and cons he chose the safe shape:

1. **From a guest, the purchase moves by itself** to the newest account on that phone.
2. **From a signed-in account, it moves only with the user's yes.** The app asks in plain words; no silent move away
   from a signed-in account, because that account may be premium on a tablet or the web.
3. **Three moves in any rolling 12 months** per purchase, not three for life. The 4th is refused with a clear message,
   and the purchase stays where it is.
4. **Support can reset the count** in the admin panel, audited in the binding log with who and why, on the page that
   already shows the purchase — never a new sidebar page.

## What was true before

- `POST /v1/billing/restore` never moved anything: a purchase held by another account answered
  `BELONGS_TO_ANOTHER_ACCOUNT`, and the phone stayed premium on Play's word (0047).
- **`POST /v1/billing/purchase` moved a purchase silently, from anyone.** `bind()` took the grant from whichever account
  held it. Production, read 2026-09-21: 40 binding-log rows; 31 are an account re-registering its own purchase, and
  **2 are real moves**, both from a guest (2026-08-27 guest → guest, no device id; 2026-09-21 09:12 guest → user).
  It also moved a purchase off a **closed** account, which rule 11 says must wait 30 days untouched.
- Production today: 7 purchases (5 bound once, 2 bound twice), 7 grants on 5 accounts, 4 `ALREADY_YOURS` restore
  rows, 0 `BELONGS_TO_ANOTHER_ACCOUNT`.

## The design

### Where a move can happen — one place

`PurchaseMovePolicy` on the server decides every change of account. Both roads call it, **after** the store has
confirmed the purchase in that same call (rule 4: a restore with no store answer never reaches it):

| Road | Who calls it, when | What it may do |
|---|---|---|
| `POST /v1/billing/restore` | every app launch (billing connects), for each purchase Play/StoreKit holds on the phone; and "Restore purchases" | move, ask, or refuse |
| `POST /v1/billing/purchase` | a purchase just made on the phone | move only by itself (it never carries a yes) |

The app's launch restore is exactly the owner's "newest account on a premium phone": it runs as whichever account is
signed in on that phone now, with the store token that phone holds.

### How the decision is made (in this order)

1. **The same account already holds it** → nothing moves (`ALREADY_YOURS`).
2. **The holding account is closed** (rule 11, `users.closed_at`) → never moves; `BELONGS_TO_ANOTHER_ACCOUNT` names it,
   as rule 11 says.
3. **Does it need a yes?** It moves **by itself** only when the holder is a **guest** (`users.role = GUEST`) **and
   that guest is on no other phone**: no un-removed `linked_device` row of the guest other than the phone asking.
   Everything else needs the user's yes:
   - a signed-in account (`USER`/`ADMIN`) — it may be premium on a tablet or the web;
   - a guest that is also on another phone. **Correction to the premise "a guest has no other devices":** a guest
     *can* have a second phone, by device link (decision 0099 speaks of it), and that phone reads the guest's grant
     (0041). Such a guest is treated like a signed-in account, so nobody loses premium without being asked;
   - a request with no `X-Device-Id` (builds up to 1.4.5): "only on this phone" cannot be proved, so it is not
     assumed.
   Android's device id is `ANDROID_ID`, which survives a reinstall, so the same phone is recognised as the same phone.
4. **The cap.** Moves counted = binding-log rows of this purchase where `from_user_id` is set and differs from
   `to_user_id`, created in the last **365 days**, and after the latest support reset. A first binding, and an account
   re-registering its own purchase, are not moves. **3 or more → refused** (`MOVE_LIMIT_REACHED`), with the date the
   oldest counted move leaves the window (`moveAllowedAgainAt`). The two production moves above count: purchase
   `C102229D…` has used 1 of its 3 until 2027-09-21.
5. Otherwise it moves: the grant row changes account, `account_binding_count` +1, one binding-log row (reason
   `RESTORE` or `PURCHASE`, with the device).

The purchase's row is locked (`SELECT … FOR UPDATE`) while this runs, so two phones cannot both take move number 3.

### What each app build receives

A new request field on restore, `moveConsent`:

| Sent | Who sends it | A move by itself (guest on this phone only) | A move that needs a yes | Cap reached |
|---|---|---|---|---|
| absent | **every build in people's hands (≤ 1.4.7)**, and iOS so far | **not made** — `BELONGS_TO_ANOTHER_ACCOUNT`, exactly as today | `BELONGS_TO_ANOTHER_ACCOUNT` | `BELONGS_TO_ANOTHER_ACCOUNT` |
| `false` | the next release, on every launch | made → `RESTORED` | `MOVE_NEEDS_CONSENT` + owner's Invotick ID + `movesLeft` | `MOVE_LIMIT_REACHED` + owner's ID + `moveAllowedAgainAt` |
| `true` | the next release, after the user says yes | made → `RESTORED` | made → `RESTORED` | `MOVE_LIMIT_REACHED` |

On the purchase road, a purchase held by another account moves only when it may move by itself and the cap allows it.
Otherwise it stays, and the answer is the same 200 with the purchase's entitlement the app receives today — the phone
is premium on Play's word either way (rule 1) and nothing on the phone reads the difference. A refusal on that road is
recorded like a restore's, so the Health Centre counts it.

**What an old build sees is unchanged, and this is proven by tests:** the same statuses, the same outcomes, the same
fields it knows (new fields arrive empty; every release branch checked, back to 1.3.9, reads JSON with `ignoreUnknownKeys`). The one change for
an old build is on the server: its purchase report no longer takes a purchase away from a signed-in or closed account.
That is the owner's rule 2, closing the hole described above — not a change of what the phone shows.

### What the user sees

| Case | On the phone asking | On the old account's other devices |
|---|---|---|
| Guest on this phone only → moves by itself | nothing to answer; premium was already on (Play) and now the account is premium on every device (0041) | none exist |
| Signed-in account holds it | once, a question: **"Move Premium to this account?** Your Premium purchase is saved to Invotick ID 123456789. Move it to the account you are using now? Premium will then stop on that account's other devices. This phone stays Premium either way." — **Move here** / **Not now** | premium ends at their next daily check (below) — only after a yes |
| "Not now" | nothing changes anywhere; not asked again at launch for 30 days for that purchase on that account — pressing **Restore purchases** asks again at once | unchanged |
| 4th move in 12 months | once: **"Premium can't move again yet.** This purchase has already moved between accounts 3 times in the last 12 months, so it stays with Invotick ID 123456789. This phone stays Premium. For help, contact support@invotick.com." — **OK** | unchanged — they keep premium |
| Yes, but the store could not be asked | "Could not move Premium right now. Please try again." Nothing moved; the question stays | unchanged |

No dark pattern: "Not now" is a full button, not a link; dismissing the dialog counts as "Not now"; the phone asking
keeps premium in every branch, so nobody is pushed by fear of losing it.

### The old account's other devices — when they notice

They hold the account's grant as a date (0041) and ask `GET /v1/billing/entitlement` at most once a day after the
splash. After a move that account holds no live grant, so the next answer is a 200 "no" and the grant ends there.
Offline, a device keeps it until it next asks or its stored date passes — inside the store's refund window that is at
most a day; after it, it can be the plan's date, exactly as for a refund after the window (Known gap #9, closed by the
owner's design). A phone whose own Google/Apple account holds the purchase stays premium on the store's word
regardless (rule 1) — the move is only about the account's grant.

### A refund or cancellation after a move

There is one grant row per purchase (`uk_entitlement_purchase`), and a move changes only its account. A refund,
revocation, expiry or cancellation — by notification, by the daily check (0140), or by a device's check — finds that
row by the purchase and ends it **on whichever account holds it now**. The account it moved away from has nothing left
to end. A move never revives an ended purchase: the store must confirm it as valid in the same call.

### Support reset

`POST /v2/admin/billing/purchases/moves/reset` (ADMIN only) with the purchase's store id and a **required** reason.
It writes one binding-log row: reason `MOVE_COUNT_RESET`, from = to = the current holder (so it is never itself a
move), and `device_id` = `admin:<admin user id> <why>` (the log has no note column — see "rejected"). The count starts
again after that row. It never touches Google or Apple, the grant, or its account.

The button sits in **Billing Health** (the Health Centre card's drill-down), in the table of purchases that already
lists each purchase with its accounts, which now also shows moves in the last 12 months and refusals.

### Health Centre

- Kept: the "purchases used across several accounts" list and the `accountBindingCount` it shows.
- Added: **refused 4th moves (30 days)** on the `billing-integrity` card and on the drill-down — distinct accounts told
  no. One or more makes the card a **warning**: a real person may be stuck and support can reset.
- `MOVE_NEEDS_CONSENT` and `MOVE_LIMIT_REACHED` count as "premium through another account's purchase", like
  `BELONGS_TO_ANOTHER_ACCOUNT`, so those phones are never reported as "premium without payment".

## Rejected

- **Moving by itself from any account** (the owner's first idea, literally). A signed-in account may be premium on a
  tablet or the web, and would lose it with no warning. The owner chose consent.
- **Three moves for life.** A family phone or a honest reinstaller would run out for ever; a rolling year recovers.
- **Auto-moving from a guest for builds already in people's hands.** Those builds cannot show the cap's refusal and do
  not know the new answers; and the lead's requirement was that an old build behave exactly as today. They keep
  `BELONGS_TO_ANOTHER_ACCOUNT`; the move arrives with the release.
- **Keeping the purchase road's silent move** "because old builds do it". It is the very move the owner forbade, and it
  also broke rule 11 for a closed account. Closed, with the old build's answer unchanged.
- **Treating every guest as alone.** Device-linked guests exist; see step 3.
- **Asking at every launch until answered.** A nag. "Not now" holds for 30 days.
- **Never asking again after "Not now".** A mistaken tap would strand the purchase; 30 days, then once more.
- **A migration for a note column on the binding log** (who/why of a reset in their own columns). Cleaner, but a
  migration ships alone on the owner's word, and the existing `device_id` (128 characters) carries `admin:<id> <why>`
  for a rare admin action. Worth doing if resets become common.
- **A new admin page for resets.** The owner's standing rule: health lives in the Health Centre; the purchase already
  has a place.
- **Counting from `account_binding_count`.** It is a lifetime counter with no dates; the log has the dates.

## What ships when

- **Server — can deploy now.** No migration. Old builds get exactly today's answers (tests below); the only server-side
  change they meet is that the purchase road no longer silently takes a purchase from a signed-in or closed account.
- **App (Android + iOS, shared code) — with the next release.** Sends `moveConsent`, asks the question, shows the
  refusal. Against a server without this change it sends a field the server ignores and behaves exactly like 1.4.7.
- **Admin panel — with the server** (the reset button calls the new endpoint).

### The off switch

`billing.purchase-moves.enabled` (env `BILLING_PURCHASE_MOVES_ENABLED`, default `true`). Off: no purchase changes
account on either road, every build gets `BELONGS_TO_ANOTHER_ACCOUNT`, and so the app's question never appears.

## Built

| Repo | Branch | Head | Tests |
|---|---|---|---|
| `invotick-apis` | `feat/purchase-moves-to-the-latest-account` (from `stage` `c79976b`) | `9b6f8a6` | 29 new: 21 service (**13 fail with stage's behaviour put back**; the 8 that pass both ways are the old-build, no-Google-answer, Google-refusal, closed-account, guest-report and reset cases, which must hold before and after), 3 on a real MySQL (the BINARY(16) id comparisons), 3 on the wire (an old build's body reaches the service with no consent), 2 on the card. Suite **1,328/1,328** incl. `SpringContextBootTest` and `MigrationsApplyToLiveSchemaTest`. No migration. |
| `invoice-kmp-app` | `feat/148-premium-moves-with-consent` (from `VC_107_VN_147` `64106a7f`) | `e0d42101` | `PremiumMoveAsksOnceTest` 10, `RestoreSaysItCanAskTest` 3, `AppStorePurchasesTest` +3 (**red** with only BELONGS treated as held elsewhere). domain 68/68, data 325/325, core:premium 22/22, feature:premium 16/16; composeApp compiles for Android and `iosSimulatorArm64`. Not run on a device. |
| `invotick-admin-panel` | `feat/purchase-move-reset` (from `main` `71e201d`) | `e641466` | `tsc` clean, eslint clean on the changed files. Not opened in a browser. |

Rows each call touches: one purchase's binding-log rows (indexed by purchase, a handful under the cap) and one
account's `linked_device` rows; the Health drill-down adds one such read per listed purchase (at most 50 refused).
