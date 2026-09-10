# 0044 — An install belongs to a tag, not to a link, and a tag matches only whole

- **Date:** 2026-09-08
- **Status:** decided, built (backend + panel in working trees, nothing pushed)
- **Decision:** The UTM Reporting tab shows **clicks → installs → first invoice → shared** for every
  campaign value, joining the registry to `install_referrer` by **exact equality on all three UTM
  values at once**. Installs are attributed to the `(utm_source, utm_medium, utm_campaign)` **tag**,
  never to an individual short link, because the short code never travels to Play. A tag with no
  installs prints **`0`**. Traffic matching no link of ours is listed separately, uncredited.
- **Why:** The tab read one column, `short_link.clickCount`, while the page header promised to
  "track where installs come from". It had never read an install. That is not a missing feature — it
  is a sentence on screen the data cannot support, which is the same defect class as the label this
  decision is written to avoid repeating.

## What the data says (production, measured 2026-09-08)

| | |
|---|---|
| Rows the query reads, 30-day window | **2,239 of 1,150,172** (18.1 ms, three index lookups, no table scan) |
| `install_referrer` rows carrying `referrer_raw` | 1,458 of 1,458 — 100 % |
| `app_cold_start` rows carrying `utm_source` since 2026-09-01 | **0** of 2,678 |
| `app_instance_id` null on `install_referrer` | **0** |
| Installs matching a link of ours, 30 days | **9** (facebook·cpc 8, facebook·social 1) |
| Installs matching no link of ours, 30 days | **1,210** (927 of them `apps.facebook.com`) |
| `google_ads`, 7 links | 26 clicks, **0 installs** |

The G1 tail on our own tag: 9 installs → 3 saved an invoice → 2 shared one.

## Rejected

- **`LIKE '%facebook%'`, or any substring / prefix / case-folded match.** This is the whole reason
  the decision exists. `JourneyFacets.installSource` matched `"facebook" in v`, which is true of
  `apps.facebook.com` — Facebook-for-Android's **own** install referrer, set by the FB client on
  installs we never tagged. 927 of those joined our 8 in one bucket and the panel wrote "Facebook
  campaign" over it: a label wrong by a factor of 116, which read like an answer for as long as it
  was there. Fixed in `8320714`; `UtmTagTest` now fails if anyone loosens it again.
- **Matching on the whole `referrer_raw` string.** It is exact, and it breaks the moment a network
  appends its own parameter — Google Ads adds `gclid`, and the match would return zero installs for a
  campaign that had them. Equality on the three tag values survives extra parameters; that case is a
  test.
- **Splitting a shared tag's installs between the links that carry it** (evenly, by click share, or
  by "the newest link wins"). Seven of eleven links carry a byte-identical referrer string. Nothing
  in the data distinguishes them, so every split is invention. Each sharing link shows the same
  number and says on its row that the number is the tag's.
- **Pairing `short_link_click.clicked_at` against `install_referrer.referrer_click_ts` to recover
  which link was clicked.** Probabilistic, unfalsifiable, and it would manufacture exactly the
  per-link precision the data does not have.
- **Hiding a zero as `—` or an empty cell.** Most links show 0 and that is the finding. A blank
  cannot be told from "we never looked", which is the state the tab was already in.
- **Reading the tag from `app_cold_start`.** Zero of 2,678 cold starts since 2026-09-01 carry a
  `utm_source`. A funnel built on it returns a confident empty answer.
- **Summing the per-link rows in the browser to get a total.** Seven links, one tag: the browser
  would report one install seven times and look reasonable doing it. Every total and breakdown is
  summed over **distinct tags**, on the server.
- **A new page.** These are columns in the Reporting tab that already exists.

## Consequences

- **Per-link attribution does not exist and cannot be added by querying harder.** Making future
  links individually attributable is a change to the **Link Builder** — put the short code into the
  referrer (`utm_content=<code>`, or a dedicated `iv_lid`) — and it only ever works forward. The
  eleven existing links stay tag-level for ever. This is an owner decision, not a fix.
- **Two spans on one screen.** `short_link.clickCount` is a running total the redirect has kept
  since each link was created; installs are windowed. The tab labels both rather than forcing them
  to agree, and no ratio between them is computed anywhere. Windowing clicks is possible —
  `short_link_click` has `clicked_at` and an index on it — and is an open question.
- **`madeInvoice` is not G1.** It counts `invoice_created_success`, an invoice that was saved.
  `sharedInvoice` (`invoice_shared_success`) is the G1 half of decision
  [0006](0006-g1-real-invoice-metric.md). Both columns ship; neither is labelled as the other.
- **`installs` counts distinct `app_instance_id`, which is per install, not per phone.** A reinstall
  is a new one. It is the only key that is 100 % populated on this event —
  `analytics_sessions_v2.device_id` reaches about 40 % — so it is the right key here and the wrong
  word for "people".
- `UtmTag` is now the single place a link and an install are compared. Anything that wants to
  attribute an install goes through it.
