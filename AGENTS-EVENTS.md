# Event management — the constitution for analytics

> Read this **before touching any event, in any repo**. `AGENTS.md` is the project constitution;
> this is the same thing for the event system, which spans three repos and breaks in ways that look
> like data rather than defects.
>
> Every rule here was paid for. Where a rule has a date and a number attached, that is the incident
> that produced it — those lines are not illustrations, they are the reason the rule is not a
> preference. **Add to this file the moment a new rule is decided; do not let it live only in a
> conversation.**

## 0. What this system is for

A funnel that can answer **G1**: did this person create an invoice with their own real data, and if
not, where did they stop. Firebase can count events; it cannot tell you that the user sat on the
business form for 72 seconds and then swiped it away without typing. That is the bar — not "we have
analytics", but *the row explains what happened without anyone reconstructing it*.

Two consequences that decide most arguments:

- **A number nobody can act on is not worth an event.** Before adding one, name the decision it
  changes.
- **A number that can lie is worse than no number.** Silence is visible; a wrong figure is not.

---

## 1. The rules

### 1.1 One action, one event. The variation is a parameter.

A bottom sheet closed by the ✕ and one swiped away are the **same action**. They are one event name
with `method=close_button|swipe|scrim_or_back`, never two names.

> **Incident (2026-08-16).** A separate `sheet_dismissed` was added beside the per-sheet close id
> that had *just* been created. One dismissal of the client form then produced **three** events —
> the ✕'s own tap, the new event, and the view model's `client_form_dismissed`. Counting dismissals
> meant knowing which of the three to trust. Decision
> [0023](docs/decisions/0023-one-dismissal-event-the-method-is-a-parameter.md).

Splitting one fact across several names forces every query to OR them together, and the first one
anybody forgets lowers the number silently.

### 1.2 One screen, one event.

The **navigation host** names every screen automatically. Bottom sheets are not navigation
destinations, so `InvotickSheet` announces those — also automatically, using the name it already
carries for its dismissal.

> **Incident.** Two mechanisms ran in parallel: `nav_screen_view` from the hosts and eight
> hand-written `trackScreen` calls. A screen with both arrived twice under two naming conventions
> (`create_invoice_screen` and `Create_invoice_Scr`), and the screen-flow report — which reads
> `screen_view` — could see only those eight of twenty-odd screens.

**The same rule applies to the screen an event is *stamped with*, not just to the screen event.**
There are two readers of "where am I": auto-captured taps read `LocalScreenId`, coded events read the
gateway's own current screen. They must resolve to the same string, and only `InvotickSheet` and the
nav shell may set it.

> **Incident.** They disagreed on every single tap, 2ms apart:
> `create_CreateClientScreen.tap_4 screen=create` next to
> `contacts_permission_requested screen=invoice_client_form`. Two causes. `LocalScreenId` pre-stripped
> the route to its leaf before calling `meaningfulScreenName`, and that function resolves a name from
> the **owner** (`InvoiceRoutes.Create` → `create_invoice_screen`); given a bare `Create` it matched
> nothing and returned the leaf. And a sheet is not a nav destination, so the id did not move when one
> opened — taps inside the client form were filed under the screen behind it. Nothing was missing and
> nothing was misordered; the run simply read as though the user kept leaving screens they never left.
> Fixed in `a3ed3571`: the whole route, and the sheet provides its own name to its subtree.

### 1.3 Make the automatic thing meaningful. Do not write a manual twin to get a good name.

The owner's rule, in their words: *"tm automatic waly ko meaningful banao gy, na ky meaningful ky
liye alag sy aik or manual coding likh do."* A coded call is allowed **only where automatic cannot
reach** — today that is exactly one place, the ad dialog, which is neither a route nor a sheet.

### 1.4 An id used in two places is a bug.

Not a shortcut, not "close enough". Two call sites sharing an id means two different things arrive
under one name and neither can be told from the other.

