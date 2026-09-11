# 0050 — Every sync failure carries its own evidence, joined by one request id

**Status:** decided (owner, 2026-09-11: *"tracing ka aik solid jaal bichao jo apny sath sari detail
information ly ker aye taky andazoon ky bajaye evidence ky sath fixation ker sakin"*); telemetry
reviewed by the event owner the same day (changes folded in below); being built ·
**Date:** 2026-09-11 · **Goals:** G3 (trust — data that silently fails to sync), engineering ·
**Related:** [0029](0029-a-sync-failure-is-an-attempt-the-server-refused.md),
[0042](0042-the-server-owns-the-version-and-the-device-merges.md)

## What happened

The owner asked for a net that brings the whole picture of every sync failure, so defects are fixed
from evidence instead of guesses. A read-only map of app → report → table → panel and
server → response → log (2026-09-11) found five breaks.

1. **Nothing joins one failure's three records.** The three are:
   - the app's `sync_failed` event;
   - the server's `sync_failure` row;
   - the server's log line.

   The server makes a `traceId` per request (`MdcRequestFilter`), but it never leaves the server. On
   push, `SyncV2Controller` replaces it with a second id of its own.
2. **The app sends almost nothing.** It sends `stage`, a `reason` of at most 200 characters, and
   `attempts`. It drops:
   - the HTTP status;
   - the server's `errorType` (on most stages);
   - the record id, and the local and server versions;
   - the exception class;
   - the batch size, and which phase of the sync run failed.
3. **Some failures are never reported at all:**
   - a failed invoice INSERT on pull, swallowed inside the path that reports `pull_apply`;
   - image upload and download;
   - a failed reconcile request;
   - a failed WorkManager worker;
   - a missing invoice-item row while gathering a push;
   - unknown statuses in five result groups.
4. **The ingest throws away what does arrive.** `DeviceSyncFailureIngest` keeps only the user, the
   stage (in `entity_type`), a class guessed with `LIKE`, the newest reason and a count.
   - It drops the device id, version code and record id. The Device sync card needs a version code
     ≥ 94, so device-reported rows can never turn it red.
   - The count is taken from whichever app-version group happens to be processed last.
   - A row marked resolved never reopens: `:87` overwrites `lastSeenAt` before `:92` compares
     against it.
5. **Server logs cannot be searched.** promtail makes `traceId` and `userId` Loki labels. That made
   643k streams, and Loki drops lines at its stream limit. Every deploy copies that config back to
   the server.

**Found by the review:** the analytics version floor refuses every non-web batch whose
`appVersionCode` is below 91 (`AnalyticsVersionGate.kt:55`), and iOS sends its build number (15).
Every iOS event, sync or not, is answered 200 and stored nowhere. iOS is not live, but its TestFlight
testers are measured as zero.

## Decision

1. **One request id, end to end.**
   - The app makes a UUID for every sync HTTP call (push, pull, reconcile, image upload and download)
     and sends it as `X-Request-Id`.
   - The server's `MdcRequestFilter` adopts a well-formed incoming id (`^[A-Za-z0-9-]{8,64}$`) as its
     `traceId`, or makes one itself.
   - The server returns it as the `X-Request-Id` response header on **every** response, including
     401/403/503 from filters and 500 from the catch-all.
   - `SyncV2Controller` stops minting its own `requestId` and logs the MDC `traceId` instead.
2. **The app's report carries the evidence, as parameters on the existing `sync_failed`** (no new
   event, AGENTS-EVENTS §1.1). The parameters:

   | Parameter | Value |
   |---|---|
   | `request_id` | the call's `X-Request-Id` (the response's, when it came back) |
   | `http_status` | when a response arrived; never `0` for "no response" — leave it absent |
   | `error_type` | the server's `SyncErrorType`, verbatim; the device never invents one |
   | `entity` | the server's result-group name (`clients`, `invoices`, `invoiceItems`, …); `_request` for a whole request, the server's own convention |
   | `op` | `CREATE` / `UPDATE` / `DELETE`, as the server names them; absent for pulls and whole requests (a direction is not an operation) |
   | `field` | the server's `data.field`, so a field-level refusal meets its backend row |
   | `record_id` | the record's id |
   | `local_version`, `server_version` | the versions each side held |
   | `exception_class` | the simple class name — release builds keep them with `-keepnames class * extends java.lang.Throwable` |
   | `batch_size` | records in the push |
   | `run` | the phase: `push`, `pull`, `push_after_images`, `reconcile`, `image_upload`, `image_download` |
   | `queue_age_ms` | how long the operation waited in the queue |

   - Only ids, codes, versions and class names are sent — never field values (names, amounts,
     emails).
   - `reason` stays, at most 200 characters.
   - An absent parameter means "not applicable at this stage". The table below says which stage
     carries which (§1.7).
   - Every parameter is stored as a string, so queries CAST before comparing versions or statuses.
