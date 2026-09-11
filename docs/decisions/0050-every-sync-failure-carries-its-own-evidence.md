# 0050 — Every sync failure carries its own evidence, joined by one request id

**Status:** decided (owner, 2026-09-11: *"tracing ka aik solid jaal bichao jo apny sath sari detail
information ly ker aye taky andazoon ky bajaye evidence ky sath fixation ker sakin"*), being built ·
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
   - the batch size, and which kind of sync run it was.
3. **Some failures are never reported at all:**
   - a failed invoice INSERT on pull;
   - image upload and download;
   - a failed reconcile request;
   - a failed WorkManager worker;
   - a missing invoice-item row while gathering a push;
   - unknown statuses in five result groups.
4. **The ingest throws away what does arrive.** `DeviceSyncFailureIngest` keeps only the user, the
   stage, a class guessed with `LIKE`, the newest reason and a count.
   - It drops the device id, version code and record id. The Device sync card needs a version code
     ≥ 94, so device-reported rows can never turn it red.
   - It SETs the count instead of adding to it.
   - A row marked resolved never reopens (`DeviceSyncFailureIngest.kt:87/92`).
5. **Server logs cannot be searched.** promtail makes `traceId` and `userId` Loki labels. That made
   643k streams, and Loki drops lines at its stream limit. Every deploy copies that config back to
   the server.

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
   event, AGENTS-EVENTS §1.1).
   - Parameters: `request_id`, `http_status`, `error_type`, `entity`, `op`, `record_id`,
     `local_version`, `server_version`, `exception`, `batch_size`, `run`, `queue_age_s`. What each
     holds:
     - `error_type`: the server's enum, verbatim.
     - `entity`: the **server's** result-group name (`clients`, `invoices`, `invoiceItems`, …), so
       both sides share one vocabulary.
     - `op`: `create|update|delete|pull`.
     - `exception`: the simple class name only.
     - `run`: `push1|push2|pull|reconcile|image_up|image_down|worker`.
   - Only ids, codes, versions and class names are sent — never field values (names, amounts,
     emails).
   - `reason` stays, at most 200 characters. An absent parameter means unknown (§1.7).
   - The unreported paths are reported, each under a `stage`: `pull_insert`, `image_upload`,
     `image_download`, `reconcile_failed`, `worker_failed`, `push_gather` (missing item row), and
     `push_unknown_status` for all groups.
3. **The server keeps the evidence.**
   - `sync_failure` gains five nullable columns:
     - `last_trace_id VARCHAR(64)`;
     - `last_http_status INT`;
     - `last_exception VARCHAR(120)`;
     - `last_local_version BIGINT`;
     - `last_server_version BIGINT`.

     The Flyway migration is additive and deploys one release before the code that uses it.
   - `SyncFailureRecorder` writes the trace id and the new fields. On every occurrence it moves
     `app_version_code` and `device_id` to the latest one; until now they were frozen at the first.
   - `DeviceSyncFailureIngest`, when the new parameters are present:
     - takes the device id from `app_instance_id`, plus `app_version_code`, `record_id`,
       `error_type` and `entity`, instead of the `LIKE` class;
     - builds the signature from entity + field + errorType, the same as backend rows. One refusal
       seen from both sides then lands under **one** signature;
     - **adds** to counts;
     - reopens a resolved row when a new occurrence arrives.

     Rows without the new parameters keep today's behaviour, because old builds still send them.
   - `SyncFailureCheck` counts device-reported rows once they carry a version code.
4. **Logs can be searched by id.**
   - promtail keeps only low-cardinality labels (`level`, job or container).
   - `traceId` and `userId` stay inside the JSON line and are queried as `| json | traceId="…"`.
   - Fixed in the repo copy, which is the one every deploy copies (`.gitlab-ci.yml`).
5. **One place to read a failure: the panel.**
   - The Sync Health drill-down shows, per occurrence: device, app version and code, request id, HTTP
     status, error type, entity and op, record id, local and server version, exception, and first
     and last seen. It adds a version column and filter, which the API already returns.
   - A new admin-only endpoint, `GET /v1/webpanel/sync-health/trace/{requestId}`, returns the server's
     log lines for that id from Loki: within ±15 minutes of the row's `last_seen`, at most 200 lines,
     with tokens redacted. The drill-down shows them under the occurrence.

## Contract — what the three sides build against

| Item | Value |
|---|---|
| Header | `X-Request-Id` on the request (app) and the response (server, every status) |
| App → `sync_failed` parameters | the list in Decision 2; all strings (the gateway stringifies) |
| Entity vocabulary | the server's push-result group names; the app maps its internal names onto them |
| `sync_failure` new columns | `last_trace_id`, `last_http_status`, `last_exception`, `last_local_version`, `last_server_version` |
| Occurrence JSON (panel) | adds `requestId`, `httpStatus`, `exception`, `localVersion`, `serverVersion`, `appVersionCode` |
| Trace endpoint | `GET /v1/webpanel/sync-health/trace/{requestId}` → `{ requestId, lines: [{ ts, level, message }] , truncated }`, ADMIN |

## Rejected

- **Full request and response bodies in the report.** They carry customers' data (names, amounts)
  into analytics, and every failed push would store kilobytes. Ids, versions and codes identify the
  record, and the server already logs the full record — one request id away.
- **A new `sync_trace` event or table.** The evidence belongs on the event that already names the
  failure (§1.1) and on the row that already groups it.
- **Keeping `traceId` as a Loki label and raising the stream limit.** That label is unbounded by
  construction, so a higher limit would only be hit again later.
- **The app sending the server's copy of the record.** The server has it; the request id finds it.

## Consequences

- Builds up to 1.4.4 keep sending the old shape, and their rows keep today's classification. Evidence
  starts with the next release, 1.4.5.
- Deploy order:
  1. the backend migration;
  2. the backend code and the promtail fix;
  3. the panel;
  4. the app, in the next release.
- Cost: about ten small parameters per failure event, five small columns per `sync_failure` row.
  Loki's volume does not change, and its labels shrink.
- Event checklist (AGENTS-EVENTS §6):
  - the decision it changes: which sync defect to fix, and whether a fix worked;
  - it is an existing event plus parameters;
  - it goes through the coded channel, which always sends;
  - same id;
  - the gateway already stamps the screen.
