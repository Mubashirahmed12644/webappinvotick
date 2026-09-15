# 0110 — The share loop's events name their link and their door

- **Date:** 2026-09-15
- **Status:** decided by the owner 2026-09-15, both halves.
  - The app half: "1.4.6 mein". It is built on `feat/146-shared-open-entry`, is not merged, and has no versionCode bump.
  - The web half: "Haan, abhi bana do". It is built on `feat/web-share-events-carry-link`, is not merged, and is not
    deployed.
- **Decision:** No new event on either side (AGENTS-EVENTS §1.1).
  1. **App.** `shared_invoice_opened`, `shared_invoice_opened_by_owner` and `shared_invoice_open_failed` carry
     **`entry`**, meaning how the receiver reached the invoice. It is a closed set:
     `link_tap | install_referrer | received_list`.
  2. **Web.** Every `/i/{token}` page event carries **`iv_doc`**, the share token of the page that sent it. The server
     stamps it from the request's `Referer` and never takes it from the body.
- **Why:** On 2026-09-15 the share → install chain was audited for the owner's question: is every step from
  sharing an invoice to the receiver installing the app recorded? Every step had rows. Two joins could not be made.
  - **Which door.** In 7 days there were 25 `shared_invoice_opened`. Nothing on the event separated a tapped link,
    an open right after a Play install, and the received list.
    - The install door is the growth loop itself. It could only be found by joining `install_referrer` on
      `app_instance_id`.
    - In 30 days, 12 of 13 shared-invoice installs opened the invoice, and nothing on the event said so.
  - **Which link.** There were 105 web page views and 24 Play-button presses in 7 days, and none of them named a
    link.
    - Whether a link was opened lives on the backend (`shared_invoice.first_viewed_at`, 81 of 419).
    - The install lives on `install_referrer.iv_doc`.
    - The middle step, "on this link, somebody pressed Play", joined to nothing.

## The app half: where each value is set

The value travels `DeepLinkDestination.ReceivedInvoice.entry` → `AppEvent.OpenReceivedInvoice.entry` →
`ReceivedInvoiceRequest.Pending.entry` → `ReceivedInvoiceRoute.ReceivedInvoice.entry` → `ReceivedInvoiceViewModel.entry`.
All of it is in `commonMain`, so iOS runs the same code.

| Value | Set in | Covers |
|---|---|---|
| `link_tap` | `DeepLinkHandler.determineDestination`, both the `/i/` and `/receivedInvoice/` branches | Android App Link and custom scheme (`MainActivity.handleIntent`), iOS universal link (`handleIncomingLink`). Only a tapped link reaches the parser. |
| `install_referrer` | `installReferrerDeepLink()` in `DeepLinkHandler.kt` | Both Android referrer paths now call this one builder: `MainActivity.deferredInstallReferrerDeepLink` at launch, and `GooglePlayReferrer` when the referrer arrives after the UI. |
| `received_list` | `ReceivedInvoiceNavigation`, the list's `onOpen` | Tools → Received invoices. |

The view model's `withEntry()` adds the key only for a value in `SharedOpenEntry.ALL`. Anything else, or nothing,
leaves it off: absent = unknown (§1.7). The Retry button reloads with the same `entry`, because the door has not
changed.

## The web half: what is stamped, and why this way

- **The name `iv_doc`, and the raw token.**
  - It is the same name and the same value as `install_referrer.iv_doc`, which `findShareLoopInstalls` already joins
    to `shared_invoice.token`. So one join expression covers the page view, the Play press and the install (§1.15).
  - It is no new exposure: `install_referrer` already stores the same token for the same links, and only admins read
    `analytics_events`.
- **Taken from `Referer`.**
  - The page is `/i/{token}`. A same-origin `fetch` carries that address under the browser's default policy, because
    `next.config.ts` sets no Referrer-Policy.
  - No client change, so tabs opened before the deploy send it too.
- **Checked against the minted shape** (16 characters from `abcdefghijkmnpqrstuvwxyz23456789`) and kept only if it
  matches.
  - A non-browser caller can forge a Referer as easily as a path. The token counts only where it matches a real
    `shared_invoice` row.
- **A body cannot supply it.** `sanitiseParams` copies only the keys in the event's schema, so a body `iv_doc` is
  dropped. The server adds its own value after that.
- **No Referer** (a privacy setting, an embedded browser that strips it) means the key is left off. Rows without it
  keep that gap visible.

## Rejected

- **A new event** (for example `shared_invoice_opened_after_install`, or a web `shared_invoice_link_event`). This
  is one action with a variation, which is a parameter by §1.1. A second name would split every count of opens.
- **Waiting for 1.4.7** (the agent's own recommendation). The owner chose 1.4.6: without it, the install-referred
  open stays a join on another event for a whole further release.
- **`entry=unknown` or `entry=other` as a value.** Unknown is the key's absence (§1.7). A made-up value reads as a
  fourth door.
- **A hashed or shortened token on the web.**
  - It is a second code space for one thing.
  - The join would hash every `shared_invoice` row in SQL instead of using its unique index.
  - It protects nothing, since `install_referrer` already stores the raw token.
- **A new name such as `share_token`.** It would be two names for the same value, and every query would have to
  know both.
- **A token-scoped route (`/api/shared-invoice/[token]/track`).**
  - It is exactly as forgeable as a Referer.
  - It needs a client change that open tabs would not get.
  - It adds a second door to the pipeline, where §1.17 allows one per surface.
- **Taking the token from the request body.** 0045 settled that the browser supplies only a name and schema
  parameters. That stays.
- **Validating the token against the backend on every event.** It would add a backend read to every tap on a public
  page. The join already does that check, for free, at read time.

## Consequences

- **History splits at 1.4.6 (versionCode ≥ 105) for `entry`, and at the web deploy for `iv_doc`.**
  - Earlier rows have neither.
  - A query that spans the split must treat a missing key as unknown and never as `link_tap`.
- **`shared_invoice_opened_by_owner`** carries `entry` through the same helper. No unit test reaches it: the owner
  check is off in debug builds, which is what unit tests run as.
- **The backend and the panel read neither parameter yet. Nothing was built there.**
  - `findShareLoopInstalls` could count, per invoice, the installs whose first open said
    `entry=install_referrer`. That would be the deferred link proven to work, not assumed.
  - It could also count page views and Play presses by `iv_doc`. That is the per-link funnel from view to press to
    install.
  - The `/utm` share-loop table is where both would show.
  - `iv_doc` is an id: a join key, never a breakdown (§1.18).
- **Proof after the web deploy:**

  ```
  SELECT COUNT(*) n, SUM(e.params->>'$.iv_doc' IS NOT NULL) with_doc, SUM(si.token IS NOT NULL) joins FROM analytics_events e LEFT JOIN shared_invoice si ON si.token = e.params->>'$.iv_doc' WHERE e.platform='Web' AND e.event_timestamp >= NOW() - INTERVAL 1 DAY AND e.event_timestamp < NOW() + INTERVAL 1 DAY;
  ```

  `with_doc` near `n`, and `joins` equal to `with_doc`, prove it arrives and joins.
- **Proof after 1.4.6 spreads:** group `shared_invoice_opened` / `_open_failed` on versionCode ≥ 105 by
  `params->>'$.entry'`. `install_referrer` should roughly match the shared-invoice installs of the same window.