3. **The unreported paths are reported, each once, on a stage that says what failed:**
   - a failed invoice INSERT on pull → **`pull_apply`** with `entity=invoices`, `op=CREATE`. Not a new
     stage: the path already reports `pull_apply`, it only swallowed this case;
   - **`image_upload`**, **`image_download`**, **`reconcile_failed`** — final failures only, not every
     `Result.retry()`;
   - **`worker_failed`** — only for an exception no other stage reported, at `Result.failure()`. The
     worker usually sees the same exception `push_failed` already reported, and one failure must not
     become two events;
   - **`push_gather`** for the missing invoice-item row, and **`push_unknown_status`** for the five
     groups that skipped it — once per record (0029).

   Which parameters each stage carries:

   | Stage | request_id | http_status | error_type | entity | op | field | record_id | versions | exception_class | batch_size | run | queue_age_ms |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | `push_failed` | ✓ | when answered | — | `_request` | — | — | — | — | ✓ | ✓ | ✓ | — |
   | `pull_failed` | ✓ | when answered | — | `_request` | — | — | — | — | ✓ | — | `pull` | — |
   | `push_non_retryable`, `queue_repeated_failure`, `queue_quarantine` | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
   | `push_stale_divergence` | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ |
   | `push_unknown_status` | ✓ | — | — | ✓ | ✓ | — | ✓ | — | — | — | ✓ | — |
   | `push_gather` | — | — | — | ✓ | ✓ | — | ✓ | local | ✓ | — | ✓ | — |
   | `pull_apply` | ✓ | — | — | ✓ | CREATE / UPDATE | — | ✓ | ✓ | ✓ | — | `pull` | — |
   | `image_upload`, `image_download` | ✓ | when answered | — | — | — | — | ✓ | — | ✓ | — | ✓ | — |
   | `reconcile_failed` | ✓ | when answered | — | `_request` | — | — | — | — | ✓ | — | `reconcile` | — |
   | `worker_failed` | — | — | — | — | — | — | — | — | ✓ | — | — | — |

   Stages not in the table keep what they send today.
4. **The server keeps the evidence.**
   - `sync_failure` gains six nullable columns:
     - `last_trace_id VARCHAR(64)`;
     - `last_http_status INT`;
     - `last_exception VARCHAR(120)`;
     - `last_local_version BIGINT`;
     - `last_server_version BIGINT`;
     - `app_stage VARCHAR(40)` — the app's stage, which `entity_type` held until now.

     The Flyway migration is additive and deploys one release before the code that uses it.
   - `SyncFailureRecorder` writes the trace id and the new fields. On every occurrence it moves
     `app_version_code` and `device_id` to the latest one; until now they were frozen at the first.
   - `DeviceSyncFailureIngest`, when the new parameters are present:
     - takes the device id from `app_instance_id`, plus `app_version_code`, `record_id`, `field`,
       `error_type` and `entity`, instead of the `LIKE` class;
     - puts the stage in `app_stage`;
     - builds the signature from entity + field + errorType, the same as backend rows, so one refusal
       seen from both sides lands under **one** signature;
     - **computes** each row's count in SQL as its occurrences in the 30-day window, grouped by the
       row's own key. That is idempotent across the hourly runs. Adding counts run over run would
       re-add the same 30 days every hour;
     - reopens a resolved row when an occurrence arrives after it was resolved, comparing before
       overwriting `last_seen`.

     Rows without the new parameters keep today's behaviour, because old builds still send them.
   - `SyncFailureCheck` counts device-reported rows once they carry a version code.
   - **The analytics version floor applies to Android only.** It exists because Android builds up to
     90 carried event work that was ruled unacceptable (AGENTS-EVENTS §3.11). Web was already exempt;
     iOS builds all come from the current codebase, so iOS is exempt too.