> **Incidents.** `Topbar.topbar_back_1` was hardcoded in the top bar, so ~70 screens and sheets
> reported the same event when closed. `DocumentPartyCard.tap_1` covered the business and client
> cards. `CreateProductScreen.tap_2` covered Discount, Tax and Net Price. All three looked fine in
> the file they were written in.

**Resolved structurally on 2026-08-23, not case by case.** The cause was not carelessness at 550
call sites: a codemod stamped `analyticsId = "<File>.<label>_N"` on every clickable, and every
emitter preferred that id over the screen-derived fallback — so the stamp *removed* the screen from
the name. `tap:invoice_client_form:Save` and `tap:invoice_business_form:Save` are two names for the
same component because no id was stamped there; `Topbar.close_4` was one name for 60 screens because
one was.

The damage was in naming. `analytics_event_config` is keyed by event name, so a shared id can only
ever be given one display name — true on one screen, a lie on the other 59 — and switching it off to
quieten one screen silences all of them. "Which screen do people close and leave from" was
unanswerable for exactly the controls the question is about.

`guardedTrackedClick` now qualifies the identity with the screen, idempotently (anything already
starting with `tap:` is left alone). One gate, 550 ids, no call site edited — and that is the point:
44 agents working file by file had left 57% of them behind, because a fix spread across call sites
reaches the ones somebody remembered. `InvotickButton` was the proof it keeps happening: it held a
fourth copy of the emit, so it bypassed both the screen and the double-tap guard.

Unique is now structural; **meaningful is not**. 182 of the 550 labels say nothing (`tap_2`, `btn_3`,
`ib_1`), and 141 of those have nothing in the surrounding code to name them from. They are listed in
`invoice-kmp-app/docs/AUTO-EVENT-NAMES-REVIEW.md`, each to be named or deleted — some are not
actions at all (`SpotlightShadow.tap_1` is a scrim).

### 1.5 Auto-captured and coded are different channels. Know which one you are in.

| | Auto-captured (`trackedOnClick`, `Tracked*`) | Coded (`analytics.trackClick`) |
|---|---|---|
| Release build sends it | **unless it was switched off** | always |
| How to stop it | Sending toggle in Discovery — no release | delete the call from source |
| Marked in the panel | `params.auto = true` | absence of that flag |

**Never build a channel that bypasses the send policy.** A `LocalCodedEventLogger` was added for
exactly that and removed the same day: the policy is the agreed control, and a second path that
ignores it makes the control a half-truth.

### 1.5a Send everything except what somebody switched off. Not the reverse. *(decided 2026-08-23)*

`AnalyticsSendPolicy.shouldSend(key) = key !in denied`. Empty means send everything.

This was an allowlist and had to be inverted, for a reason worth keeping: **an allowlist cannot
discover anything.** A key can only be listed once it is already known, and a key only becomes known
by arriving. So a button added in a later release is absent from the list, silent in release, and
stays undiscoverable for ever. "Turn everything on so the important events get found" is not
expressible as an allowlist.

It also had the emergency lever backwards. The old shape was `DEFAULT || override`, which could only
ever ADD — a key baked into a release could not be switched off without shipping another one. What
an emergency needs is *make it stop*, and that is what a denylist is: one toggle, no release.

> **The incident.** `AnalyticsAllowlist` documented a backend override applied through
> `setOverride`. **`setOverride` had no caller, and nothing ever fetched `/v2/analytics/allowlist`.**
> With a bundled default of `emptySet()` the gate was a constant `false`: release builds had never
> sent a single auto-captured tap, and the panel's Track toggle had never once affected a release
> build. The list was not empty by accident — it was not connected. Filling it would have changed
> nothing. Note what hid it: a documented mechanism, a working-looking UI, and a plausible reason for
> the silence ("the list is deliberately empty"). **A control nobody has watched take effect is a
> control you have not got.**

Empty meaning "send everything" is also the right failure mode: a device that cannot reach the
network is noisy rather than silent, and noise can be discarded while a gap cannot be told apart
from a user who did nothing.

