# 0045 — The share-link page reports its own journey, in the app's pipeline and mostly in the app's words

- **Date:** 2026-09-09
- **Status:** decided, built (web + backend gate), **not deployed**
- **Decision:** `/i/{token}` sends events to `POST /v2/analytics/track` as `platform=Web`, under six
  names — one new page-view name, one new PDF name, and four the app already owns — through a
  same-origin route that fixes the permitted names and parameter values, generates the event id
  itself, and stamps `surface` and `viewer_platform` server-side. The version floor is exempted for
  `Platform.Web`. No iOS App Store link is added, because there is no iOS app on the App Store.
- **Why:** the receiver half of G2 was measured only inside the Android app. A person who opened a
  share link in a browser, read the invoice, approved it, downloaded it, or found the link dead
  produced **no analytics row at all** — the web's only signal was `/viewed`, which exists to date the
  sender's "Received" tag and answers a different question. The one number the loop did produce was
  the app's, and it is not flattering: 30 days to 2026-09-09, `shared_invoice_open_failed` **138**
  against `shared_invoice_opened` **70**. Nothing on the web could say whether the same thing was
  happening there, because nothing on the web said anything.

---

## What the data said before any of this was written

Measured on production MySQL, 2026-09-09.

| Event | 30 days | All time | Note |
|---|---:|---:|---|
| `shared_invoice_open_failed` | 138 | — | app only; twice the successes |
| `shared_invoice_opened_by_owner` | 103 | — | app only |
| `shared_invoice_opened` | 70 | — | app only, receivers only (owners are routed away first) |
| `shared_invoice_create_own_click` | 11 | — | app only |
| `invoice_share_link_fallback` | 31 | — | |
| `shared_invoice_rejected` | 0 | **1**, on 2026-08-09 | |
| `shared_invoice_approved` | 0 | **0, ever** | |

`shared_invoice_approved` has never fired once. It is in the vocabulary, it is in the app, and the
approval loop has produced exactly one recorded decision in its life. That is not evidence the
feature is unused — it is evidence that **the surface most receivers actually use has never been
instrumented**, and the web is that surface.

## Decisions, one at a time

### 1. A new name for the page view: `shared_invoice_page_view`

The app's `shared_invoice_opened` is deliberately not reused. It fires **after** the app has routed
senders away to their own invoice, so its rows are receivers-only by construction. This page cannot
tell a sender from a receiver — it is public and unauthenticated. Putting both populations under one
id is the §1.4 defect, and it would have quietly raised the app's own receiver count.

**Parameters:** `link_state` (required), `http_status` (when there was one).

`link_state` has exactly four values, and they are what the web can observe:
`active` · `not_found` (404) · `gone` (410) · `fetch_failed` (the read itself failed).

**`revoked` and `expired` are not among them.** `SharedInvoice.isViewable()` answers 410 for both, so
separating them here would have been a value nobody could ever catch as wrong (§1.15 rule 2). `gone`
is what was seen.

### 2. Approve / Reject keep the app's names, and fire where the app fires them

`shared_invoice_approved` · `shared_invoice_rejected` · `shared_invoice_decision_failed`.

Approving from a browser and approving from the app are **one action on two surfaces**, so they are
one name with the surface as a parameter (§1.1). And all three fire at the same moment as
`ReceivedInvoiceViewModel.decide` — on the backend's confirmation, not on the click. Firing on the
click would have made one name mean "decided" for app rows and "tried" for web rows, and the approval
rate would have risen for a reason that never happened.

`shared_invoice_decision_failed` carries `decision` (as the app sends it) plus `http_status`, which
separates "already decided" (409) from "our backend was down" (5xx). Absent when there was no HTTP
answer at all.

### 3. The three CTAs: two events, not three, and not one

| Button | Event | Parameter |
|---|---|---|
| Install Invotick (Android) | `shared_invoice_create_own_click` | `destination=play_store` |
| Create yours (iOS/desktop) | `shared_invoice_create_own_click` | `destination=web_app` |
| Download PDF (Android) | `shared_invoice_pdf_click` | `destination=play_store` |
| Download PDF (other) | `shared_invoice_pdf_click` | `destination=print_dialog` |

"Install Invotick" and "Create yours" are **one slot on the page holding one intent** down two
routes, so they are one event and the route is the variation (§1.1) — and the name is the app's
existing one, fired on the click exactly as the app fires it.

"Download PDF" is a **different intent**: wanting a copy of someone else's invoice is not wanting your
own invoicing app. One button label covering both would have hidden that.

`destination` is one parameter name across both events with a **non-overlapping** value space —
`play_store` means the same thing on either (§1.15).

