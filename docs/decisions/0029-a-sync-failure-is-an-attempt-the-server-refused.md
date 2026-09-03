# 0029 — A reported sync failure is an attempt the server refused

**Date:** 2026-09-04 · **Status:** decided, implemented in the app (`VC_93_VN_142` 3c993030), awaiting
release

## Context
30 days of 1.4.2: 17,167 `sync_failed` on 442 devices. ~2,300 were pushes and pulls started with no
network (`schedulePush()` fired on every local write with no network check, no coalescing); ~4,500 on
five devices were one stuck state reported again and again — the same record quarantined 301 times and
refused as non-retryable 1,503 times. Real refusals (Unauthorized 480, NOT NULL on apply 466, invalid
body 256) were buried.

## Decision
The owner's standard: **a failure is one the protocol actually attempted and the server, or a real
fault, refused.** Therefore:
- Offline is not a failure: a push request while offline is deferred and fires once on reconnect;
  `runSync` refuses to start offline; nothing is reported.
- A burst of writes is one push (2 s debounce).
- A stuck state is reported once: `queue_quarantine` once per item; `queue_stuck_backlog` only when the
  count changes.
- A quarantined record is not re-queued automatically: repair refuses parents with a terminal verdict
  and dedupes pending ones; timed revival climbs a longer ladder up to a lifetime ceiling, then stops.

## Rejected
- Filter the noise in the panel and leave the app as it was — the device would still be doing the
  work and the alert would still fire on it.
- Remove `queue_stuck_backlog` entirely — a device carrying stuck work must still be visible.

## Consequences
`sync_failed` counts drop sharply after release; the alert threshold in Grafana can then be set on real
refusals. One stale UPDATE still yields two reports (`push_stale_divergence` + `push_non_retryable`) —
open.
