# 0163 — The free invoice tool reports its own funnel, and offers the app only after the PDF

> Numbered 0163 after a sweep of **every** ref (`refs/heads` + `refs/remotes`), not just `main`:
> 0058–0162 are taken, most of them on branches that have not merged, so `main`'s highest number is
> misleading and reading it alone is how two decisions end up with one number.

- **Date:** 2026-09-23
- **Status:** decided, built on `Webinvotick` branch `feat/free-invoice-funnel-and-install-offer`
  (off `gitlab/main` `3a9eb10`). **Not deployed.**
- **Decision:** the free invoice tool at `/` gets a funnel of its own — seven coded events through the
  existing web analytics route — and, **after** a PDF has actually been produced, a **soft** offer to
  install the app that never blocks anything and never says the invoice will follow them.

## Why now

The owner's decision today: most non-Pakistan web traffic is mobile (**88.5 %** — android 72.9 /
ios 15.6 / desktop 11.5, measured over 30 days), and social-ad traffic should land on the web, make a
**real invoice with no install and no sign-up**, and only then be invited to install. Play before
install.

The page for that already existed and was **completely unmeasured**. `/` has been the free tool for
months; not one event has ever come off it. So every question about it — did anyone finish an
invoice, did anyone download one, is our sample doing the work or are they typing their own data —
returned zero, and the zero meant *nobody asked*, not *nobody came*. That is the worst shape a number
can have, because it reads as an answer (`AGENTS-EVENTS.md` §0).

## What was chosen — option A

**A soft offer that never blocks anything, plus full tracking, measured first and A/B-improved after.**

- It appears **only after the value moment**: a PDF has been saved. Nobody is asked for anything
  before they have got something.
- It is a **card, not a dialog** — no scrim, no focus trap, nothing behind it disabled. Creating,
  previewing, downloading and starting a second invoice all keep working with it on screen.
- **Once per visit.** Dismissed or acted on, it does not come back in that tab.
- Android → Play. **iPhone and desktop → a free account**, because there is no iOS app to install and
  a desktop has nowhere to be sent.

## The events

All seven are **coded** (the web has no auto-capture channel), all carry `surface=web_free_tool` and
the server-stamped `viewer_platform`, and all are declared in `src/lib/analytics/events.ts` — a name
or a parameter value that is not on that list is dropped by the route and the row never exists.

| Event | Parameters | Fires when |
|---|---|---|
| `free_invoice_page_view` | none | the tool mounts in a browser |
| `free_invoice_form_typed` | `form` = `business\|client\|item` | first non-blank keystroke in that form's name field, once per form per visit |
| `free_invoice_completed` | `source`, `items`, `has_logo`, `has_tax`, `has_discount`, `optional_fields` | the draft first holds a business name, a client name and one priced line — once per draft per visit |
| `free_invoice_pdf_download` | `outcome` = `saved\|failed`, `source`, `exception_class` (failure only) | one row per press of Download PDF, when the attempt settles |
| `free_invoice_install_offer_shown` | `trigger` = `pdf_downloaded` | the offer goes up |
| `free_invoice_install_offer_click` | `destination` = `play_store\|app_store\|web_account` | its button is pressed |
| `free_invoice_install_offer_dismissed` | `method` = `close_button\|not_now` | it is closed |

`source` = `typed | sample | sample_edited`, absent when unknown.

### Why each is shaped that way

1. **New names, not the app's.** The app's activation events describe somebody inside the app with a
   saved business, saved clients and an identity. This page is a stranger with a browser and one
   throwaway draft. Reusing `business_form_text_typed` or `invoice_created_success` would put two
   populations under one id (§1.4) **and** would raise the app's own counts the day this deployed,
   with nothing saying so. It is the §1.17 rule 2 case — the same reason `shared_invoice_page_view` is
   not `shared_invoice_opened`.