### 1.5b `denied` is not `NOT tracked`. *(decided 2026-08-23)*

A config row is created the first time anyone touches an event — **renaming it is enough** — and
`tracked` is false on a fresh row. Building the denylist from `NOT tracked` would therefore mean
that **giving an event a meaningful name silently switches it off**, which is the opposite of why
anyone names one.

They are different facts: `tracked` is "was opted in", `denied` is "was opted out", and most events
are neither. The upsert field is nullable for the same reason — absent means unchanged, so editing a
name cannot toggle sending as a side effect.

### 1.6 Presence is not the event feed.

`app_heartbeat` is a 25-second ping whose only content is "still here" — it keeps the live dot lit
and is **not** a row in a feed of things the user did. `session_break` is the meaning: one row when
a pause ends, carrying `break_ms`.

> **Incident.** These were briefly the same event name, and every setting was then wrong in one
> direction: hiding the noise hid the meaning, showing the meaning showed the noise. Removing the
> ping instead took the live indicator out with it — the app stopped showing as live at all.

> **Incident, 2026-08-22.** The panel's `PRESENCE_ONLY` also listed `nav_screen_view`, and had done
> since before the two screen events were unified. The app stopped sending that name; the entry
> matched nothing from then on and nothing said so — measured at the time as **3,334 screen firings
> across 37 identities, every one arriving as `screen_view` and none as `nav_screen_view`**. The
> app's own comment on that unification had already named the trap: a check *"keeps working right up
> until the event it names stops being sent"*. It was fixed in the app and the stale copy survived in
> the panel. **A filter keyed by an event name is a claim about what the app sends. Re-check it when
> a name changes — including in the places that did not change.**

### 1.7 An absent parameter means unknown. Never encode unknown as a value.

`had_input` is omitted when nothing in scope can see the form's state. `false` would be a claim that
the form was empty. Same for a planned event's `firings = 0` and `lastSeen = null`.

### 1.8 Event names are stable identities. Never derive them from code symbols.

R8 renames classes in release, so `this::class.simpleName` produces `a`, `b`, `c` **in exactly the
builds being measured** — and it looks like data the whole time. Sheet names are spelled out in a
`when`. Renaming a class must not rename an event a dashboard is counting.

**Stable also means: do not rename them.** *(2026-08-23)* `rename-applied` moves the config row to
the new name and deletes the old one. It **never touches `analytics_events`**. So a rename costs two
things, permanently:

1. **The event's history splits in two.** Old rows keep whatever name was sent at the time, so one
   button becomes two events for ever, and any funnel spanning the rename sees a cliff.
2. **The old rows lose their name too**, because the config row that held it was deleted.

Meaning belongs in the **Meaningful event name** (`displayName`) instead: instant, no release,
nothing split, and old rows stay labelled.

When an identity genuinely must change, it is a **bulk migration, never a per-row field**. Discovery
used to offer "Replace name" — you typed the new identity and then had to remember to press a second
button once the release shipped it. That is 550 chances to forget, each one silently stranding a
row's name, layer and tested mark. It was removed; `applyEventRename` stays, to be called by a script
that rewrites the ids in code and carries every key over **in the same run**, passing `to`
explicitly.

> The 182 ids renamed on 2026-08-23 were free of cost 1 — release builds had never sent an
> auto-captured tap (see 1.5a), so there was no history to split. **That will not be true again.**

### 1.9 An event that explains another must be stamped before it.

`session_break` is emitted *above* `occurredAt` for the event that ended the pause, so its timestamp
is genuinely earlier.

> **Incident.** Emitted after, it carried the later timestamp of the two — a tap at `.869` and its
> own break at `.870`, and once a dead tie at the same millisecond, where the order is then whatever
> the reader happens to do. A comment claimed the correct behaviour and had never been checked
> against the line above it.

### 1.9a A bounced finger is not a second event. It is stopped at the button.

