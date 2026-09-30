# Event management — the constitution for analytics

> Read this **before touching any event, in any repo**. `AGENTS.md` is the project constitution;
> this is the same thing for the event system, which spans three repos and breaks in ways that look
> like data rather than defects.
>
> Every rule here was paid for. Where a rule has a date and a number attached, that is the incident
> that produced it — those lines are not illustrations, they are the reason the rule is not a
> preference. **Add to this file the moment a new rule is decided; do not let it live only in a
> conversation.**

## `ms_since_start` measures time since launch — from 2026-09-06, and not before

The parameter is stamped on every event by `SessionJourney.stamps()`. Until 2026-09-06 it counted
from `startedAtMillis`, set when that object is **first touched** — and the first thing that touches
it is `app_cold_start` itself. It was measuring its own distance from itself. Across 1,826 launches
in seven days the median was **4 ms**, which reads as "the app starts instantly" and is a fact about
nothing.

It now counts from `AppStartClock`, marked on the first line of `Application.onCreate` — before Koin,
billing, the ad SDKs and the Room build. That makes it the real time since launch on **every** event
that carries it, which is what makes "how long had they been waiting when they left" answerable from
any event rather than only from the few with a bespoke timing.

**The name did not change and the meaning did.** Rows written before 2026-09-06 carry the old,
meaningless value; rows after carry real elapsed time. Any query that spans that date is mixing two
different measurements — filter by date, or by the app version that ships this. The name was kept
because the old values say nothing worth preserving, but the boundary is real and this is where it
is written down.

Related: `app_cold_start` does **not** fire at launch. It is deferred to the first foreground, after
`Application.onCreate` has finished, so it was never a marker for "the app started" either. The
platform's own splash is on screen well before it — measured once on a Pixel 7 Pro at 2.13 s to the
icon and 4.88 s to our first frame — and nothing marks that stretch.

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
reach** — for a long time that was exactly one place, the ad dialog, which is neither a route nor a
sheet.

From 2026-09-23 there is a **second**, and it passes the same test for a sharper reason: the Google
UMP consent form (`screen_view` for `consent_form`, decision 0162). It is not our composable at all —
it is a full-screen activity the ad SDK puts up — so no nav host, no `InvotickSheet` and no
`analyticsId` can see it, and there is nothing automatic to make meaningful. Its own announcement is
the only way it is announced.

Two places is not a licence for a third. The test is **"can automatic reach this at all"**, not "is
a coded call more convenient here" — and a screen we draw ourselves always fails it.

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

### 1.11 When one press produces two events, the UI layer keeps it. *(decided 2026-09-05)*

An `analyticsId` / `navigationAnalyticsId` on the clickable **and** an `analytics.trackClick` in the
view model for the same press are one action recorded twice. **The auto one survives; the coded one
is deleted.** The tap carries the screen, and one denylist toggle stops it from the panel — a coded
call can only be stopped by shipping a release.

> **The measurement, 2026-09-05.** The Health Centre's `DuplicatePressCheck` returned **16 pairs** in
> six hours. Nine were this shape and were removed in 1.4.3. The counts were exactly what a duplicate
> looks like: `discard_confirmed` 44, `Discard_click` 44, `create_inv_discard_click` 44 — one finger,
> three rows. **This was never new.** Re-running the same pairing over versionCode 92 (1.4.1) found
> the same pairs, and versionCode 91 already carried 35 `tap:` identities, so every build production
> has ever stored auto taps for is affected. There is no clean "before" to compare against, because
> builds ≤ 90 are refused at ingestion (§3.11).

Two things the rule does **not** settle, and both cost something the day it is applied:

1. **The parameters do not move by themselves.** The coded call is usually the one carrying the
   payload — `optional_fields_filled`, `has_logo`, `has_description`. Deleting it keeps the count and
   loses the meaning, and for G1 the meaning *is* the metric. Move them onto the surviving event as
   parameters (§1.1) in the same change, or write down that they are gone.
2. **The tap may not see every route.** A view-model handler is reached by the system back gesture,
   by a post-ad callback, by a picker — none of which the button can see. `saved_inv_back_click` lost
   the back gesture this way, and `DB_create_Invoice_click` covered every dashboard create press
   while its survivor covers only the first-invoice empty state. Count both sides before deleting;
   where the tap cannot reach, the fix is `InvoiceScreenClose.kt`'s shape — report the extra route on
   the **auto** channel under the same name with a `method` parameter.

Deleting a coded call also splits nothing, which is why it is cheap: the name simply stops arriving.
A **rename** does split (§1.8), and `add_item_click` → `add_item_added` is one — so every funnel step
that reads it lists the old spellings too.

> **Applied before the fact, 2026-09-23 (decision 0162).** The GDPR consent work was specified with
> three events, the third being `consent_privacy_options_opened` on the drawer's Privacy-options
> entry. That entry is an ordinary `DrawerItem` and already carries
> `analyticsId = "DrawerTiles.drawer_item_privacy_options"`, so the coded twin would have been this
> defect built new rather than found. It was dropped before any of it shipped: the press is the tap,
> and **which door the form was opened through is `entry` on the two surviving events**
> (`first_ad_moment` | `privacy_options`) — the shape decision 0155 gave the paywall. Nothing is
> lost, because the coded call was carrying no parameter the tap could not (§1.1). The cheapest time
> to apply this rule is before the event exists.

### 1.12 A dimension is only as alive as the row it hangs on. *(decided 2026-09-05)*

Before splitting a funnel by anything stored **beside** the events — anything on
`analytics_sessions_v2` — count how many of the events in the range can actually reach it. Not how
populated the column is. **How many rows exist to be populated.**

