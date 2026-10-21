# 0231 — The signup invitation lives at app exit and never blocks an invoice, a purchase or an ad

**Date:** 2026-10-22 · **Owner:** the owner, in chat · **Mockup:** private Artifact `YBFM8xMTv251uQZqdkCprN` (v3), file `kaam/research/signup-moments-mockup.html`

## The data (production, read-only, 2026-10-21/22)

- Phones active in the last 7 days, our test phones left out: 4,788 guests against 169 signed-in (96.6 percent). Among phones first seen more than 28 days ago the guest share is 94-96 percent at every level of regularity; 77 percent of phones seen in 28 days are new installs.
- 4 of the 7 active paying customers hold only a guest account.
- Guest data IS on the server (5,824 guests, 12,590 invoices). A guest can already open a second phone or the web app by scanning a QR on a linked device (decision 0145: 41 links, 29 into a guest, 24 of those browsers). What a guest cannot do is get back in once every linked device is gone (the returning-accounts picker, since 1.5.1, covers a reinstall on the same Android phone).
- The exit dialog was shown 12,413 times to 5,172 phones in 30 days; "Sign in" was tapped 58 times. The login and register screens are opened by about 370 phones a month, and 42 percent of those finish. The top-bar cloud icon was tapped by 11 phones: it shows only while syncing, for a 2 s tick, or when offline or failed, so that number measures exposure, not interest.

## Decided

1. **Where:** the exit dialog is the primary invitation (earned only: a confirmed share, 3 or more invoices, premium, or 3 or more days; never on the first exit of an install; at most once every 3 exits and 3 times a week; Stay and Exit stay one tap, never delayed). Secondary, user-opened only: the top-bar cloud icon's sheet and the existing drawer card. The cloud icon is not a signup driver.
2. **Hard rule (owner):** a signup ask never sits in, delays or competes with (a) creating an invoice, (b) the in-app purchase (a guest buys exactly as today), (c) any ad. Memory `signup-never-blocks-invoice-iap-ads`.
3. **Google first (one tap), email second.** Guest work joins the new account through the existing path (0053).
4. **True words only.** No sentence says guest data lives only on the phone, that a guest cannot use several devices, or that the web app needs an account. The honest line: "Your invoices are saved on our server. Ways to get back in: 1 linked device (QR). Email or Google: not added." Shown as three levels computed from real state: At risk (guest, no email or Google, 1 linked device), Better (2 or more linked devices), Safe (email or Google). All strings that say otherwise (7 not true, about 12 to check, in every language) are fixed in the same release.
5. **Premium message:** only today's true benefits (no ads; no Invotick footer on PDF, share image and share links, old links too). No free cloud limit (there is none today; a limit would need server and app work and puts free users' data at risk, G3). New premium features are written into the message only once they exist.
6. **Design defaults taken by the lead from the design agent's recommendations** (the owner may overturn them): a guest with 2 or more linked devices still gets the invitation, with the same caps, only the level differs; paying guests stay outside the 20 percent holdout (4 of 7 payers are too few to measure); the sheet's "All safe" title becomes "Sync complete" so it never sits above an "At risk" chip.
7. **Measured, not guessed:** Remote Config switch plus a 20 percent holdout; panel section later (primary: guest to account within 14 days among retained guests; guardrails: first share, ad money, paywall, uninstall proxy). Top-bar icons: nothing is removed; always-visible icons (support 1,026 taps / 756 phones, premium 662 / 503) are compared by taps per 100 weekly phones over 14 days, and an icon is a candidate only below 1 percent AND doing no safety job; the cloud icon is judged by taps per 100 showings and is never removed on tap counts (needs a new coded event `top_bar_icon_shown`, a proposal).

## Rejected (do not propose again)

- A signup screen in onboarding, or a signup ask after a share, after a purchase or after the 3rd invoice (in the user's path).
- Stopping or limiting a guest's cloud sync until signup (trust G3; data already synced must never stop syncing; 5,824 guests; the lost-phone case).
- "Open on a computer / in the web app" as a reason to sign up (a guest can scan a QR).
- Making the cloud icon the signup source.
- A free cloud limit now (the owner agreed: "tumhari recommendation theek hai").

## Not decided

Whether to build a real free cloud or live-device limit (options A: live devices, B: new features premium, C: a generous invoice-count safety valve, D: web app limited were put to the owner; he chose true benefits only for now). A device limit must count phones and browsers separately.