Two taps closer together than `DOUBLE_TAP_GUARD_MS` (400ms) never reach the feed, because the second
one never runs at all. Every clickable in the app passes through `guardedTrackedClick`, which owns
the whole click rather than emitting beside it.

Do not answer this in the analytics layer. Counting around a duplicate leaves the duplicate *action*
in place, and two businesses from one finger is a data problem where two rows are only a counting
one. See decision [0024](docs/decisions/0024-a-double-tap-is-stopped-at-the-button-not-counted-later.md).

A suppressed tap is deliberately **silent** — emitting it would put back the row this removes. To
find buttons that feel slow, measure response time; do not count taps we threw away.

`repeatable = true` opts a control out, for steppers and add-row buttons where every tap is its own
action. Keep that list short: a wrong `true` restores the bug, a wrong `false` eats an action
somebody meant.

> **Incident.** Two fast taps on "add business" put two rows in the live feed. The guard existed
> nowhere, and three helpers were each doing emit-then-call, so a guard added to any one of them
> would have covered part of the app and looked finished — the same shape as the filter chip that
> lived in six files in `LAYOUT_RULES.md`. `trackedOnClick` also opened with
> `LocalUiActionLogger.current ?: return onClick`, which hands back the caller's own lambda in
> release builds: a guard behind that line protects debug devices and nobody else.

### 1.10 Layers

`intent.screen` · `intent.action` · `response.outcome` · `response.gate` · `response.interruption` ·
`infra.api` · `infra.sync` · `infra.ads`.

A **bottom sheet is `intent.screen`**, not a new "sheet" layer: for the funnel it is a place the user
arrived at and can leave. A separate layer would split "where did they drop" across two values.

---

## 2. Verification — how to know it works

### 2.1 Count first. Read values second.

> **Incident.** A device run checked that `method` came out right and never asked how many events one
> dismissal produced. It passed while the client form was emitting three. The owner found it by
> reading the live feed.

`tools/maestro/sheet_dismiss_methods.yaml` and `sheet_dismiss_swipe.yaml` assert the count.

### 2.2 The gateway has TWO log channels. Reading one is worse than reading none.

`trackClick:` **and** `trackScreenEvent:`. A checker that matched only the first reported a tap as a
single clean event while its screen view sat in the same capture. `tools/analytics/double-report-check.py`
reads both; it also only knows the paths that were actually walked.

### 2.3 Compiling is not verifying.

Three defects shipped in one day that compiled and passed 274 tests. For anything that touches a
query or a projection, **write a row the way the application writes one and read it back** — see
`DebugDeviceScopeTest`. Assert the negative too: another device's scope must not return this
device's event, or "scoped" means nothing.

### 2.4 Prove a test fails without the fix.

Reverting **only the production change** — not the test with it — and watching the assertion fail is
the proof. Stashing both proves nothing; that was done once and looked like a pass.

### 2.5 `adb install` can succeed with the previous APK.

md5 the APK before trusting a device run. A Maestro `tapOn` that finds nothing only **warns**.

### 2.6 A grep that searched the wrong scope reports zero and calls it an answer. *(2026-08-23)*

Counting the codemod's stamped ids across `composeApp` and `core/ui` gave **77**, and a check for
shared components gave "0 callers" for a text field used everywhere. Both were wrong by the same
cause: this app has **dozens of `feature/*` modules**, and neither search looked at them. The real
numbers were **550 ids** and 48 callers.

Nothing errored. A zero from a search is only as true as its scope, so state the scope out loud and
test it against something you already know the answer to. `find . -name "*.kt" -not -path "*/build/*"`
is the honest root here — anything narrower has to justify itself.

### 2.7 Proximity in a file is not containment. *(2026-08-23)*

A rename pass searched **backwards** for a label, because `Text(text = "Privacy Policy", modifier =
Modifier.trackedClickable(...))` puts the label above the id. It looked right and it renamed **106
controls to their previous sibling's text**: `AllocationDialog.confirm_3` became `cancel_3`, and two
dialogs' close buttons took the dialog title.