2. **One name for "started typing", not three.** The app has three because they were added
   separately; every query that wants "did they start typing at all" has to OR them together and the
   first one anybody forgets lowers the number in silence. On a new surface that is a mistake to
   copy, so it is one event with `form` as the variation (§1.1).
3. **The typing proxy keeps the app's honest meaning.** It proves typing started. It does **not**
   prove the data is real — nothing here can tell "Acme Studio" from "asdf".
4. **`source` is the G1 question this surface has and the app does not.** AGENTS.md §1: *an invoice
   made of our placeholder data is not activation*. Nothing is prefilled anywhere in the app, so
   there the enemy is throwaway data. Here "✨ Surprise me" fills a whole invoice with our business,
   our client and our line items in one press, and that draft can reach the PDF without a character
   being typed. It rides on **both** `free_invoice_completed` and `free_invoice_pdf_download`, so "how
   many real invoices came off this page" is one query and not a join. `sample_edited` is a one-way
   move and never returns to `typed`: our words may still be in the rest of it, and that is exactly
   what the third value says.
5. **The `has_*` keys are the app's lost parameters, put back.** AGENTS.md §5b records that
   `optional_fields_filled` / `has_logo` / `has_description` / `has_discount` went with the coded
   calls deleted in 1.4.3, so "nothing in the app now separates real data from the minimum that clears
   validation — the G1 question", and that the fix is parameters on a surviving event (§1.1). This is
   that fix, on the one surface that can still see them.
6. **The PDF is one event per press carrying its result**, the `premium_purchase_result` shape from
   0155 — before that decision, a press whose result nobody recorded was simply an unknown.
   `outcome=saved` is the file being produced and nothing more; a name like `pdf_saved` would claim an
   outcome nobody observed (§1.14), which is why the share page's twin is called
   `shared_invoice_pdf_click`.
7. **`exception_class` is an identifier, never a message.** The route refuses anything with a space
   in it. A browser error message can carry a business name, a client name or a file path, and this
   page's whole promise is that what is typed here stays in the browser.
8. **Shown / click / dismissed are three actions, so three names.** Ignoring the offer produces no row
   at all, and that is correct: it is the absence of both a click and a dismissal, against a `shown`
   that is always there to divide by. The ✕ and "Not now" are one action with a `method` (§1.1,
   decision 0023).