The event says the click happened and where it was sent. It does **not** say a PDF was produced:
nothing observes whether the print dialog was completed or the Play Store visit turned into an
install. A name like `pdf_downloaded` would have claimed an outcome we never saw (§1.14).

### 4. `viewer_platform`, not `platform`

`detectPlatform()` already computed `android|ios|desktop` and threw it away. It is now stored — but
**not** under the key `platform`, because `platform` is already the batch-level field that
distinguishes the Android app from the iOS app from the Web (`Android|iOS|Web`). Two code spaces
under one word, both containing something spelled "android" and meaning different things, is §1.15 in
a new costume. `viewer_platform` says whose platform it is.

It is computed **server-side** in the analytics route from that request's own User-Agent, through the
same `platformFromUserAgent` the page branches its buttons on. One implementation, so a funnel can
never describe a branch the receiver was not shown.

**Known limitation, written down rather than fixed:** iPadOS 13+ reports a Macintosh User-Agent, so an
iPad reads as `desktop`. Changing the test would change which CTA the page renders — a behaviour
change wearing a measurement change's clothes. Nobody should read the `desktop` bucket as "no iPads
in it".

### 5. `surface=web_share_link` on every event

`analytics_events` has **no platform column** — platform lives only on `analytics_sessions_v2`, and
§1.12 / §3.8 are both about why a dimension reached through that join cannot be trusted. So the
surface is stamped on the event, where a filter can reach it.

**The honest gap:** the app does not send `surface`. Grouping `shared_invoice_approved` by it gives
`web_share_link` versus **NULL**, and NULL means *unknown*, not *app* (§1.7). Adding `surface=app` to
the app's four call sites is a follow-up in the app repo, listed below.

### 6. The identity is a visit, not a person

One UUID per browser tab in `sessionStorage`, sent as `sessionId`, and the same value prefixed `web_`
as `appInstanceId`.

A `localStorage` id would hand a persistent identifier to someone who never signed up, never asked us
for anything, and is here only because a business sent them an invoice. On a public document the unit
we can honestly count is a visit. **Consequence to know:** distinct sessions and distinct instances
will be the same number for web. That is a property, not a defect.

`userId` is never sent, even when a web session cookie exists — see the rejected list.

### 7. The version floor is exempted for `Platform.Web` *(backend change)*

`AnalyticsVersionGate.accepts` refused any batch with a null `appVersionCode`. The web has no Android
build number, so **every web event would have been refused** — and refused the way this system refuses
things: 200 OK, summary says accepted, zero rows written. The page would have shipped, sent every
event correctly, and produced a funnel that read as a step nobody reached.

The floor is not about age. It is about one specific body of event work on one client, and the web has
no history in this table at all. It is also not a security control and never was: an old Android build
sends `platform=Android` and would have to be modified to claim otherwise.

`AnalyticsVersionGateTest` now pins both halves — Web accepted with no code even against a floor of
1000, and Android/iOS/Unknown still refused without one.

### 8. Rate limiting, and being honest about how strong it is

Per-IP, 20 events per 60 seconds, in the web app's own route.

**The name list is the real defence, not this.** `events.ts` fixes six names and the exact parameter
values; the worst a determined caller achieves is moving one of six known counters. An open write
would have let anyone forge `invoice_shared_success` — the G1 metric itself. Two more things are
decided server-side and never taken from the body: the **event id** (supplying one lets a caller
overwrite an existing analytics row, because `save()` on an existing id updates it) and the
**surface/platform**.

**The caveat, stated because a clean graph is not proof:** the bucket map lives in one instance's
memory, so on Vercel the ceiling is per-instance and resets on a cold start. It stops a script from
one address. It does not stop a distributed flood. And none of it protects `/v2/analytics/track`
itself, which has been open to the internet since it existed because that is how every phone reaches
it.

### 9. No `apps.apple.com` link — checked, not assumed

`itunes.apple.com/lookup?bundleId=invotick.invoicemaker` returns `resultCount=0`, and a store search
for "invotick" returns eight unrelated apps. **The iOS app is not on the App Store.** A link would
have been a 404 shown to the receiver at the exact moment they wanted the product.

What an iOS receiver gets today, unchanged: **Download PDF** (browser print dialog) and **Create yours
— free** (the web app). No install path, no QR — the QR is desktop-only. That is correct while there
is nothing to install, and it is now measurable: `viewer_platform=ios` with `destination=web_app`.

---

## Rejected

