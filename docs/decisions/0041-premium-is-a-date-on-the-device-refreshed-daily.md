# 0041 — Premium is a date on the device, refreshed daily

**Date:** 2026-09-07 · **Status:** planned, awaiting the owner's approval before any code
**Touches:** `core/premium`, `domain/billing`, backend `EntitlementController`

## Context

The owner asked a plain question: if a user buys premium on one device, does every device of theirs
get it, and do cancel, expiry and renewal all land correctly?

Measured on 2026-09-07, the answer is **half yes**, and the half that fails is not the half anyone
would guess.

**What is already right.** `Entitlement` is bound to `userId`, not to a device
(`model/billing/Entitlement.kt:71`). The Play notification endpoint re-verifies with Play on every
notification rather than trusting the notification's own type, so cancel, expiry and renewal all
travel one path (`PlayNotificationController.kt:92`). A refund arrives as `voidedPurchaseNotification`
and is applied as `REFUNDED` with `expiresAt = null` within seconds (`:80-88`). And
`restorePurchases()` refuses to revoke when Play does not answer — *"leaving premium untouched"*
(`BillingRepositoryImpl.kt:434-440`), which is the G3-safe reading of a failed call and was already
written correctly.

**What is wrong.** Premium reaches a device only through Play's own record of that **Google account**.
`ServerPurchaseVerification.currentEntitlement()` exists to ask our server directly — and has **zero
callers**. Verified with a control: `isPremium()` returns 8 callers from the same grep, so the empty
result is a finding and not a failed search.

So today it is *Google account premium*, not *Invotick user premium*:

| device | works? | why |
|---|---|---|
| the one it was bought on | yes | Play holds the purchase |
| another device, same Google account | yes | Play returns it there too |
| another device, **different Google account** | **no** | Play returns nothing; nothing asks our server |
| iOS | no | `core/premium` has no `iosMain` at all |
| Amazon | no | not even in `PurchaseProvider` (`GOOGLE_PLAY, APPLE_APP_STORE, STRIPE`) |

## The owner's constraints, in his words

1. **Nothing may load the splash.** The check runs after it, never inside it.
2. **First open has no justification for checking.** A new device with no login has nothing to ask
   about.
3. **Same-Google-account premium must keep working** — and it already does; leave that path alone.
4. **Keep the plan's duration on the device.** The system is *hybrid*: local date and server call
   together.
5. **Turning premium off matters as much as turning it on.** My first proposal said the server should
   only ever grant, never revoke — he asked how premium would then ever switch off on a device that
   has no Google purchase to lose. It would not. That proposal made premium immortal.
6. **Neither is a race.** Calmly, after the splash: *"tell me how many days are left."*

### A distinction he had to make twice

I read constraint 4 as *"call less often"* and proposed a seven-day window. That conflated two
things he was keeping apart:

> **Removing the dependency** means a failed call does not hurt the user.
> **Delaying the duty** means calling less often.

The local date buys the first. It is not an argument for the second. The call stays daily; the date
is the net under it.

## Decision

Premium on a device is **a date, not a flag**, and two dates bound it:

```
planExpiresAt   what the server last said the plan runs until
verifiedUntil   the last successful check + 24h of slack

premium  =  now < planExpiresAt  AND  now < verifiedUntil
```

Whichever expires first wins. Today the device stores a bare boolean
(`PremiumRepositoryImpl.kt:23`), which is why the refund hole below exists at all.

### The refund hole, which the owner found

A one-year plan bought and refunded inside Play's 48-hour window would, under a
`premiumUntil = +365 days` design, hand out **a free year**. The server knows within seconds — the
device would never ask again.

`verifiedUntil` closes it: the device coasts at most 24 hours on any one answer.

| | plan-date only | both dates, daily |
|---|---|---|
| free time after a refund | **365 days** | **≤ 1 day** |

### What happens on each outcome

| server said | device does |
|---|---|
| premium, until date X | `planExpiresAt = X`, `verifiedUntil = now + 24h` |
| **not premium** | **both cleared — premium off** |
| *nothing* — offline, 5xx, timeout | **untouched**; the existing dates keep running |

The decision is made on **whether an answer arrived**, not on which way it points. That is the same
shape `restorePurchases()` already uses, and it is why a server outage cannot cost a paying customer
their premium.

### When it runs

After the splash has handed off — never inside it — and at most once per 24 hours however many times
the app is opened. Skipped entirely for a guest who has never bought anything: per constraint 2,
there is nothing to ask.

Cost, measured: **12,924** users at most one call a day, against **27,240 analytics events a day**
already flowing. Under half of what analytics does unremarked. The seven-day window was solving a
problem that did not exist.

## Rejected

- **Ask on every launch.** No extra safety over daily — Play's refund window is 48 hours — and it
  makes premium feel like it depends on the network, which is the thing constraint 4 exists to
  prevent.
- **Server grants only, never revokes** (my first proposal). Premium would never switch off on any
  device without a Play purchase to lose. Named here because it sounds safe and is not.
- **Plan date alone, no verification window.** The refund hole. A free year for a 48-hour purchase.
- **Seven-day window.** Solved a load problem that the numbers say does not exist, and gave a
  refunder seven free days instead of one.
- **Trusting `notificationType` on RTDN instead of re-verifying.** Already rejected in the code that
  exists; re-verification is what makes cancel, expiry and renewal one path instead of three.

## Plan

**Step 1 — the device remembers a date.** `PremiumRepository` grows `planExpiresAt` and
`verifiedUntil` beside the existing flag; `isPremium()` becomes the comparison above. The flag stays
readable so the eight existing callers do not change. `core/premium`.

**Step 2 — the server answers with a date.** `GET /v1/billing/entitlement` returns `expiresAt`
alongside `premium`. The column already exists (`Entitlement.expiresAt`); this is a response-shape
change, not a schema one.

**Step 3 — somebody calls it.** A refresh after the splash hands off, honouring the 24-hour gate and
the skip rules. This is the step that has been missing all along:
`ServerPurchaseVerification.currentEntitlement()` is already written.

**Step 4 — tests, and they are the point.** Each row of the outcome table above is a case, and the
one that matters most is *server unreachable → premium untouched*, because that is the failure that
would cost a paying customer their premium. Also: a refund at hour 48 is off within 24 hours, and a
guest who never bought triggers no call at all.

**Not in this change:** iOS and Amazon. Both need their own store client and server-side verifier.
Step 3 is the reason to do them later rather than sooner — once every device asks our server, a
purchase made in any store is visible in all of them, and the store stops being the thing that
decides.

## The one thing the owner should know

`verifiedUntil` is compared against the **device's own clock**, which the user controls. Someone can
set the clock back and hold premium past a refund.

Closing that means asking the server every time, which is the dependency constraint 4 exists to
prevent. The trade looks right — a person moving their clock to steal premium was not going to pay —
but it is a deliberate hole and it belongs in writing rather than in a surprise later.