It was reverted whole rather than patched, and the three sites it was written for were done by hand.
When a heuristic walks outside the node it is describing, it will read a neighbour eventually — and
the output is plausible, which is what makes it dangerous.

---

## 3. Backend traps (`analytics_events`)

Full detail in `memory/mysql-binary-uuid-and-test-clock.md`. In native queries:

1. **`user_id` is `binary(16)`.** Read with `BIN_TO_UUID`, filter with `UUID_TO_BIN`. A `String`
   projection returns raw bytes — they reached the admin panel as `-8,-22,3 · 255 events`. A `UUID`
   projection does not work at all.
2. **A bound `Instant` shifts by the JVM's zone.** Compute windows in SQL:
   `created_at > UTC_TIMESTAMP(6) - INTERVAL :minutes MINUTE`. `UTC_TIMESTAMP`, not `NOW` — the app
   writes UTC and the session runs on `SYSTEM` time.
3. **Pre-login events have `user_id = NULL`.** A guest's id exists only after guest-login, so
   `install_referrer`, `app_cold_start` and the splash belong to nobody by that column. Scope by
   **session as well**, the way `LiveEventsController` does — and by session, not device, because one
   device can hold several guests.
4. **A JSON column projects as `String`, not `Map`.** `analytics_event_config.baseline_json` is read
   by the entity through `@JdbcTypeCode(SqlTypes.JSON)`, but an interface projection over a *native*
   query never goes through the entity — it casts the JDBC value to whatever the interface declares,
   and the driver hands JSON over as text. Declaring `Map<String, Any?>` made every load of the
   Discovery page answer 500 with `String cannot be cast to Map`, from the moment the first event
   was marked Tested and the column stopped being null. Same shape as trap 1: **a native query
   returns columns, not fields.** Parse it above the repository.

   > Note what hid it: 268 tests passed. Every one of them left `analytics_event_config` empty, so
   > the LEFT JOIN returned NULL and nothing was ever converted. A nullable column is only tested by
   > a test that fills it.

5. **A page that polls is a hot path. Do not hang cold data on it.**

   The Discovery query polls every four seconds. Config columns were selected alongside the event
   aggregates, which forced `ONLY_FULL_GROUP_BY` to demand all of them in the `GROUP BY` —
   `baseline_json` included. Grouping by JSON makes MySQL sort on a blob: no index applies, and the
   cost scales with rows scanned. Measured on 200k rows, 1152ms against 412ms for the same query
   without it.

   The rule is not "keep JSON out of GROUP BY". It is that **events and config change at completely
   different speeds** — events every second, config when a person types — and joining them in SQL
   means paying for the second at the rate of the first. Aggregate events; fetch the config table
   whole (a few hundred rows); join above the database. Then a column added to config later cannot
   reach the hot query at all.

   > **What this cost.** One pool of 10 connections serves the entire app — sync push and pull, auth,
   > invoices, billing, analytics ingest, the panel. A slow query plus a poll with no in-flight guard
   > filled it: 10 active, 0 idle, 48 queued, MySQL itself idle. Auth could not get a connection
   > either, so the panel signed itself out, and **devices could not sync**. An admin page made the
   > product fail for real users.

6. **A column is a claim about a parameter key. Verify the app sends that key.**

   `analytics_events.screen_name` carries two indexes and was filled from `params["screen_name"]`.
   Only `trackScreenView` sends that key; every auto-captured tap sends `params["screen"]`. So the
   column was never filled for a single tap, and every screen-filtered query answered as though taps
   happened nowhere — not an error, a confident empty answer. Ingestion now reads either.

   Note how long it survived: the column exists, the indexes exist, the code reads it, and the data
   looked plausible because `screen_view` events did fill it. Whenever ingestion extracts a field out
   of `params`, the key is a contract with the app — grep the app for it, do not read it from the
   backend alone.

7. **No prose inside a native query string.** An apostrophe or a `?` in a `--` comment breaks every
   repository in the context. See `memory/no-prose-inside-native-queries.md`.