| Option | Why not |
|---|---|
| Reuse `shared_invoice_opened` for the web page view | The app fires it only after routing senders away, so its rows are receivers-only. The web cannot tell the two apart. One id, two populations (§1.4). |
| A web-only `web_shared_invoice_approved` | Splits one funnel step across two names. The first query that forgets one half reports a smaller number and nothing says so (§1.1). |
| One `shared_invoice_cta_click` with `cta=` for all three buttons | Absorbs the live `shared_invoice_create_own_click`, which is a rename — history splits and the old rows lose their config name (§1.8). |
| Three separate CTA events | Install and Create-yours are one slot, one intent, two routes. That is a parameter (§1.1). |
| `link_state=revoked` / `expired` | The backend answers 410 for both. A value the source never gave is fiction nobody can catch (§1.15). |
| `platform` as the event parameter name | Collides with the batch-level `Android\|iOS\|Web` code space; "android" would mean two different things (§1.15). Kept the value, changed the name. |
| Send an `appVersionCode` ≥ 91 from the web so the gate passes | Puts a second code space in the column every release comparison reads. "1.4.3 vs 1.4.4" would silently include or exclude web rows. Fixed the gate instead. |
| Send an `appVersion` string like `web-2026-09-09` | Same column, same problem, display-only is not a defence. Absent means unknown, which is the truth. |
| Send `userId` when a web session cookie exists | The page is public. Attaching an account to "somebody opened this invoice" puts a person and a document they merely read into analytics, on a surface where we asked them nothing. G3 outranks the dimension. |
| Send `is_owner` | Not knowable: the public read carries no owner id, and the page is unauthenticated. Absent means unknown; a key would have been a guess (§1.7). Listed as an open question. |
| A `localStorage` device id | A persistent identifier for someone who never signed up. `sessionStorage` counts the visit, which is what a public document honestly has. |
| Send the share token as an event parameter | The token **is** the capability to read the invoice. Storing it in `analytics_events.params` puts live share credentials in a table read from the admin panel. `shared_invoices.view_count` already answers "how many links were opened". |
| Send a client `timestamp` | A skewed browser clock writes events into the future. Nothing here queues offline, so arrival time is occurrence time to within a round trip. |
| Accept `eventId` from the browser | `save()` on an existing id updates that row. It would let anyone overwrite any analytics event we hold. |
| Stamp `screen` so `analytics_events.screen_name` fills | A web page is not an app screen. It would put a pseudo-screen into screen-flow reports built for the app's navigation, for no question anyone is asking. |
| Send `Accept-Language` as `deviceLanguage` | Browser preference and the app's effective in-app locale are different facts under one column name. Not needed for this work; listed as an open question. |
| Fold the page view into `ViewBeacon` | `/viewed` drives a product-visible tag on the sender's list. One call for both would mean the day we wanted to stop one, we stopped the other. And the beacon correctly does not render on the dead-link branch, which is exactly where the page view is most needed. |
| Add the App Store link now | Not live. Verified, not assumed. |
| Offer "Install Invotick" on the dead-link branch for Android | The referrer carries `iv_doc=<dead token>`, so the install's first act is a failed fetch — the 138 `shared_invoice_open_failed` above. Dead links send everyone to the web tool. |

---

## Consequences

- **Deploy order is not optional: backend first, web second.** Ship the web while the old gate is
  live and every event is accepted-and-discarded. There is no error to see; the table simply stays
  empty.
- Every query that wants only app rows must now say so. `surface` is on web events; on app rows it is
  absent, which means unknown, not app.
- `shared_invoice_approved` / `_rejected` / `_create_own_click` counts will move for a reason that is
  not a behaviour change. Anything comparing across 2026-09-09 must facet by `surface`.
- The first web batch creates the first `analytics_sessions_v2` row with `platform='Web'` — a column
  value the enum has always allowed and nothing has ever written.
- `AGENTS.md` §5b gains a Growth (G2) web block; `AGENTS-EVENTS.md` gains §1.17.

## Still open — the owner's call

1. Should the app stamp `surface=app` on its four `shared_invoice_*` calls, so the facet has two
   named sides instead of one named and one unknown? (App repo, one line per call site.)
2. `is_owner`: worth adding an `ownerUserId` or a computed `isOwner` to the public read so a sender
   opening their own link is separable on the web, as it already is in the app?
3. Rate limit: leave it per-instance and best-effort, or make it authoritative with a shared store?
4. Should web events carry `country` from the edge header only, or also the browser's
   `Accept-Language`, knowing it is a different fact from the app's `device_language`?
5. `shared_invoice_open_failed` is 138 against 70 successful opens **in the app**. Investigate as its
   own piece of work?
