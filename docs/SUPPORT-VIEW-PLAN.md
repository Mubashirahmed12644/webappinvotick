# Support view — plan (decision 0075)

Written 2026-09-13 by a planning agent, read-only, for the lead. This is a plan. Nothing here is built.

**The owner's purpose:** when a user contacts support about a problem, see the app the way that user sees it, without
ever holding the user's token or changing their data.

## Shape

- **Where it lives:** a read-only "Support view" tab on the admin panel's `/users/[userId]`, with `?tab=support` so it
  can be linked. There is no sidebar entry (the Health Centre drill-down rule).
- **Backend reads:** new, under `/v1/webpanel/support/**`. They are ADMIN-only and paged at 50.
- **Invoices** are drawn by the web's own renderer, from the snapshot the phone itself built.
- **Every read** writes a log line and bumps a counter.

## Facts that shape it

- **The panel does not draw invoices the way the app does.** `/users/[userId]/invoices/[invoiceId]/v2` uses the
  panel's own renderer.
- **The only exact copy of what the phone drew is `shared_invoice.snapshot`.** It is the app's own `InvoiceSnapshot`,
  with images embedded, and an edit makes a new row. The web's `getInvoiceRenderData` rebuilds from server rows and
  leaves out terms, payment instructions, amount paid, balance due, and stamp and signature positions. It can serve
  only as a labelled fallback.
- **Today's support message cannot identify most users.**
  - The WhatsApp message from Contact Support (`InvoiceListViewModel.submitFeedback`) carries no Invotick ID and no
    device id.
  - A guest's email is `<userId>@guest.com`, but only when the profile call succeeded.
- **Several lookups have no index:** `clients.user_id`, `sync_failure.user_id`, `linked_device.device_id` on its own,
  and `users.phone_number`.
- **Neither front end has a test runner.** The backend guards scan code (`WebpanelReadsAreBoundedTest`,
  `BillingAdminControllerAuthTest`).

## What it shows (exists today → to build)