8. **A dimension you filter on must live ON the event.** *(2026-08-23)* Version and country were
   resolved once per batch and stored on the session, so "compare this funnel across releases" or
   "split it by country" meant a join on `session_id` — a column that arrives NULL for every event
   after the first batch of a session. A joined funnel drops exactly those rows and still returns a
   confident number. Both are now copied onto `analytics_events` at ingestion
   (`app_version`, `app_version_code`, `country`), with an index each. Cost matters too: a funnel is
   several passes over the busiest table in the product, and a join per pass multiplies the
   bottleneck.

9. **Compare builds with `app_version_code`, never `app_version`.** `"1.4.10"` sorts BELOW `"1.4.9"`
   as a string, so a release comparison built on the name is correct for nine releases and then
   silently wrong. The name is for display only. The app sends both (Android `longVersionCode` above
   API 28, `versionCode` below; iOS `CFBundleVersion`), and sends **null rather than 0** when the
   package cannot be read — 0 is a real orderable value that would sort below every shipped build
   and quietly count as the oldest release instead of as unknown.

10. **Build a filter's dropdown from the same table the filter queries.** `/funnel/dimensions` reads
    `analytics_events`, not `analytics_sessions_v2`, so every value offered is one the query can
    match. A list built from the other table can offer a release that returns zero rows — and an
    empty funnel reads as *a step nobody reached*, not as *a filter with nothing behind it*. It is
    scoped to the selected window for the same reason.

11. **Events below the version floor are refused at ingestion.** *(decided 2026-08-23)* Everything at
    or below `analytics.min-app-version-code - 1` (currently 91, i.e. 1.4.0 and older) carries the
    event work that was ruled unacceptable, and mixing it into one table produces a dataset nobody
    can trust rather than a bigger one. Two decisions inside that are load-bearing:

    - **The session is still recorded.** What was refused is the event work, not the fact that a
      device exists — and one row per session is what keeps "how much of the install base has
      updated" answerable. Refuse both and old builds go invisible, and then a funnel on the new
      build cannot be told apart from a funnel on 10% of users.
    - **A refused batch answers 200.** The app retries what fails. A 4xx would put every old device
      into a permanent retry loop against an endpoint that will never accept it — the shape of the
      sync defect that pushed one record 7,173 times. Refusing is a decision, so it is reported as
      one: accepted, zero stored.

    `OldBuildTrafficCheck` reports it in the Health Centre, because a deliberate silence looks
    exactly like an accidental one on a dashboard, and reading a post-release funnel as
    representative too early is a wrong decision made confidently.

12. **Run `./gradlew test` before every backend push.** `SpringContextBootTest` is the gate and needs
   the `invotick-test-mysql` container. That container's clock reports a UTC five hours ahead of the
   one it accepts, so never assert a narrow time window against it.

---

## 4. Admin panel rules

### 4.0 What Discovery shows, and what it stopped showing *(2026-08-23)*

Columns: `#` · `Tested` · **`Sending`** · `Meaningful event name` · `Events from apps` · `Firings` ·
`Layer` · `Save`.

Three went, and the reasons generalise:

- **Status** labelled every row `in list` or `debug-only` — two answers to one question, *will this
  ship from release*, which the `Sending` toggle now answers one cell away. Its `task queued` line
  tracked work to bake a key into `AnalyticsAllowlist.DEFAULT`, **a class that no longer exists**.
  The three states that were still true — `still firing`, `removing`, `planned` — moved onto the
  identity cell as badges. *A badge that appears only when it means something beats a column obliged
  to say something about every row.*
- **Description** was written and read back on the same page and **nowhere else in the product**. The
  meaningful name is the one that travels — Live Events reads it. Its column and API field are left
  in the database: dropping a column is not reversible under Flyway.
- **Replace name** — see §1.8. Kept once on the belief that 182 renamed ids had config rows waiting
  to be carried over; **the config table held six rows and none of them were those.** The belief was
  never checked. *Do not keep a mechanism for a case you have not counted.*