> **The incident.** The owner asked to split the first-invoice journey by device language.
> `device_language` is 99.8 % populated across all 31,098 session rows, which reads as a solved
> problem and is the wrong number. The right one: of **20,017** distinct session ids on seven days of
> events, **111** had a row at all — 0.6 %. So the split reached **129 of 521** first-open devices.
>
> The cause was upstream and silent. A session row is written only when the app sends
> `session.action="start"`, and `startSession()` opens with `if (!isNew) return`. App commit
> `0bcc846a` (2026-07-28, *"Never send a session-less event"*) made the first event of a process mint
> the session — a correct fix for `app_cold_start` arriving with `sessionId=null` — and after it
> `isNew` is essentially never true, so the announcement stopped. Coverage went from **72.8 %** on
> builds ≤ 90 to **0.6 %** on versionCode 94, taking `device_language`, `device_class`,
> `screen_width`/`height`, `network_type`, `city` and `device_manufacturer` with it. Nothing failed:
> every batch answered 200 and every event kept its `session_id`, which is exactly what the fix set
> out to achieve.

Three rules out of it:

1. **A column's fill rate is not its coverage.** Measure the join, from the events side, over the
   window you are about to report on. A near-perfect percentage over a table that has stopped
   growing is the most convincing wrong number available.
2. **Nothing the app already sends on every batch may depend on one branch to be stored.**
   `deviceLanguage` was on the top level of every `/v2/analytics/track` request the whole time. Read
   it where it arrives; `AnalyticsTrackingServiceV2` now upserts the session row from any batch that
   carries a session id (decision [0039](docs/decisions/0039-language-is-read-from-the-session-not-re-sent-per-event.md)).
3. **Facet, do not filter, while coverage is partial.** A filter drops the devices it cannot name and
   the remainder reads as the whole population. A facet puts them in an `unknown` row (§1.7). And
   check the survivors for bias before reporting a difference: the 25 % of devices that *did* have a
   language averaged **783 events and 4.5 opens** against **121 and 1.7** for the rest, so any funnel
   gap between the two groups was a gap between heavy and light users wearing a language label.

**A dimension that lives on the session gets a Health Centre check, not a page.**
`SessionMetadataCoverageCheck` watches this one.

### 1.13 A language tag is not a language. *(decided 2026-09-05)*

`device_language` holds BCP-47 as `Locale.getDefault().toLanguageTag()` produces it — language,
region **and** Unicode extensions. Production carries **37 distinct Arabic tags** and 15 French ones:
`ar-EG-u-nu-arab`, `ar-SD-u-nu-latn`, `en-US-u-fw-sun-mu-fahrenhe`, `zh-Hans-CN`. Grouping by the raw
tag scatters one language across dozens of rows, each small enough to read as noise, and the
second-biggest language in the app disappears.

Normalise to the primary subtag through `LanguageTag` (backend, `service/analytics`) before grouping,
always. An unlisted subtag keeps its code rather than getting a guessed name — a wrong language name
on a dashboard is worse than a bare `sw`, because nobody re-checks a word that reads like an answer.

Two things this value is **not**:

- **Not the phone's system language.** The in-app picker calls
  `AppCompatDelegate.setApplicationLocales`, so this is the app's *effective* locale. That is the
  more useful fact, but the column name claims otherwise. Do not report it as the device's language.
- **Not evidence the user saw the app in that language.** As of 1.4.3 the app ships `values-fr` and
  `values-es` with **one string each** (`app_name`; the Spanish one reads `Invoteeck`). The invoice
  flow has no translated strings at all. So a "localized" user is one we did **not** serve in their
  language — which is the question worth asking, and the opposite of how the label reads.

### 1.14 A name says what was seen, never why. *(owner's instruction 2026-09-07)*

This applies to every derived label as much as to an event: funnel stop reasons, buckets, facets,
anything a reader will later count.

Two stop reasons were called `left_waiting_for_ad` / `died_waiting_for_ad`, and the panel spelled it
out — *"Ad ka intezaar karte hue chala gaya"*. Nothing in the signals observes waiting. What that
branch actually requires is that **`splash_ready` had already fired — the app was usable** — and that
an ad request had been made and not resolved. The name took a branch where the app was ready and told
every future reader that the ad had held the user up. `save_watch_ad_no_invoice` did the same by
juxtaposition, and the panel's own wording carried the verdict further still: *"phir bhi chala gaya"*,
*"idhar udhar tap kiya"*, *"(bug shape)"*.

**Why this is a rule and not a style note.** A funnel is read by counting its categories. If the
verdict is already inside the category name, the funnel returns that verdict no matter what the
numbers do — nobody has to argue for it, and nobody can argue against it, because it reads as data.
That is precisely the failure `memory/monetisation-measure-never-assume.md` exists to prevent, and
the owner has now had to say it twice.

So:

| don't | do | because |
|---|---|---|
| `left_waiting_for_ad` | `left_after_splash_ready_ad_pending` | waiting is a state of mind; "splash ready, ad request open" is a fact |
| `save_watch_ad_no_invoice` | `save_then_watch_ad_clicked` | the first arranges two facts into a conclusion |
| "phir bhi chala gaya" | "phir gaya" | *phir bhi* is a judgement about the user |
| "idhar udhar tap kiya" | "tap hue, koi item add nahi hua" | *idhar udhar* is contempt, not a measurement |
| "(bug shape)" | nothing — put it in the check, not the label | a label is not the place to file a hypothesis |

Anyone may still conclude the ad cost the session. They should reach it **from the count, not from
the name.**

These labels are derived at query time (`JourneyStopReasons.reasonFor`, called by
`LiveEventsController`) and never stored, so renaming one costs nothing and needs no app release —
which is exactly why there is no excuse for leaving a dishonest one in place.

