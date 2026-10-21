# 0138 — The rates are fetched four times a day, and the service says so out loud

- **Date:** 2026-09-21
- **Status:** decided (the schedule, by the owner on 2026-09-20). **Built, pushed, not deployed.**
  The credential part below is **found, not fixed** — it needs the owner to set a value and to
  answer one question.
- **Decision:** fetch exchange rates **every 6 hours**; let the schedule be written as a name *or*
  as a plain duration so the next change needs no release; and make `/healthcheck` publish the
  interval it is actually running on, what it costs, and whether it understood its own config.
- **Owner, 2026-09-20:** four times a day. Not daily, not hourly.

---

## 1. What four times a day actually costs

Quota stopped being the constraint in July, when the keys' `monthly_quota` was corrected from a
wrongly-entered 100 to the provider's real free limit of 1,000.

| | requests / month | share of the 3,000 available |
|:--|--:|--:|
| hourly (the January value, and the fault) | 744 | 25% |
| **every 6 hours (this decision)** | **~124** | **~4%** |
| daily (the July fix) | 31 | 1% |
| actually used in the whole of September | **21** | 0.7% |

So the number that changes is not the bill. It is **how old a rate may be when it reaches a
screen**: daily allowed 24 hours, four times a day caps it at 6.

Three keys at 1,000 each outlast every one of these schedules. Even hourly fits now — it is simply
not worth the staleness argument in reverse: an invoice summary should not move because the rate
moved at three in the afternoon.

## 2. The schedule can now be written as a duration

`ExchangeFetchProperties.resolveFixedDelayMs()` understood exactly two words, `hourly` and `daily`,
and **anything else fell through to `hourly`** — the most expensive value there is, and the one that
exhausted all three keys on 2026-07-11 and served the same snapshot for sixteen days.

What it takes now:

- names: `hourly`, `every-6-hours`, `6-hourly`, `twice-a-day`, `daily` (case, spaces and
  underscores are all forgiven);
- **any ISO-8601 duration**: `PT6H`, `PT90M`, `P1D`. This is the point — changing the schedule again
  is a config edit, never a code change.

Two guards that did not exist:

- an **unrecognised value falls back to `daily`**, the cheapest named schedule, not `hourly`. A typo
  can no longer buy 24× the quota;
- anything **faster than one minute** is refused as a mistake. `PT1S` would spend a month in twenty.

## 3. The real fix: the service says what it is doing

This whole audit happened because two places disagreed for eight weeks and nothing said so. The jar
running in production was built on **3 January 2026** and its own `application.yml` says
`frequency: hourly`; the box runs `daily` from a systemd override added on 27 July. Both were
"right" and neither was readable.

`/healthcheck`'s `scheduler` block now carries, beside the unchanged `frequency`:

| field | what it answers |
|:--|:--|
| `interval` | the resolved schedule, e.g. `PT6H` — what the scheduler is *really* on |
| `interval_seconds` | the same, for arithmetic |
| `fetches_per_month` | what it costs against the keys' quota, at 31 days |
| `frequency_recognised` | **false** when the configured word was not understood and it fell back |

`frequency` itself is untouched, so every existing reader keeps working.

**The backend reads `fetches_per_month` instead of re-deriving it** (`ExchangeRatesAdminService`).
It had its own `when ("hourly"/"daily")`, so the first non-word schedule would have made the Health
Centre's quota check go *quiet* — showing a blank where the safety net used to be. That is the July
failure again, wearing a quieter coat. `frequency_recognised = false` now raises its own warning on
the card.

## 4. Where the schedule is written, and what each will read

| | before | after this change lands |
|:--|:--|:--|
| `src/main/resources/application.yml` (in the jar) | `hourly` — **stale since January** | `every-6-hours` |
| `/etc/systemd/system/exchange-rates.service.d/override.conf` | `EXCHANGE_FETCH_FREQUENCY=daily` | `EXCHANGE_FETCH_FREQUENCY=every-6-hours` |
| what the service runs on | daily (the env wins) | **every 6 hours**, from both, agreeing |