1. **What is worth seeing is decided in Event Discovery, not in a source file.** A hard-coded hidden
   set overrode a deliberate choice the owner had made in the UI, and the page ignored them.
   `PRESENCE_ONLY` is the single exception and holds only plumbing that has no funnel meaning.
2. **Display names come from the config**, falling back to the raw identity. Screen rows are keyed
   `screen: <route>` — looking them up by the raw event name finds nothing for every screen in the
   app while working fine for taps.
3. **A number in a header must describe the rows under it.** The × total and the copied report read
   the pre-search list while the table rendered the filtered one.
4. **Live Events has a row per firing; Discovery has a row per identity.** They reconcile through the
   × column. This confuses everyone at first and is not a bug.
5. **A count must say what window it covers.** Discovery counts a week of history and prints when the
   list was cleared; Live Events counted only what arrived while the page was open and printed
   nothing. Read side by side that was 112 against 72, which looks exactly like events going missing
   — the 40 between them had fired before anyone opened the page. Fixed 2026-08-22 by printing
   `since <time>` beside the stream count. **Two numbers on two pages will be compared whether or not
   they were meant to be; each one has to carry its own scope.**
6. **Track is decided in Event Discovery and shown everywhere.** Every Live Events row states its own
   Track status, and there is a "Tracked only" view filter that is **off by default**, so nothing is
   withheld until it is asked for.

   That filter was built on 2026-08-22, removed the same day, and put back later the same day — and
   the difference is worth keeping, because it is not about the filter. On the first attempt it hid
   rows with nothing to say it was doing so, the row numbers were computed after filtering so the
   survivors were renumbered into a contiguous block, and the header still claimed the full count.
   The result read as events going missing, twice, and cost an afternoon of looking for a fault that
   was not there. **A filter is safe to offer once the page can say what it is holding back and the
   numbering survives it.** Three things had to exist first: the Track column, a row number taken
   before the filter, and a hidden count in the header.

7. **The same event must start at the same place on both pages.** Both Live Events and Event
   Discovery put the identity first and everything about it — screen, time, kind, channel — on a
   second, quieter line under it. Discovery used to lead with the `screen`/`action` and `auto`/`coded`
   badges, so the name began at a different x depending on what kind of event it was, and the two
   lists could not be run down side by side. Two lists of the same events that cannot be compared by
   eye are two lists nobody reconciles.
5. Both pages have **Copy** and **Download**; the copy carries full params, which no screenshot can.

---

## 5. Working with a manual test round

The owner runs a round on the debug device, then hands over instructions. The tooling for that:

1. Discovery → pick the device (debug builds, seen in the last 5 minutes).
2. Run the flow on the phone.
3. **Copy** or **Download** from both pages and hand them over.
4. Reconcile: Live firings should equal the × total for the same device.

`build_type=debug` is what identifies a test device. **Not app version** — a debug build of 1.4.0
reports `1.4.0`, exactly what four thousand real users report, so a version filter returns an empty
list containing none of the devices being tested on.

---

## 6. Before you add, rename or remove an event

**Adding**
- [ ] What decision does this number change? If there is no answer, stop.
- [ ] Is an existing event this thing with a different parameter? Add the parameter instead (§1.1).
- [ ] Auto or coded, and is that the right channel (§1.5)?
- [ ] Is the id unique across the whole app (§1.4)?
- [ ] Does it need `screen`, and does anything already stamp it?

**Renaming**
- [ ] Old rows keep the old name. Say where the history splits.
- [ ] Anything keyed on the name — panel config, allowlist, `ScreenFlowRepository` — moves with it.

**Removing**
- [ ] Coded events ignore the allowlist; deleting the call is the only way to stop one.
- [ ] Check the flags it gated. `savedSuccessfully` became dead the moment its event went.

---

## 7. Suggestions not yet decided — the owner's call