| Section | Source | Today | To build |
|---|---|---|---|
| Account header: role, guest or registered, Invotick ID, dates, previous guest ids | `users` | Role, dates, counts | `summary`, with contacts masked |
| Businesses, clients, items | `businesses`, `clients` (through the user's businesses), `inventory_items` | Counts; an items list | Paged lists, deleted rows included |
| Invoices and estimates | `invoices`, `estimates` | Invoices only; deleted hidden; 500 when the client is missing | Both types, deleted rows, version, writer, whether a snapshot exists |
| A document drawn as the app draws it | Newest `shared_invoice` row, in the web's `/embed/render` | The panel's own renderer | A render endpoint and an iframe route |
| Payments | `payments`, `invoice_payments` | Totals | A paged list, with what each payment was applied to |
| Devices, with build and last seen | `linked_device` plus the newest `analytics_sessions_v2` | — | A `devices` endpoint |
| Sync failures | `sync_failure`, with its evidence columns | Only by defect type | A per-user read |
| Premium | `entitlement`, `purchase_identity`, the binding log, restore answers | Only aggregate | A per-user read; never shows `purchase_token` |
| Recent screen journey | `/v2/admin/analytics/timeline` | On the user page | Wrapped, bounded, per device |
| Share link per document | `shared_invoice` | — | Part of the render endpoint |
| Records a guest left behind | Rows still owned by a retired guest id | — | Counts in `summary` |

**Finding a user:** a lookup box calls `GET /v1/webpanel/support/lookup?q=` and returns at most 10 masked candidates.
The kind of thing typed decides the search:
- 9 digits: an Invotick ID;
- a UUID: a user id or a device id;
- `<uuid>@guest.com`: that guest;
- an email;
- a phone number: matched on its last 9 digits.

A retired guest points to its current account.

**Paired app change (about an hour):** add the Invotick ID to the WhatsApp support message. It rides the next release.

## The record of who looked (no schema change first)

- **An interceptor on `/v1/webpanel/support/**`,** so that no endpoint can skip the record.
- **A log line** `[SUPPORT] [VIEW] …` with ids only, its fields in MDC. Never make them promtail labels: that is the
  643k-streams mistake.
- **A Micrometer counter** `support_view_total{section, action, outcome}`, with bounded tags only.
- **Why both:** Loki has lost whole nights before, and a counter rise with no matching log lines shows a hole.
- **Option, the owner's word:** a `support_view_log` table (a migration; SQL first). It survives Loki gaps and gives
  a "who looked at this user" list, a retention purge, and an optional reason field.

## Privacy guards

- **No field values in logs.** A test checks the recorder.
- **Emails and phones are masked on the server by default.** That includes those inside the snapshot. `reveal`
  returns one value, and every reveal is logged and counted.
- **No bulk export:** no CSV, PDF or copy-all; pages capped at 50; a per-admin rate limit.
- **The document goes into the iframe only by `postMessage`,** with an explicit origin. Never through `#base64` in the
  URL, which would put it in the browser history.
- **No user token and no secrets.** The service may not depend on `JwtService` or `AuthService`. It never returns
  purchase tokens, passwords, OTPs, notification tokens or login IPs.
- **"Masked by default" only becomes true once the list pages mask too** (phase 1b). Today the users list sends every
  user's email and phone.

## What it cannot show

- **Anything not yet synced:** the phone's outbox, drafts, a guest who never got a session.
- **What the phone decides itself:** premium on Play's word (0047) and ad state.
- **The phone's own renderer version.**
- **Documents with no snapshot:** those get the fallback render.
- **iPhones:** all iPhones share one device id.
- **Journey gaps.**

**Option, a release and a migration:** "Send diagnostics to support" in the app.
- The user sends a consented bundle (version, device, local counts against synced counts, an outbox summary without
  values, the latest failure evidence) and gets a short code for the WhatsApp message.
- It is kept 30 days.
- About 4–5 days of work.

## Phases (backend before the panel)

| Phase | Scope | Effort |
|---|---|---|
| 0 | Measure: the heaviest user's rows, `linked_device` count, `sync_failure` per window, the snapshot share, events per session | 0.5 d |
| 1 | Lookup, header, devices, sync failures, premium, reveal, recorder, rate limit; the panel's lookup box and support tab | ~3 d |
| 1b | Mask emails and phones in the users-list, map and sync-occurrence responses (owner's word) | 0.5–1 d |
| 2 | Businesses, clients, items, documents, payments; the render endpoint plus an iframe route (`/embed/render?readonly=1`, no `InvoiceDocument` change, so no bundle rebuild) | ~3 d |
| 3 | Bounded journey per device; leftovers under retired guest ids; the fallback render through a shared `buildInvoiceRenderData` | ~2 d |
| 4 | The audit table (option) | ~1 d + a two-step deploy |
| 5 | Diagnostics (option) | 4–5 d + a release |

## The owner's decisions (asked one at a time)

1. Mask the list pages too. Recommended: yes.
2. Mask addresses and names as well. Recommended: not for now.
3. Require a reason for each reveal.
4. The audit table: now, or later.
5. Stop logging sync field values. Recommended: yes; see below.

## Found in passing (outside this plan)

- **Loki holds users' field values.** `SyncV2Controller.logDeepPayload` logs every pushed record's values at INFO in
  production, and Loki retention is off. The sync-health trace endpoint returns up to 200 of those lines.
- **The panel's `app/api/invoice-preview/asset-auth/route.ts`** puts the admin token in a cookie without HttpOnly or
  Secure.
- **`SyncHealthController.signatures` breaks §5a:** it loads the whole window into memory to count it.
- **`WebpanelReadsAreBoundedTest` scans only the webpanel folders,** so the timeline controller's unbounded range query
  is not covered.

**Critical files:**
- `invotick-admin-panel/app/users/[userId]/page.tsx`
- `invotick-admin-panel/lib/api.ts`
- `invotick-apis/.../model/SharedInvoice.kt`
- `invotick-apis/.../webpanel/WebpanelReadsAreBoundedTest.kt`
- `Webinvotick/src/app/embed/render/page.tsx`