The env override is **kept, not deleted**: it is the way to slow the service down in an emergency
without a rebuild. What makes it safe now is that `/healthcheck` reports the resolved interval, so a
future disagreement is visible in one call instead of after a month of stale rates. The yml carries
a comment naming the override file, and the override carries one naming the yml.

## 5. What a redeploy ships — measured, and it is small

This was the real worry, and it is unfounded. The running jar is from 3 January; the repo's default
branch is `main`.

- **Commits since the running jar: one.** `35a1d5f`, 27 July, and it touches **one file**,
  `application.yml` — `frequency` and the jitter ranges. Nothing else in the repo has moved since
  `771b67d` on 3 January, which is the commit the jar was built from (its bundled `application.yml`
  is byte-for-byte the pre-fix one: `hourly`, jitter `0/0`).
- So a redeploy ships **that one config commit plus this branch**. There are no months of unreviewed
  code. Any Kotlin difference between the jar and `main` would be a build-environment difference,
  not a change anybody wrote.

**Jitter.** The audit was right: the repo's jitter fix is on `main` but the *running jar* has
`0/0`, because the override only sets the frequency. After the redeploy the service uses the
repo's **5–15 minutes plus 0–59 seconds**, as `/healthcheck` will confirm. One consequence worth
knowing: the jitter is slept *inside* the scheduled method and `fixedDelay` counts from when it
finishes, so real spacing is 6 h + jitter and drifts slowly. That is the intent — the alternative is
every instance asking the provider on the same second.

## 6. The credential — the priority finding

**The service's own password is the word `change_me`, and it works.** A wrong token gives 401; that
word gives 200. It is in three places:

| where | what it is |
|:--|:--|
| the box | `INTERNAL_TOKEN=change_me` in `/home/invotick-excahnge/htdocs/excahnge.invotick.com/.env` |
| the Android + iOS app | a **hardcoded string literal** in `core/exchange-rate/.../ExchangeRateApi.kt` — it ships inside every APK and IPA, and anyone can read it out |
| the backend | `exchange.rates.token=${EXCHANGE_RATES_TOKEN:change_me}` in `application.properties`, and the container sets **no** `EXCHANGE_RATES_TOKEN`, so it is running on the default |

**What it protects.** Everything under `/internal/` on `excahnge.invotick.com`:
`GET /internal/rates/latest`, `GET /internal/rates/history`, and — this is the one that matters —
**`POST /internal/api-keys`, which inserts a provider API key** (name, key, monthly quota, status)
into the service's database.

**What an outsider could do with it.** Reading the rates is worth little. Writing a key is worth a
lot: the rotation picks ACTIVE keys in turn, so a planted key makes fetches fail, and then every
converted figure in the product freezes at its last snapshot — and the last time that happened it
went unnoticed for sixteen days. There is no delete endpoint, so removing a planted row means going
into the database. This is a **G3** problem: it does not look like an attack, it looks like the
numbers being wrong.

**Second finding, same service: `/healthcheck` needs no token at all.** `SecurityConfig` lets it
through, and `https://excahnge.invotick.com/healthcheck` answers 200 to anybody. It hands out the
provider's name, the key ids, each key's quota and usage, the last error, snapshot ids and the
uptime — a free map of the service and of exactly how much quota is left to burn.

### ⚠️ Correction — my first reading of this was wrong

I wrote that rotating the token would cost nothing visible, because "nothing in the app reads the
rates table". **That was wrong, and it reached the owner before it was caught.** I had grepped
`composeApp`, `data` and `core` — and not `domain`, which is exactly where the reading lives:

- `domain/.../usecase/InvoiceUseCases.kt` → `GetAllInvoicesWithSummaries` converts through
  `ExchangeRateRepository` for the **summary** figures (Total Revenue / Outstanding / Overdue),
  whenever the set actually mixes currencies. `GetExchangeRate` and `ObserveExchangeRateUpdates`
  are there too, and `EstimateUseCases` reads the same repository.
- `ExchangeRateRefresher`'s own comment records the incident: until 2026-09-13 no iPhone fetched a
  rate at all, the table stayed empty, every conversion fell back to face value, and **the owner's
  dashboard added a $640,000 invoice to a Rs62,500 one as Rs702,500.**

So rotating the shared word **would** freeze every shipped build's rates at whatever it last
stored — or, on a fresh install, at the seeded table stamped `2025-12-31T17:00:00Z` — silently,
and the multi-currency totals would drift. The lesson is the file's own rule: check the calling
code before the claim leaves the room.

### The decision: split the credential, do not rotate it

**Owner, 2026-09-20, after the corrected picture:** protect the dangerous surface with a **new**
secret that is never shipped in the app, and leave the read path on the existing word so old builds
keep refreshing.

| | secret | opens | shipped in the app? |
|:--|:--|:--|:--|
| reading | `INTERNAL_TOKEN` (unchanged, still `change_me`) | `GET /internal/rates/latest`, `/internal/rates/history`, the detailed `/healthcheck` | **yes**, every APK and IPA |
| writing | **`INTERNAL_ADMIN_TOKEN` (new)** | `POST /internal/api-keys` | **never** |

Rules the code now holds, each with a test:

- the app's word **never** carries the admin role, so it cannot write a key;
- the admin word opens the reading doors too, so operating the service does not need two headers;
- **unset admin word closes the write door**, it does not open it, and it never falls back to the
  app's word. The service still boots, because a restart must not be blocked by a missing value;
- tokens are compared with `MessageDigest.isEqual`, not `==`, so a word guarding a write no longer
  leaks its length and matching prefix to anyone willing to time the answers;
