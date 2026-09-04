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

---

## Addendum — 2026-09-05: the definition had a hole, and 814 rows were sitting in it

The owner asked the question this addendum answers: *"kahin aisa to nahi ke jis fail ko hum fix nahi
kar sakte usko bhi hum trigger kar rahe hain — sync offline mein to failed hi hoga na?"*

He was right. The table said so:

| source | rows | devices |
|---|---|---|
| APP | 2,082 | 0 (no device id) |
| BACKEND | 705 | 152 |
| RECONCILE | 49 | 6 |

**814 of those rows carried a network reason** — `Unable to resolve host`, `connect timeout`,
`Network connection failed`. A phone in a lift is not a defect. No change to our code turns a tunnel
into a network, and a card that goes red for tunnels is a card nobody reads on the night it means
something.

So the definition narrows to what we can act on. A sync failure is:

- an attempt the server **refused** (`BACKEND` — INVALID_REFERENCE, IMMUTABLE_RECORD, STALE_CONFLICT), or
- a count that proves a record **never arrived** (`RECONCILE` drift).

Everything else is stored, shown, and named on the card — **including the green card**, which until
now said "no unresolved failures" while quietly setting hundreds of rows aside. Green has to show its
working too; that silence is the same shape as the one that hid the September outage.

Not counted, each for its own reason:

1. **The device had no network** — its surroundings, not our code. 814 rows.
   (`VC_95_VN_143` stops the app reporting these at source, but builds already in the wild will keep
   sending them, so the server-side filter is what makes the card honest today.)
2. **Builds below the live one** — only an update fixes those. 1,160 rows.
3. **Devices whose clock runs ahead** — they never leave the window. 7 rows, 41k occurrences.

### Rejected

- **Raising the threshold instead.** That hides real defects along with the noise. The problem was
  never the count, it was that three different things were being added together.
- **Deleting network rows at ingest.** They answer a real question — "how often are our users
  offline when they try to sync?" — which matters for the offline-first design. Record everything;
  count narrowly.
- **Filtering on `source = APP` alone.** Convenient and wrong: the app also reports genuine refusals
  it observed locally. The cause is what disqualifies a row, not where it was recorded.

### Still open

A device that syncs after its account was deleted server-side would reconcile as drift and look like
data loss. Not filtered, because on the live build there is not a single such row — we add the filter
when the evidence exists, not before.

Code: `SyncFailureCheck.kt`, tests in `SyncFailureIsAServerRefusalTest.kt`. Live in `957c36ad`.
