# 0052 — The business view defaults to All Businesses, and the last choice is remembered

**Status:** decided. The owner, 2026-09-11: *"ager business multiple hain to dashboard per defualt
value all business hi aye jaisy web per aa rhi hy and ager user usko change kery to jo latest change
hy wo hi dikhy har open per"*.
**Date:** 2026-09-11.
**Replaces:** the 2026-07-25 rule "All Businesses is never auto-selected" (memory
`dashboard-currency-and-all-businesses`).

## What was true on 2026-09-11

The app is 1.4.5 (`VC_96_VN_144`). This code is in `commonMain`, so Android and iOS behave alike.

- "All Businesses" is offered on the invoice list and the client list, and only when the user owns
  more than one business. The app never selects it.
- Choosing it lives only in screen state (`InvoiceListViewModel.onAllBusinessesSelected`), so it is
  forgotten on the next open. Each screen keeps its own choice, and the estimate list has no "All" at
  all.
- Choosing one business saves it as `default_business_id`. That key also decides which business a new
  invoice or estimate uses. Five places write it: the drawer, the create screens, business details
  ("set as default"), app start, and the guest migration.
- On the web, `InvoiceHome` opens on All Businesses, but the choice is not remembered.

## Decision

1. When the user owns more than one business and has not chosen, every business-scoped screen shows
   All Businesses.
2. The user's latest choice — All, or one business — is remembered and restored on every open, on the
   phone and on the web.
3. One choice covers every business-scoped screen: invoices, estimates, clients, analytics.
4. The business a new document is created from stays a separate memory: the last business used for
   creating. Viewing All never blocks creating. The create screen shows that business and lets the
   user change it; the web form requires one since `042c142`.
5. Existing users: the stored `default_business_id` was mostly set by the app, not chosen by the user.
   So a user with several businesses sees All once, and from then on their own choice is kept.

## Rejected

- **Keeping the 2026-07-25 rule.** The owner reversed it. The web already opens on All, and two
  different defaults on two platforms read as two different apps.
- **Reusing `default_business_id` for the view.** It also decides where new invoices go, so viewing
  "All" would have to clear it, and Create would lose its business.

## Consequences

- **App:** a new saved setting for the view (All, or a business id), read by the four screens. The
  estimate list gains the All option. This ships in the release after 1.4.5.
- **Web:** `InvoiceHome` remembers the choice in the browser, and falls back to All.