- the backend is the only caller of the write endpoint (the admin panel's "Add key"), so it carries
  `EXCHANGE_RATES_ADMIN_TOKEN`, **with no default**. Unset, the button refuses with a message naming
  the missing value.

### What `/healthcheck` says to whom

It still answers **without a token**, because monitoring has to be able to ask whether the service is
alive. What it says to a stranger is now four things:

**stays public:** `status`, `time`, `fetch.data_age_minutes`, `fetch.stale`.

**moves behind the token:** `request_id`; the whole `app` block (`started_at`, `uptime_seconds`,
`active_profiles`); the whole `scheduler` block (frequency, interval, `fetches_per_month`,
`frequency_recognised`, jitter); the whole `provider` block (name, **base URL**, latest endpoint,
timeout); `fetch.last_fetch_at`, `fetch.last_snapshot_id`, `fetch.last_api_key_id`,
`fetch.last_error`, `fetch.last_error_at`; the whole `database` block (row counts, history range);
and the whole `api_usage` block — **window, total requests, and every key's id, provider, status,
quota, request count, usage percent and last-used time**. Plus the new
`admin_token_configured`, so "the write door is closed because nobody set a value" is visible
rather than discovered when somebody presses the button.

**What had to change so monitoring keeps working: nothing.** The backend already sends
`X-Internal-Token` on its healthcheck call (`ExchangeRatesAdminService.fetchHealth`), so the Health
Centre card and the admin panel's Exchange rates page read exactly what they read before.

**What does change:** `/healthcheck.html` and `/healthcheck/dashboard` are the detailed body in a
browser, and a browser cannot send a header. They now require the token and will refuse in a
browser. Nothing was deleted; the drill-down that replaces them is the admin panel's **Exchange
rates** page, which goes through the backend and its own sign-in.

### What still carries `change_me` after this lands, and until when

`INTERNAL_TOKEN` — on the box, in the backend's default, and inside every shipped Android and iOS
build. After the split that word can do exactly two things: **read the rate table**, and **read the
detailed healthcheck**. It can no longer write a key, which was the whole of the damage.

It disappears when **the app stops calling the rates service and reads rates through the backend**,
which already holds them (`ExchangeRateService`) and already authenticates the caller — targeted at
**1.4.8**. Until then a shipped build must keep working, so the word stays. Putting a *different*
word in the APK would buy rotation, not secrecy; it is still extractable.

## 7. Rejected

- **Hourly.** Affordable now (25% of quota), but it is churn: a total should not move because the
  rate moved at 3pm. Rejected on the owner's own framing of the question.
- **Keeping `daily`.** The owner asked for four times a day; and 6 hours is the useful half of the
  argument — the freshness, not the bill.
- **Adding `every-6-hours` as a third hardcoded word and stopping there.** That is the same shape of
  bug: the fourth schedule would need another release. The duration parser is the fix.
- **Deleting the systemd override so the yml is the only source.** It would make divergence
  impossible, but it also removes the only way to slow the service down without a rebuild. Kept,
  with the healthcheck now making any divergence visible.
- **Keeping `hourly` as the fallback for an unrecognised value.** That fallback *is* the July
  outage.
- **Recomputing the schedule's cost in the backend from the word.** It goes blind on the first
  schedule it does not know, and blind reads as fine.
- **Rotating the token in the same sitting as the app release.** Separated deliberately: the server
  and backend fix is free and costs nothing user-visible, and it should not wait for a release.
- **Rotating the shared token.** Rejected by the owner once the corrected picture was in front of
  him: it freezes every shipped build's rates and drifts the mixed-currency totals silently. Split
  instead.
- **Letting an unset admin secret fall back to the app's word.** That is the split undone in one
  line, and it would fail open on the day somebody forgot a value.
- **Refusing to boot without an admin secret.** Safer in one way, but it turns a missing value into
  an outage on the next restart. Closed door plus a visible fact is the better trade.
- **A query parameter so the browser dashboard keeps working.** Secrets do not go in URLs — nginx
  writes them straight into the access log.
- **Inventing the secret here.** The owner sets it; it is never written by me and never appears in a
  commit, a chat or this file.

## 8. Consequences

- **Deploy order: backend first, then the rates service.** Backwards is harmless; the other way
  round, the Health Centre's quota check is blind until the backend catches up. Same lesson as the
  analytics version gate.
- A restart of `exchange-rates.service` is roughly **20–40 seconds** of the service being
  unreachable. Nothing user-visible depends on that window — the backend keeps its last good rates
  in memory and the app fetches on its own daily schedule — but the Health Centre's
  *exchange-rates* card will report it unreachable for one poll, so a Slack alert in that minute is
  expected, not news.
- The scheduler's clock restarts with the process, so the first fetch after a restart happens at
  once (plus jitter), costing one extra request.
- `frequency_recognised` must stay in the healthcheck. It is the only thing standing between here
  and another eight weeks of two files disagreeing.
- The app's `ExchangeRateApi` is now on the list of things that must change before the next release
  that touches currency.

## 9. Branches (pushed, nothing deployed)

| repo | branch | commit |
|:--|:--|:--|
| `invotick-exchange` | `feat/fetch-every-six-hours` | `b0360d0` — 9 tests, red first |
| `invotick-apis` | `feat/schedule-cost-comes-from-the-service` | `cae1c4b` — compiles; no test exists for this service, and the `SpringContextBootTest` gate was not run. **Deploying; `stage` becomes `cae1c4b` when it lands** |
| `invotick-exchange` | `feat/the-key-writing-door-gets-its-own-key` (on top of `b0360d0`) | **`1850131`** — the credential split + the healthcheck split. 20 tests green, 11 new and red first |
| `invotick-apis` | `feat/the-rates-admin-call-carries-the-admin-secret` (on top of `cae1c4b`) | **`025b3d0`** — the admin word on the one write call. Compiles; gate not run |
