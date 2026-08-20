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

Still outstanding, and worth knowing before adding more: `InvotickClickableTextField` (11 screens),
`InvotickSearchTextField` (12), `DrawerItem` (24), `TextFiedl.voice_input_4` (every mic in the app).

### 1.5 Auto-captured and coded are different channels. Know which one you are in.

| | Auto-captured (`trackedOnClick`, `Tracked*`) | Coded (`analytics.trackClick`) |
|---|---|---|
| Release build sends it | **only if allowlisted** | always |
| How to stop it | remove from the allowlist | delete the call from source |
| Marked in the panel | `params.auto = true` | absence of that flag |

`AnalyticsAllowlist.DEFAULT` is **empty** today, so auto-captured taps reach production only via the
backend override. That is deliberate.

**Never build a channel that bypasses the allowlist.** A `LocalCodedEventLogger` was added for
exactly that and removed the same day: the allowlist is the agreed control, and a second path that
ignores it makes the control a half-truth. If an event should ship, say so in the allowlist.

### 1.6 Presence is not the event feed.

`app_heartbeat` is a 25-second ping whose only content is "still here" — it keeps the live dot lit
and is **not** a row in a feed of things the user did. `session_break` is the meaning: one row when
a pause ends, carrying `break_ms`.

> **Incident.** These were briefly the same event name, and every setting was then wrong in one
> direction: hiding the noise hid the meaning, showing the meaning showed the noise. Removing the
> ping instead took the live indicator out with it — the app stopped showing as live at all.

### 1.7 An absent parameter means unknown. Never encode unknown as a value.

`had_input` is omitted when nothing in scope can see the form's state. `false` would be a claim that
the form was empty. Same for a planned event's `firings = 0` and `lastSeen = null`.

### 1.8 Event names are stable identities. Never derive them from code symbols.

R8 renames classes in release, so `this::class.simpleName` produces `a`, `b`, `c` **in exactly the
builds being measured** — and it looks like data the whole time. Sheet names are spelled out in a
`when`. Renaming a class must not rename an event a dashboard is counting.

### 1.9 An event that explains another must be stamped before it.

`session_break` is emitted *above* `occurredAt` for the event that ended the pause, so its timestamp
is genuinely earlier.

> **Incident.** Emitted after, it carried the later timestamp of the two — a tap at `.869` and its
> own break at `.870`, and once a dead tie at the same millisecond, where the order is then whatever
> the reader happens to do. A comment claimed the correct behaviour and had never been checked
> against the line above it.

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

6. **No prose inside a native query string.** An apostrophe or a `?` in a `--` comment breaks every
   repository in the context. See `memory/no-prose-inside-native-queries.md`.
7. **Run `./gradlew test` before every backend push.** `SpringContextBootTest` is the gate and needs
   the `invotick-test-mysql` container. That container's clock reports a UTC five hours ahead of the
   one it accepts, so never assert a narrow time window against it.

---

## 4. Admin panel rules

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
7. **Per-field mic ids** (`TextFiedl.voice_input_4`) and the other shared ids in §1.4.

---

## 8. Where the rest lives

- `docs/decisions/` — decision log, including what was **rejected**. Read before proposing.
- `AGENTS.md` §5b — the event vocabulary as it stands today.
- `memory/` — `analytics-allowlist-empty`, `g1-real-data-metric-gap`,
  `analytics-session-attribution-bug`, `analytics-timestamp-is-arrival-time`,
  `mysql-binary-uuid-and-test-clock`, `no-prose-inside-native-queries`.
- `invotick-apis/analytics.md` — backend API contract.
