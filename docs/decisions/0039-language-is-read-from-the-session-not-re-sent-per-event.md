# 0039 — Language is read from the session, not re-sent per event

- **Date:** 2026-09-05
- **Status:** decided, in backend working tree (not pushed)
- **Decision:** Split the first-invoice journey by **English vs localized, with the localized
  language named**, as two facets on the existing journey page — read from
  `analytics_sessions_v2.device_language`, normalised to its primary subtag. Add **no event and no
  parameter**. Fix the reason the column is empty by writing the session row from **any** batch that
  carries a session id, not only from a `session.action=start` batch.
- **Why:** The owner asked which users fail the invoice flow because the app is not in their
  language. The data to answer it is already on the wire and always has been — the app sends
  `deviceLanguage` on the top level of every `/v2/analytics/track` batch — but the backend read it in
  exactly one place, the branch that creates a session row, and that branch stopped running.

## What the measurement found (2026-09-05, production)

| | |
|---|---|
| Sessions with `device_language` populated, whole table | 31,048 / 31,098 — **99.8 %** |
| Distinct session ids on 7 days of events | 20,017 |
| …that have a row in `analytics_sessions_v2` | **111 — 0.6 %** |
| Session-row coverage, builds ≤ versionCode 90 | **72.8 %** |
| Session-row coverage, versionCode 94 | **0.6 %** |
| First-open devices, 7 days | 521 |
| …that a language can be attached to at all | **129 — 24.8 %** |
| All devices active in the same 7 days | 884 |
| …that a language can be attached to at all | 342 — 38.7 % |

The 99.8 % is the trap. The column is almost perfectly populated **for rows that exist**, and rows
have almost stopped being created. A completeness check on the column alone reads green.

**Root cause, app side.** `startSession()` opens with `if (!isNew) return`, and it is the only caller
that enqueues `session.action="start"`. App commit `0bcc846a` (2026-07-28, *"Never send a
session-less event"*) made `trackEvent` call `getOrStartSession()` so that `app_cold_start` would
stop arriving with `sessionId=null`. That was a real fix. Its side effect is that by the time
`startSession()` runs, the session already exists, `isNew` is false, and the announcement is never
sent. Everything that only the announcement carries went with it: `device_language`, `device_class`,
`screen_width`/`height`, `network_type`, `city`, `device_manufacturer`.

Nothing failed. Every batch answered 200, and the events kept their `session_id` — which is why the
`sessionId=null` fix looked complete.

## The decision

1. **Read language from the session.** It changes once per process. Putting it on every event would
   stamp ~18,000 rows a day to avoid one indexed lookup against a 31,000-row table. AGENTS-EVENTS
   §1.1: prefer an existing carrier over a new id.
2. **Normalise the tag before grouping** (`LanguageTag`). A tag is not a language: production carries
   **37 distinct Arabic tags** and 15 French ones (`ar-EG-u-nu-arab`, `en-US-u-fw-sun-mu-fahrenhe`).
   Grouping raw turns the second-biggest language in the app into three dozen rows of four.
3. **Two facets, not one.** `language_group` (English / Localized / unknown) is the split the owner
   asked for; `language` names the localized one. Same source, no extra query.
4. **A facet, not a filter.** With three-quarters of devices unnameable, a filter would silently drop
   them and make a quarter of the funnel look like all of it. A facet shows `unknown` as a row.
   AGENTS-EVENTS §1.7 — and per the mandate, that row is the one that must shrink.
5. **Join by `app_instance_id`, not `session_id`.** Joining by session id answers for 0.6 % of
   events; the device's newest tagged session is the best available answer.
6. **Write the session row from any batch** (`upsertSessionFromBatch`). Idempotent
   `INSERT … ON DUPLICATE KEY UPDATE` with `COALESCE`, so a later batch can only ever *fill* a
   column, never blank one a real session start set, and a race cannot poison the ingest transaction
   and cost the batch its events.
7. **Watch it in the Health Centre**, not on a page. `SessionMetadataCoverageCheck` — this failed
   silently for five weeks and the standing rule is that such things are a `HealthCheck` component.

## Rejected

- **A `language` parameter on every event.** A new parameter on ~18,000 rows a day for a value that
  changes once per process, when the carrier already exists. Rejected under §1.1.
- **A new `device_language_captured` event.** Rejected the same way, harder: it would be an event
  whose only content is a value we already have.
- **A language filter on the journey endpoint (instead of facets).** Would drop the 75 % of devices
  with no session row without saying so. Reconsider once coverage is near 100 %.
- **A separate "Language" page in the admin panel.** AGENTS §5a / decision 0010: a drill-down lives
  behind an existing card, and a page costs what it shows.
- **Fixing this in the app by making `startSession()` always announce.** Correct, but it needs a
  release, backfills nothing, and leaves the backend still able to lose the data. The backend fix
  works on builds already installed. The app change is still worth making later; it is not the fix.
- **Backfilling `device_language` onto historical events.** History has no session rows to backfill
  from. Nothing to do.
- **Reporting the English-vs-localized completion rates measured today.** See below.

## What was NOT concluded, and why

The completion rates split by language are **not reportable**. Two reasons, either one fatal:

- **The sample is a self-selecting one.** Over 30 days, devices with a language row averaged 783
  events and 4.5 opens; devices without averaged 121 events and 1.7 opens, and 55.6 % vs 33.7 %
  returned. "Has a language" is mostly "used the app a lot", and heavy users finish funnels. The
  34.2 % vs 19.4 % gap between them measures that, not language.
- **The sizes are too small regardless.** 114 English first-open devices against 36 localized ones,
  spread over 12 languages. `ar` is 8 devices and `es` is 5.
- **The gap is worst where it matters most.** 38.7 % of all active devices can be given a language,
  against 24.8 % of first-open ones — a returning device gets many chances for a session start to
  win the race, a new one gets one. Coverage is thinnest on exactly the population G1 is about.

## The finding that outranks the question

**The invoice flow has no translated strings at all.** The app ships `values-fr` and `values-es`
containing **one string each** — `app_name`, and the Spanish one reads `Invoteeck`. The language
picker itself is fully translated (23 strings, fr and es) and the splash has 3 Spanish lines. The
main table is 127 strings with 1 translated, and the UI is largely hardcoded English besides
(129 `stringResource(` call sites against ~156 literal `Text("…")`).

So "English vs localized" cannot mean "got the app in their language vs did not" — **nobody** gets
the invoice flow in their language. The picker offers Spanish and French and applies the locale
through `AppCompatDelegate.setApplicationLocales`, which makes it a G3 (trust) question as well as a
G1 one: we offer a language we do not have.

The answerable question is therefore **"how many first-time users are on a non-English device, and
do they finish less often"** — a question about whether translating is worth doing. That needs the
coverage fix first.

## Consequences

- `device_language` is the **app's effective locale** at process start, not the phone's system
  language: the in-app picker overrides it, and the app reads `Locale.getDefault()` once. The column
  name says otherwise. Never report it as the device's language.
- The `unknown` row on both facets stays large until the coverage fix ships, and the journey page
  must be read with the Health Centre card beside it.
- The session-row fix also restores `device_class`, screen size, `network_type`, `city` and
  `device_manufacturer` for every session — five dimensions nobody had noticed were gone.