1. **A test that fails when two call sites share an id.** §1.4 was found three times by eye. It is a
   grep over `analyticsId = "..."`; making it a build check ends that class permanently. *(Highest
   value of anything on this list.)*
2. **A naming convention, enforced.** Today there are three at once: `snake_case`,
   `InvoiceScreen.client_card_tap`, and `Business_added`. One shape — suggest
   `<surface>_<thing>_<verb>` — plus a check on new names.
3. **`guest_login_failed` does not exist.** The app's own description of `guest_login_success` says
   so: if it fails the user is stuck on the splash and nothing records it. That is a silent G1 leak.
4. **Write the funnel down first.** The steps from "opened the app" to "shared a real invoice" as one
   ordered list, so a new event is judged by which step it serves.
5. **Split scrim from back**, if an honest way appears. Material3 gives both to one callback; the two
   ways to separate them either change real behaviour or guess.
6. **Volume guard.** `app_heartbeat` was 88 of 95 rows before anyone noticed. A weekly "top events by
   volume" glance in the Health Centre would surface the next one early.
7. ~~**Per-field mic ids** (`TextFiedl.voice_input_4`) and the other shared ids in §1.4.~~ **Done
   2026-08-23** — solved in the gate rather than per id; see §1.4.
8. ~~**"One press, two events" detector.**~~ **Built 2026-08-23** — `DuplicatePressCheck` in the
   Health Centre, verified against live data on its first run (it found
   `tap:invoice_business_form:Save + business_form_saved`, one of the three found by hand).
   `session_break` and `*_permission_requested` are excluded as two-facts-by-design. Deliberately no
   SQL self-join: one indexed range scan over six hours, paired in Kotlin, because joining this
   table to itself sits behind the pool that also serves sync and auth. Originally measured as: On one device's
   stream, 11 pairs landed within 50ms on the same screen with one auto and one coded event. Six were
   `session_break` (§1.9, by design) and two were tap-then-permission-prompt (two real facts). **Three
   were genuine duplicates**, all the same shape — an auto tap on a Save button plus a coded event for
   the same save: `tap:invoice_business_form:Save` + `business_form_saved`,
   `tap:invoice_client_form:Save` + `client_form_saved`, `item_form_add_clicked` + `item_form_saved`.
   Policy is that the **coded** one goes, after review. Finding them by hand does not scale — this
   belongs as a badge on the Discovery row and a count in the Health Centre.
9. ~~**The 30 runtime-label sites.**~~ **Done 2026-08-23** — the call site supplies the id, as
   `DocumentActionBar` already did. Ids were derived from what the call site states *in source* (the
   `NavigateTo("settings")` route, or the `stringResource` key), never from the runtime label. 588
   ids now, none meaningless and none duplicated. Note what made it necessary even after the screen
   prefix: `DrawerItem`'s 25 call sites are the same drawer on the **same screen**, so the screen
   could not separate them. Original note: `DrawerTiles.tap_1..4` are not four buttons; they are one
   `DrawerItem` handed a different `label` each time. §1.1 says one event with the label as a
   parameter. **Do not do this by script:** the same shape includes `CustomerLedgerTopBar` whose
   label is a **client's name**, and `ProfileHeaderComponents` whose label is the **Invotick ID**.
   Sending those as parameters would put customer data into analytics. The pattern already solved
   correctly in this codebase is `DocumentActionBar`, where the **call site** supplies the id
   (`analyticsPrefix = "invoice_action_bar"`), and that is the shape to copy.

---

## 8. Where the rest lives

- `docs/decisions/` — decision log, including what was **rejected**. Read before proposing.
- `AGENTS.md` §5b — the event vocabulary as it stands today.
- `memory/` — `analytics-allowlist-empty`, `g1-real-data-metric-gap`,
  `analytics-session-attribution-bug`, `analytics-timestamp-is-arrival-time`,
  `mysql-binary-uuid-and-test-clock`, `no-prose-inside-native-queries`.
- `invotick-apis/analytics.md` — backend API contract.