### 1.15 One parameter name, one code space. A raw code is not a dimension. *(decided 2026-09-07)*

`code` on `ad_load_failed` and `code` on `ad_show_failed` are **different integer tables that
overlap**. `3` is `NO_FILL` on a load and `APP_NOT_FOREGROUND` on a show. Both events carry the key
`code`, so any panel row, filter or `GROUP BY` that spans the two adds two enums together and
returns a confident number for a question nobody asked. 5,668 rows were stored this way, 100 %
populated — a fill rate that reads as a solved problem, which is §1.12 in a different costume.

Three rules out of it:

1. **A vendor's integer is not a value.** Store it (it is the ground truth and it never lies), but
   put the SDK's own **word** beside it in a parameter of its own, resolved by the table that
   integer actually belongs to. `reason` is that parameter here.
2. **Never translate an integer across code spaces.** A mediation adapter's `AdError` carries its
   own numbering; Pangle's `3` is not AdMob's `3`. Name a code only when the error's `domain` says
   it is in the table you are reading, and send the domain alongside so the pair is self-describing.
   `cause_domain=com.pangle.ads` + `cause_reason=unknown_20001` is a complete fact;
   `cause_reason=no_fill` there would be fiction that nobody could ever catch.
3. **An unrecognised code keeps its number** — `unknown_<n>`, never folded into the nearest named
   bucket. A new SDK version adds codes; folding them makes the biggest bucket quietly grow while
   every reader believes the SDK said something it never said. `unknown_17` names itself as work.

Corollary, from the same change: **a constant `placement` is not attribution.** Every App Open
request in the app's history carries `placement=app_open`, so grouping by it returns one row. What
separates them is `path` — `splash|resume|landing|preload` — and without it "80 % of our App Open
requests were fired by background process wakes, for nobody" was true for months and invisible.
Before splitting anything by a parameter, check how many distinct values it actually has.

### 1.16 Attribution matches whole, or it does not match. *(decided 2026-09-08)*

A campaign tag is matched by **equality on every value at once** — never a substring, a prefix, a
case fold or a "contains". This is not a style preference about SQL; it is the difference between a
number and a claim.

> **The incident.** `JourneyFacets.installSource` bucketed install sources with `"facebook" in v`.
> Facebook-for-Android sets its **own** Play install referrer on anything that reaches the store
> through the FB app — `utm_source=apps.facebook.com`, `utm_campaign=fb4a`, where `fb4a` is the
> Android client naming itself, not a campaign — and Play stores whatever the referring app set,
> whether or not we ever built a link. The substring was true of both. **927 installs that were
> nothing to do with us joined our 8 tagged ones in one bucket**, and the panel wrote *"Facebook
> campaign"* across the pair: a label wrong by a factor of 116, on screen for as long as the bucket
> existed, reading like an answer the whole time. Fixed in `8320714`; the matcher is now
> `UtmTag` with `UtmTagTest` as the guard.

Three rules out of it, and they generalise past UTM to every join between something we created and
something a vendor sent back:

1. **A vendor's identifier lives in the vendor's namespace, not ours.** `apps.facebook.com` is
   Facebook's word for Facebook. `facebook` is ours. That they share six letters is a coincidence of
   spelling, and a matcher that reads it as agreement will find the same coincidence again with the
   next network. Under equality the two are simply different, which is a property nobody has to
   remember.
2. **Match on the fields, not on the whole raw string.** `install_referrer` carries `referrer_raw`,
   which is exact and therefore tempting — and it breaks the day a network appends its own
   parameter. Google Ads adds `gclid`; a raw-string match would then return **zero installs for a
   campaign that had them**, and a zero on an attribution page reads as "the campaign failed". Match
   the three tag values; extra parameters are allowed to be there.
3. **State what the key cannot separate, in the row.** The short code never reaches the install
   referrer, so seven links carrying an identical tag have **one** install count between them and no
   query can divide it. Splitting it evenly, by click share, or by "newest link wins" is invention
   wearing a number. Each link shows the same figure and says on its own row that the figure belongs
   to the tag. Decision [0044](docs/decisions/0044-an-install-belongs-to-a-tag-not-to-a-link.md).

**And a zero is an answer.** Most tags produce no installs; that is the finding, not a failure to
measure. Rendering it as `—` or a blank cell puts back the state the page was already in, where
nobody could tell "nothing came from this link" from "nothing was ever read". The only cell allowed
to print as not-applicable is one where the thing could not have been measured at all — a link with
no Play URL, which never had an install path (§1.7).

### 1.17 A second surface joins the pipeline; it does not start one. *(decided 2026-09-09)*

The `/i/{token}` share page is the first non-app client to send events. Four things had to be settled
before it could send one, and each generalises to whatever comes next — the web dashboard, a future
iOS build, an email pixel. Decision
[0045](docs/decisions/0045-the-share-link-page-reports-its-own-journey.md).

1. **The same action on a new surface keeps its name; the surface is a parameter.** Approving from a
   browser and approving in the app are one action (§1.1). A web-only twin would split one funnel
   step across two names, and the first query that forgot one half would report a smaller number with
   nothing saying so. **And it must fire at the same MOMENT** — the app fires
   `shared_invoice_approved` on the backend's confirmation, so the web does too. One name meaning
   "decided" on one surface and "tried" on the other is a metric that moves for a reason that never
   happened.

2. **A new name is needed when the populations differ, even if the words match.** The app's
   `shared_invoice_opened` fires only after senders have been routed away to their own invoice, so
   its rows are receivers-only by construction. The public web page cannot tell a sender from a
   receiver at all. Reusing the name would have put two populations under one id (§1.4) and quietly
   raised the app's own count. `shared_invoice_page_view` is the twin, not the same event.