9. **`trigger` has one value today and that is said out loud.** A parameter with one value attributes
   nothing (§1.15's corollary about a constant `placement`). It exists because the trigger is the
   first thing the planned A/B moves, and a second value should join an existing key.
10. **`web_account` is not the share page's `web_app`.** That one means "go to the free tool"; this
    one means "sign up so these invoices survive this browser". One parameter name, one code space
    (§1.15).
11. **The surface is decided by the event name, on the server.** Every name belongs to exactly one
    page, so nothing is taken from the browser (§1.17 rule 4) and — unlike a `Referer` — a name cannot
    be missing. The app sends no `surface` at all, so this facet still reads against **NULL = unknown,
    not app** (§1.7).

## The two honest limits, written into the copy

1. **A web-made invoice does not follow the user into the app.** The `iv_doc` install-referrer
   carry-over (0110) exists only for share links — a token the backend already holds — and a
   free-tool draft was never sent to the backend at all. iOS has no install referrer in any case. The
   card says: *"This invoice stays in this browser — it won't appear in the app, and clearing your
   browser data removes it."*
2. **The browser is not storage.** The tool keeps drafts in this browser's IndexedDB and clearing site
   data loses them. The card says so, and offers the account as the actual fix rather than implying
   permanence.

## No App Store link, because there is no App Store listing

Checked 2026-09-23: `itunes.apple.com/lookup` returns `resultCount: 0` for **both**
`id=6757918977` (the id AGENTS.md carries) and `bundleId=invotick.invoicemaker`. An iPhone therefore
gets the account offer, not a dead store link — offering a link that goes nowhere is worse than
offering nothing (G3). `app_store` is declared in the event schema so the day the listing exists is a
one-line change in `InstallOffer.tsx` and not a change to the event contract.

## Rejected

- **Option B — gating anything behind the install** (the download, the preview, the second invoice).
  This page's entire promise is "free, no sign-up, no install". Withdrawing it at the last step is a
  trust cost, and G3 outranks G2. It would also break the owner's own plan, which is that the ad
  traffic *finishes an invoice* first.
- **Cloning the app's screens on the web, including its splash.** The app's splash is a known ~20 %
  drop-off the owner is actively working to reduce (`memory/splash-pass-through-target.md`: about
  80 % pass it, target 98 %). Copying it onto a surface that does not need it would import a measured
  loss.
- **A second analytics channel** (a direct browser → backend call, a vendor SDK, a bespoke endpoint).
  `AGENTS-EVENTS.md` §1.5: never build a channel that bypasses the agreed one. A `LocalCodedEventLogger`
  was added for exactly that once and removed the same day. Everything here goes through
  `POST /api/analytics/track` → `POST /v2/analytics/track`.
- **Reusing the app's `business_form_text_typed` / `client_form_text_add` / `item_form_text_add`** —
  see reason 1 and 2 above.
- **A `pdf_saved` / `pdf_downloaded` name** — it would claim an outcome the page cannot see (§1.14).
- **Storing the sample flag as a new event** (`surprise_me_clicked`) instead of a parameter. The
  question is never "did they press the button", it is "whose words are in the invoice they
  downloaded", and only a parameter on the G1 row answers that.
- **A `localStorage` once-mark** for the offer and the first-keystroke events. It would silence them
  for that browser for ever, so a returning visitor's second invoice would be a funnel step nobody
  reached. `sessionStorage` gives the mark exactly the lifetime of the thing it counts: one visit.
- **Reading the User-Agent on the server in `page.tsx`.** `headers()` would make the whole SEO landing
  page dynamic for one card that appears after a download. The card reads `navigator.userAgent`
  through the **same** `platformFromUserAgent` the route uses, so the rendered branch and the stamped
  `viewer_platform` cannot drift.

## The plan is to measure first

Nothing here tunes the offer. The wording, the moment and the trigger are a starting point, and the
events exist so the next change is made against numbers instead of taste. The A/B comes after there
is a baseline: `trigger` is already a parameter for that reason.

## Verified

Run locally against a capture server standing in for the backend (`BACKEND_URL` defaults to
`http://localhost:8085`), so nothing reached production analytics. **24 events across 7 names**, each
one read as the backend would receive it:

- `free_invoice_page_view` — `surface=web_free_tool`, `viewer_platform=desktop` and `android`, no
  `iv_doc` (the referer is `/`, not a share link);
- `free_invoice_form_typed` — `business`, `client`, `item`, **once each** across 17, 13 and 23
  keystrokes;
- `free_invoice_completed` — `source=typed, items=1, optional_fields=0` for a typed draft and
  `source=sample, items=3, has_tax=true, optional_fields=7` for a "Surprise me" one;
- `free_invoice_pdf_download` — `outcome=saved` with `source` = `typed`, `sample` and `sample_edited`;
- `free_invoice_install_offer_shown` — `trigger=pdf_downloaded`, once per visit;
- `free_invoice_install_offer_click` — `destination=play_store` on the Android branch (the Play URL
  carries `utm_source=free_invoice_tool` and **no `iv_doc`**) and `web_account` on desktop, which
  opens the existing backup/sign-up modal;
- `free_invoice_install_offer_dismissed` — `close_button` and `not_now`.

`outcome=failed` was not reproduced in the browser; its shape is covered by
`src/lib/analytics/events.test.ts`, which also proves that an undeclared parameter is dropped and a
missing required one refuses the event. 22 unit tests pass; `tsc --noEmit` and eslint are clean.