5. **Logs can be searched by id.**
   - promtail keeps only low-cardinality labels (`level`, job or container).
   - `traceId` and `userId` stay inside the JSON line and are queried as `| json | traceId="…"`.
   - Fixed in the repo copy, which is the one every deploy copies (`.gitlab-ci.yml`).
6. **One place to read a failure: the panel.**
   - The Sync Health drill-down shows, per occurrence: device, app version and code, stage, request id,
     HTTP status, error type, entity, op and field, record id, local and server version, exception
     class, and first and last seen. It adds a version column and filter, which the API already
     returns.
   - A new admin-only endpoint, `GET /v1/webpanel/sync-health/trace/{requestId}`, returns the server's
     log lines for that id from Loki: within ±15 minutes of the row's `last_seen`, at most 200 lines,
     with tokens redacted. The drill-down shows them under the occurrence.
   - Later, in Event detail: show id-like keys (`request_id`, `record_id`) as a distinct count, not as
     200 values of 1. Event detail also keeps only the first 30 keys, which today drops keys that only
     some stages carry.

## Contract — what the three sides build against

| Item | Value |
|---|---|
| Header | `X-Request-Id` on the request (app) and the response (server, every status) |
| App → `sync_failed` parameters | Decision 2's table; all strings |
| Entity vocabulary | the server's push-result group names; `_request` for a whole request; the app maps its internal names onto them |
| Op vocabulary | `CREATE` / `UPDATE` / `DELETE` |
| `sync_failure` new columns | `last_trace_id`, `last_http_status`, `last_exception`, `last_local_version`, `last_server_version`, `app_stage` |
| Occurrence JSON (panel) | adds `requestId`, `httpStatus`, `exception`, `localVersion`, `serverVersion`, `appVersionCode`, `appStage` |
| Trace endpoint | `GET /v1/webpanel/sync-health/trace/{requestId}` → `{ requestId, lines: [{ ts, level, message }], truncated }`, ADMIN |

## Rejected

- **Full request and response bodies in the report.** They carry customers' data (names, amounts)
  into analytics, and every failed push would store kilobytes. Ids, versions and codes identify the
  record, and the server already logs the full record — one request id away.
- **A new `sync_trace` event or table.** The evidence belongs on the event that already names the
  failure (§1.1) and on the row that already groups it.
- **A `pull_insert` stage.** It is `pull_apply` with the failure no longer swallowed.
- **`push1` / `push2` and `worker` as run values.** They are counts and triggers, not phases (§1.14).
- **Keeping `traceId` as a Loki label and raising the stream limit.** That label is unbounded by
  construction, so a higher limit would only be hit again later.
- **The app sending the server's copy of the record.** The server has it; the request id finds it.

## Consequences

- Builds up to 1.4.4 keep sending the old shape, and their rows keep today's classification. Evidence
  starts with the next release, 1.4.5.
- Deploy order:
  1. the backend migration;
  2. the backend code, the version-floor change and the promtail fix;
  3. the panel;
  4. the app, in the next release.
- Cost: about a dozen small parameters per failure event, six small columns per `sync_failure` row.
  Loki's volume does not change, and its labels shrink.
- Event checklist (AGENTS-EVENTS §6):
  - the decision it changes: which sync defect to fix, and whether a fix worked;
  - it is an existing event plus parameters;
  - it goes through the coded channel, which always sends;
  - same id;
  - the gateway already stamps the screen.
- When it ships, add to AGENTS.md §5b and to AGENTS-EVENTS.md §1.18 ("an id on an event is a join
  key, not a dimension") the texts the event owner drafted in their 2026-09-11 review.