3. **The surface must be stamped ON the event.** `analytics_events` has no platform column —
   platform lives on `analytics_sessions_v2`, and §1.12 and §3.8 are both about why that join cannot
   carry a dimension. So every web event carries `surface`. **The gap this leaves is real and is
   named rather than papered over:** the app does not send `surface`, so the facet reads
   `web_share_link` against **NULL**, and NULL means unknown, not app (§1.7).

4. **Client-supplied identity is decided by the server, or it is not identity.** Three things are
   never taken from a public browser body: the **event id** (`save()` on an existing id updates that
   row, so accepting one lets anyone overwrite any analytics event we hold), the **surface**, and the
   **platform of the viewer**. And the event **name** comes from a fixed list — a public endpoint that
   accepts arbitrary names lets anyone forge `invoice_shared_success`, which is the G1 metric itself.
   Volume limiting is the second line, not the first.

**One more, and it is the trap that would have swallowed the whole thing:** the ingestion floor
(§3.11) refuses any batch with no `appVersionCode`, and a web page has no Android build number. Every
event would have been refused the way this system refuses things — 200 OK, summary says accepted,
zero rows written. The page would have shipped, sent everything correctly, and produced a funnel that
read as *a step nobody reached*. `AnalyticsVersionGate` now exempts `Platform.Web`, because the floor
was never about age; it is about one body of event work on one client. **Before adding a client,
walk the ingestion path and ask what silently drops it** — the answer is not in the client's code.

### 1.18 An id on an event is a join key, not a dimension. *(decided 2026-09-11)*

`request_id` and `record_id` on `sync_failed` (decision 0050) exist to find one failure: in the
server's log, and in its `sync_failure` row. Grouped, they return 200 values of 1 each. So Event
detail must show id-like keys as a distinct count, never as a breakdown.

Two more rules from the same change:
- Every parameter is stored as a string, so CAST before comparing versions or statuses.
- A class name reaches us only if R8 keeps it. `exception_class` depends on
  `-keepnames class * extends java.lang.Throwable`.

**The same night, the §1.17 trap again, on a client that already existed.** The version floor refused
every iOS batch. iOS sends its build number (15) as `appVersionCode`, which is below 91, so TestFlight
testers read as zero while every batch was answered 200. The floor is now Android's: Web and iOS are
exempt.

> **The three pairs 0037 left open, answered by the owner on 2026-09-26.** (1) `Item_added` beside the Add
> button's `add_item_added`: *"Nateeja-event banao"* — it became the **result** (§1.24), sent once the line is on the
> document, with the parameters §1.11.1 said were lost. (2) `client_form_saved` + `client_add_success`: *"Dono rakho,
> alag cheezein hain"* — the client was saved; a client was put on the invoice. (3) `invoice_screen_close` +
> `Create_Invoice_Backpress_click`: *"Aik event, sab maloomat us me"* — the coded one goes, its parameters move.
> Two lessons from applying it. **A press and its result are two facts, and the check is told the pair, never the
> name**: `DuplicatePressCheck.isPressAndItsResult` lists `add_item_added` + `Item_added` and the client form's
> Save/Update tap + either client event, so the same result beside any other tap is still reported. And **count what
> the old event covered before choosing what reads it**: `Create_Invoice_Backpress_click` was named for the back
> gesture but fired on the ✕ too (162 of 459 pairs), so the backend reads both methods (§1.25).

### 1.24 An event fires where the fact becomes true, and a wait running out is not an answer. *(decided 2026-09-26)*

*(Numbered 1.24 because 1.19–1.23 live on `feat/m3-theme-and-label-verification` and are not on `main` yet.)*
Decision [0174](docs/decisions/0174-a-payment-is-reported-when-it-is-written-and-a-timeout-is-not-an-answer.md).
Two defects, one shape: the event was sent from a place where the thing it names had not happened.

> **`payment_added`, 0 rows ever.** Half of G1 (0006). Its sender was a list change in memory, behind an intent
> nothing dispatched; the three places that **write** a payment sent nothing. 419 payments in 30 days, 0 events. The
> name was in the vocabulary, the decision and the panel catalogue the whole time, which is what hid it.
>
> **`consent_decision`, `dismissed` for a person who pressed Consent.** A 4 s wait for UMP started before the form
> appeared. When it ran out, the flow wrote its one row with what UMP held then (nothing chosen yet), and the real
> answer arrived as a second row and was dropped.

The rules:
- **Send a result where it becomes true**: after the write, after the store answers, after the form closes. Never on
  the press that asks for it, and never on an in-memory change that can still be thrown away.
- **A timer we own is a fact about us.** It may release a waiting screen or ad, but it never writes the user's
  answer. Record it as a parameter on the row the real ending writes (`timed_out=true`), not as an `outcome`: with one
  row per flow, an `outcome=timeout` replaces the answer it was meant to sit beside.
- **Every place that performs the action reports it, and only one file spells the name.** Enforced for payments by
  `EveryPaymentWrittenIsReportedTest`, which walks the repository, so the fourth place that writes a payment fails
  the build the day it is written.
- **Before trusting a G1 leg, count its rows against the table it describes** (`payments`, `shared_invoice`). A
  name with zero rows next to a table with hundreds is a dead sender, not a behaviour.

### 1.25 A parameter that changes without a redraw is read at the tap. *(decided 2026-09-26)*

Decision [0037](docs/decisions/0037-the-ui-layer-owns-the-press.md) addendum. An auto tap's parameters are built
while the button is **composed**, and a button is redrawn only when something it shows changes. That is right for
`had_input` (the form changing redraws the screen) and wrong for anything that moves on its own: `ms_on_screen` built
that way says how long the screen had been open at its **last redraw**, which can be minutes before the press.

- A parameter the screen cannot see change goes in `paramsAtTap` (`guardedTrackedClick`, `TrackedIconButton`), a
  function read when the finger lands. The top bar's ✕ reads a screen's close details through
  `LocalSheetCloseDetails` this way. Pinned by `TheCloseEventReadsItsDetailsAtTheTapTest`, which moves the clock
  without a recomposition and presses the ✕.
- **When a coded event goes, its parameters move with it to every route of the survivor**, and the routes are counted
  first. `invoice_screen_close` has three (✕, system back, "Discard Everything"); all three carry
  `has_changes`, `item_count`, `has_client`, `has_business` and `ms_on_screen` from 1.4.9.
- A backend signal that read the old name keeps it (§1.8) and adds the new shape — never one or the other — and a
  press that old builds report under both names is counted once (`GREATEST`, not `+`).

### 1.24 An error the person reads is counted at the one place it is made. *(decided 2026-09-27)*

About 130 screens put an exception into the sentence (`Failed to delete client: FOREIGN KEY constraint failed`), and
none of them told us. Now every failure sentence comes from `ShownError` (`domain/model/form`), or `ErrorReport`
below `domain`. The same call returns the sentence, logs the cause and sends **`error_shown`**. Showing and counting
cannot come apart.

**The rules.**
- **Codes only.** `action`, `subject`, `exception_class`, `http_status`, `kind`. Never the sentence and never the
  exception's message (§1.22 — there is no closed-vocabulary key for the free text to ride beside).
- **`kind` is decided in one place** (`ErrorShown.kindOf`). `server` when a status came back. `network` when the
  exception, or anything it wraps, is a connection failure. `local` for a class only this process throws. Otherwise
  `unknown`: a bare `Exception` is never guessed into a bucket (§1.7).
- **Shown means drawn.** Nothing is sent for a cancelled screen (§1.19), a second showing of the same exception, or a
  state field no screen draws (`drawn = false`). Counting an undrawn sentence would make the number lie.
- **A domain event is not replaced by it.** `sync_failed`, `guest_login_failed` and `shared_invoice_open_failed` keep
  saying what failed. `error_shown` says that a person was told.

`ErrorTextNeverReachesThePersonTest` fails the build when a screen shows exception text, or writes a sentence in place
inside a failure block. Decision
[0178](docs/decisions/0178-an-error-a-person-reads-is-a-plain-sentence-and-it-is-counted.md).

### 1.26 What a screen is showing, and which arm of a test an install is in, are stamps — not events. *(decided 2026-09-29)*

The Screen Map could not tell a Create Invoice visit under the tour from one without it, and could not compare the
two, because every new user got the tour. Both answers are now **parameters the gateway stamps**, the shape of
`ui_mode` (§1.1): no new name, every event, absent when unknown (§1.7).

- **`screen_mode`** (`tour_business|tour_client|tour_items|none`) is set by Create Invoice while it is **resumed**
  and no full-screen ad is up, and cleared the moment either stops being true. Its sheets carry it; ad events never
  do; Edit Invoice never does. Before its draft loads, it is absent — `none` would claim nothing was drawn.
  - **Pausing is not enough on iOS.** The interstitial is presented over the Compose host without pausing it, and
    the host stops drawing, so the interstitial's `ad_shown` still carried the mode on the Simulator. The screen now
    collects `AdVisibilityController.fullScreenAdShowing` directly, which needs no frame.
  - The `screen_view` that announces the *next* screen still carries the mode being left: it is read before the
    screen pauses. Split by `screen_name`, not by the stamp alone.
- **A moment that is already a row is not a new event.** The tour ends only with the first item, and
  `Item_added` is reported before the screen redraws, so `Item_added` + `screen_mode=tour_items` *is* the end of the
  tour. Any other end is the first `none` after a `tour_*` with no such row between them.
- **`overlay_variant`** (`on|off`) rides on every event of an install that was dealt an arm. The dealing itself is one
  coded **`onboarding_overlay_assigned`** per install (nothing is pressed; decision 0064's reason), carrying the
  `bucket` and where the share came from (`percent_source=remote|missing|invalid`), because a kill switch nobody can
  see take effect is not one (§1.5a).
- **An arm is decided once and never flips.** Stored per install (phone-wide), dealt from the device id, never for an
  install that existed before the test. A Remote Config share is **read as a string**: a missing number reads `0`,
  and `0` is the kill switch.

Decision [0183](docs/decisions/0183-the-screen-map-measures-the-tour-dead-taps-and-ad-clicks.md).

### 1.27 A tap nothing took is one auto event, observed and never taken. *(decided 2026-09-29)*

**`dead_tap`**: `cell` (6 × 12 grid of the window, never finer), `scroll_bucket` (quarter windows, only where the
screen registers its scroll), `layer` (`screen|sheet|dialog`), `taps` (one event per burst in one cell, ≤ 1.5 s
apart), `window_class`. No coordinates, no text, no screenshot.

- **Auto channel**, so the denylist stops it with no release (§1.5a). A coded twin would bypass that.
- **Passive.** The observer reads each gesture in the Main pass after every control under it, never consumes, never
  waits. A tap counts only if nothing consumed any part of it — a clickable's up, a scroller's moves, the WebView
  interop filter's whole claimed stream — and it is read once more after the dispatch. The invoice WebView must
  behave exactly as before (memory `webview-gesture-findings`: a non-passive listener broke panning once).
- **The screen is frozen at the tap.** A burst is sent up to 1.5 s later, so `screen` and `screen_mode` are taken
  when the finger lands, not when the row is written.
- **The root names the destination, not the last sheet.** The gateway's current screen stays on a sheet's name after
  the sheet closes (a Create Invoice tap read `item_form_scr` on the Simulator). The shell publishes its own
  `LocalScreenId` for the root observer; a sheet or dialog uses its own.
- **Both platforms.** On the iOS Simulator, taps on the invoice WebView and on the banner (UIKit views) sent none.
- **A disabled button is a dead tap.** Nothing took it; that is the fact, and it is worth seeing.

Decision [0183](docs/decisions/0183-the-screen-map-measures-the-tour-dead-taps-and-ad-clicks.md).

> **History split, same change.** The Payment Method card on Create Invoice had no id, so it reported under the
> `tap:create_inv_scr:card` fallback every unnamed `InvotickCard` shares (§1.4) — and `tap:<edit screen>:card` in Edit
> Invoice. From the build carrying `feat/screen-map-app-signals` it is **`create_inv_payment_method_click`** in both
> modes (the Terms card's shape). A query for the card across that release reads both names.

### 1.28 The interface language is a stamp; the test's arm is sticky; the person's choice wins. *(decided 2026-09-29)*

Decision [0185](docs/decisions/0185-the-app-speaks-french-to-french-phones-with-an-english-holdout.md). No new name for
a variation (§1.1): the language is four parameters the gateway stamps on **every** event and every `screen_view`,
the same shape as `overlay_variant`.

| Parameter | Values | Absent means |
|---|---|---|
| `lang_variant` | `fr` · `en_holdout` (French-language phone, the French test's arm) · `not_eligible` (not a French phone, or chose first) | a French phone not dealt yet in this process — the first run's splash (§1.7) |
| `app_lang` | `en` · `fr` — what the interface is **actually drawn in** | before the language is restored (never, after `MyApplication.onCreate`) |
| `device_lang` | primary subtag only (`fr`, `en`, `ar`) — the phone's language as the platform gives it to the app, never the app's own override | unknown |
| `lang_pick` | `manual` — the person chose in Drawer → Language; the choice wins over the arm | no choice made |

- **One coded event, `french_ui_assigned`**, once per phone when the arm is dealt (after the splash's ad gate, like
  `onboarding_overlay_assigned`): `lang_variant`, `bucket`, `holdout_percent`, `percent_source`
  (`remote|missing|invalid`), `bucket_source` (`device_id|random`), `device_lang`; and once more, with
  `released=true`, if Remote Config `french_ui_holdout_percent="0"` ends the test for a held-out phone.
- **Read the test by `lang_variant`, never by `app_lang`**: the arm is intention-to-treat. A held-out phone whose person
  then picked French keeps `lang_variant=en_holdout` and shows `app_lang=fr` + `lang_pick=manual` — that crossover is
  data, not noise.
- `device_lang` is not `analytics_sessions_v2.device_language` (§1.12–1.13): that one is the app's effective locale,
  and from this build the app changes its own locale for the holdout and for a manual pick.
- Rows from builds before this one carry none of the four keys. Absent is unknown, not English.

### 1.29 A flow the vendor runs is counted at the steps we can observe, and an arrival is stamped by the build that arrived. *(decided 2026-09-29)*

**What went wrong.** Google Play's in-app update prompt ran on every launch and recorded nothing. On 2026-09-29, 21 % of
active Android phones were two or more builds behind, and nobody could say whether Play never offered the update, the
user declined it, the download failed, or nobody pressed Restart. The sheet's answer came back through
`onActivityResult`, and nothing read it.

The rules:
- **Every step that a vendor's flow reports back to us is one coded event**, with the vendor's code turned into the
  vendor's own word (§1.15). No auto tap can carry a vendor's sheet or a vendor's callback (§1.3, §1.23).
- **Report the answer, not the launch, when the answer always comes back.** A launch row beside its answer counts one
  sheet twice. A launch that fails is an outcome of the same event.
- **Never a row per progress tick.** Report the end states, once per outcome per process.
- **A check that answers "nothing to do" is rate-limited, not dropped.** Once a day per phone keeps the rare, useful
  case (a phone that is behind while the vendor says "not available") without one row per open.
- **An arrival is a parameter on the new build's `app_cold_start`, never an event from the old build.** The old
  process is killed to install, so its last row is usually never written. `updated_from_version_code` is absent on a
  first install and on the first run of the build that starts recording it — unknown, never "not updated" (§1.7).

Events: `update_check`, `update_prompt_result`, `update_download_result`, `update_restart_offered`,
`update_restart_tapped`, `update_restart_failed`, and `app_cold_start.updated_from_version_code`. Decision
[0186](docs/decisions/0186-the-play-update-prompt-is-counted-from-check-to-landing.md).

### 1.30 More interface languages extend the same four stamps; each test has its own event. *(decided 2026-09-29)*

Decision [0187](docs/decisions/0187-portuguese-spanish-and-arabic-with-one-shared-holdout.md). Portuguese, Spanish and
Arabic join French. §1.28 still holds: no new name for a language (§1.1). The same four stamps are extended, and one
test is added for the three new languages together.

| Parameter | Values from this build | Absent means |
|---|---|---|
| `lang_variant` | `fr` · `pt` · `es` · `ar` · `de` · `fa` · `hi` · `id` · `my` · `nl` · `pl` · `sv` · `th` · `tr` · `zh` · `en_holdout` · `not_eligible` | as §1.28 |
| `app_lang` | `en` · `fr` · `pt` · `es` · `ar` · `de` · `fa` · `hi` · `id` · `my` · `nl` · `pl` · `sv` · `th` · `tr` · `zh` | as §1.28 |
| `device_lang` | unchanged: the phone's primary subtag | unknown |
| `lang_pick` | unchanged: `manual` | no choice made |

- **Two tests, never one pool.** French keeps its own test: Remote Config `french_ui_holdout_percent`, the event
  `french_ui_assigned`, its stored arm and its bucket salt, all unchanged from 0185. The three new languages share the
  **translated** test: Remote Config **`translated_ui_holdout_percent`** (text, default `"50"`; `"0"` releases every
  held-out phone to its own language; `"100"` keeps new installs English), and one coded
  **`translated_ui_assigned`** per pt/es/ar phone when its arm is dealt. Its parameters are exactly
  `french_ui_assigned`'s: `lang_variant` (`pt|es|ar|en_holdout`), `bucket`, `holdout_percent`, `percent_source`
  (`remote|missing|invalid`), `bucket_source` (`device_id|random`), `device_lang`; plus the second row with
  `released=true` when `"0"` ends the test for a held-out phone.
- **`en_holdout` is shared by both tests.** Which language a held-out phone was held out *of* is its `device_lang`
  (`fr` → the French test, `pt|es|ar` → the translated test). Always split `en_holdout` by `device_lang` before
  comparing with an arm: a pooled `en_holdout` mixes Angola, Venezuela, Egypt and France.
- **Read each language against its own holdout**: `lang_variant=pt` against `lang_variant=en_holdout AND
  device_lang=pt`. The shared percent deals the arms of all three at once, but the populations are never pooled.
- **Sticky, any country.** The arm is dealt from the phone's language, never its country, once per install, and a
  pick in Drawer → Language wins over it (`lang_pick=manual`), exactly as §1.28. Phones already dealt a French arm
  keep it. A phone that changes its language from Portuguese to Spanish keeps its translated-test arm: the test is per
  install, not per language. Its rows keep the arm as dealt (`lang_variant=pt`) and show `app_lang=es` — intention to
  treat, as §1.28.
- **`not_eligible`** is now any phone whose language has no interface (not en/fr/pt/es/ar; from 1.5.0, none of the
  sixteen below), or an English phone.
- Rows from builds before this one carry no `pt`, `es` or `ar` value and no `translated_ui_assigned`. A pt/es/ar phone
  on 1.4.9 or 0185's build reads `not_eligible` — it was not in any test then.
- **Wave 2 (2026-09-29, 1.5.0 / versionCode 114, not released): sixteen interface languages.** German, Persian,
  Hindi, Indonesian, Burmese, Dutch, Polish, Swedish, Thai, Turkish and Chinese (Simplified) join the **translated**
  test beside pt/es/ar — no new key, event or salt. `lang_variant` and `app_lang` gain `de` · `fa` · `hi` · `id` ·
  `my` · `nl` · `pl` · `sv` · `th` · `tr` · `zh` (the full list is the table above: fifteen languages plus English);
  `translated_ui_assigned` fires for their phones too, with `lang_variant` = the phone's language or `en_holdout`,
  and `en_holdout` is split by `device_lang` exactly as above. An Indonesian phone's `device_lang` is `id` whichever
  code the platform reports (Android's `Locale.getLanguage()` still says `in`; `InterfaceLanguages.primary` reads it as
  `id`). A Chinese phone is `zh` for both Simplified and Traditional settings (`zh-Hant-TW` is dealt a `zh` arm and
  reads Simplified). Russian (8 phones) is not in this build: a Russian phone stays `not_eligible`. Rows before this
  build read `not_eligible` for all eleven.

### 1.31 A control that moves to another place gets a name of its own; the old name keeps its history. *(decided 2026-09-30)*

Decision [0193](docs/decisions/0193-edit-is-one-tap-in-the-saved-documents-top-bar.md). Edit on the saved invoice and
the saved estimate left the More menu for the top bar: one tap instead of two.

| | Name | Screens | Builds |
|---|---|---|---|
| Old: More → Edit | `more_edit_click` | both, told apart only by `screen` (`saved_inv_scr` / `save_estimate_scr`) | up to 1.5.0 (versionCode 114) |
| New: the top bar's Edit | `saved_inv_edit_click` · `saved_est_edit_click` | one name per screen | the first build after 1.5.0 (versionCode > 114) |

- **Auto-captured, no coded twin** (§1.3, §1.11). The press still sends the same `EditClicked` intent, and nothing in
  the view model emits.
- **Why a new name, not the old one.** The old name meant two presses — More, then Edit — and a funnel reads it that
  way. Kept on a button that never opens More, it would describe a path nobody took. It was also one name for two
  screens (§1.4); a new control is the moment to give each screen its own.
- **Why not `rename-applied`.** It moves the config row to the new name and deletes the old one (§1.8), so every old
  row would lose its display name, and one old name cannot move to two new ones. `more_edit_click` stays in the panel
  as it is. It is deliberately **not** in `tools/analytics/renamed-events.tsv`.
- **Joining the two.** *Pressed Edit on the saved invoice* = `more_edit_click` with `screen = 'saved_inv_scr'` ∪
  `saved_inv_edit_click`; the estimate is `more_edit_click` with `screen = 'save_estimate_scr'` ∪
  `saved_est_edit_click`. No build sends both — Edit left More in the same change — so nothing is counted twice.
  Split by `app_version_code` whenever the window spans the release.
- **The More count changes meaning at the same build.** `saved_inv_more_click` and `saved_estimate_more_click` no
  longer lead to Edit and are expected to fall. That is Edit moving out, not people editing less — and it is how
  0193 is measured: before, 619 of the 1,776 phones that saw the saved invoice opened More (30 days to 2026-09-30),
  and 344 of them pressed Edit.

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

    - **`Platform.Web` is exempt** *(2026-09-09)*. The floor is not about age; it is about one body
      of event work on one client. A web page has no Android build number, so the floor would have
      refused every event from `/i/{token}` in exactly the invisible way described above — accepted,
      zero stored, funnel reads as a step nobody reached. §1.17 and decision
      [0045](docs/decisions/0045-the-share-link-page-reports-its-own-journey.md).

    `OldBuildTrafficCheck` reports it in the Health Centre, because a deliberate silence looks
    exactly like an accidental one on a dashboard, and reading a post-release funnel as
    representative too early is a wrong decision made confidently.

12. **Run `./gradlew test` before every backend push.** `SpringContextBootTest` is the gate and needs
   the `invotick-test-mysql` container. That container's clock reports a UTC five hours ahead of the
   one it accepts, so never assert a narrow time window against it.

13. **`first-invoice-journey` needs ISO-8601 datetimes. A bare `YYYY-MM-DD` is silently ignored.**
    *(measured 2026-09-09)*

    | `from` / `to` | firstTimeUsers | createdInvoice |
    |---|---:|---:|
    | `2026-09-08` → `2026-09-09` (2 days) | 156 | 32 |
    | `2026-09-02` → `2026-09-10` (8 days) | 156 | 32 |
    | `2026-08-10` → `2026-09-09` (30 days) | 156 | 32 |
    | `2026-07-01` → `2026-09-09` (70 days) | 156 | 32 |
    | `2026-09-08T00:00:00Z` → `2026-09-09T23:59:59Z` | **221** | 43 |
    | `2026-09-02T00:00:00Z` → `2026-09-09T23:59:59Z` | **1360** | 287 |

    Four ranges spanning two days to seventy return **the same population**, which is not a range at
    all. The ISO form varies correctly and agrees with SQL: `COUNT(DISTINCT app_instance_id)` for
    `app_cold_start` with `params.is_first_open='true'` over 2026-09-02→09-10 is **1,359** against the
    endpoint's 1,360.

    **What makes it dangerous is not the size of the error, it is the plausibility of the answer.**
    156/32 is **20.5 %**; the true figure over the eight days asked for is 287/1360 = **21.1 %**. The
    percentage is almost identical, so every sanity check passes — the ratio looks right, the buckets
    look right, and only the population is wrong, by a factor of nine. A funnel read this way reports
    a correct-looking rate over a cohort nobody selected.

    Always pass the full ISO instant, and **prove the range is being read** by asking for two
    different windows and checking the numbers differ. A parameter that changes nothing is not a
    parameter.
14. **A first open from 2026-08-25 to 2026-09-06 10:39 UTC may have no session row: its session facets are
    "unknown", not a missing user.** *(2026-09-29)* 231 real devices from those days (builds vc91–vc94; 232 less
    our own test phone) have **no `analytics_sessions_v2` row**. Until backend commit `7ba8ac8` (live 2026-09-06
    10:39 UTC) the server wrote a session only on `action=start`, and 1.4.1+ almost never sends that (the cold start
    mints the session first, so `startSession()` returns early). Their events are all stored — 21,545, none with a
    NULL `session_id` — and they behaved like everyone else: 80.2 % passed the splash, 45 saved invoices to our
    server. What is gone for good is everything only the session row holds: device language, model, class, screen,
    network type and city. So any breakdown by those facets over that window shows about **27 % unknown**, and the
    unknown are the *less* active phones (a phone that came back after the fix got a row from the fallback write).
    Read them as unknown: never drop them as a step nobody reached, never compare that window's language or model mix
    with a later one without saying so, and join `device_journey` (built from `analytics_events`) when the question
    is only whether a device existed. Since the fix: 0 of 7,053 first opens without a row. Report:
    `kaam/research/2026-09-29-installs-without-session.md`.

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

**Moving a control to another place** (§1.31)
- [ ] It gets a name of its own; the old name keeps its rows and its config row. Not a rename, not `rename-applied`.
- [ ] Write the join (old name ∪ new name, and the build that switches) where the funnel reads it.
- [ ] Remove the old door in the same change, or say why both stay — two doors split one action across two names.

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
8. ~~**"One press, two events" detector.**~~ **Built 2026-08-23, first full read 2026-09-05** —
   `DuplicatePressCheck` in the Health Centre. The full read returned **16 pairs, not one problem**:
   nine were a coded twin of a tap (removed in 1.4.3 — §1.11), four were **not duplicates at all**
   and the *check* was narrowed instead of the app, and the rest need a person. Two things the check
   itself got wrong and both are §1.6 in miniature: it excluded `*_permission_requested`, **a name
   the shipped app has never sent** (it sends `notification_permission_shown`), so the one case the
   exclusion was written for was reported as a duplicate for the check's whole life; and it printed
   the **top ten of sixteen** with nothing saying so, which is a header that does not describe its
   rows (§4.3). It now separates *same identity on both channels* (no judgement needed) from *two
   names* (read it first), and lists every pair.
   Original note: verified against live data on its first run (it found
   `tap:invoice_business_form:Save + business_form_saved`, one of the three found by hand).
   `session_break` and `*_permission_requested` are excluded as two-facts-by-design. Deliberately no
   SQL self-join: one indexed range scan over six hours, paired in Kotlin, because joining this
   table to itself sits behind the pool that also serves sync and auth. Originally measured as: On one device's
   stream, 11 pairs landed within 50ms on the same screen with one auto and one coded event. Six were
   `session_break` (§1.9, by design) and two were tap-then-permission-prompt (two real facts). **Three
   were genuine duplicates**, all the same shape — an auto tap on a Save button plus a coded event for
   the same save: `tap:invoice_business_form:Save` + `business_form_saved`,
   `tap:invoice_client_form:Save` + `client_form_saved`, `item_form_add_clicked` + `item_form_saved`.
   Policy is that the **coded** one goes, after review — **confirmed as the rule on 2026-09-05,
   see §1.11**, with the caveat that the coded call's parameters have to be moved onto the survivor
   or they are simply lost. Finding them by hand does not scale — this
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
