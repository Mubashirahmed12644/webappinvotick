# 0122 — Who is on the app right now is counted where the batch lands, and pushed

- **Date:** 2026-09-20
- **Status:** built. Backend `invotick-apis` branch `feat/live-now-stream` (`0fd4e3f`), panel
  `invotick-admin-panel` branch `feat/live-now-stream` (`711c11e`). **Not deployed.** No migration.
- **Asked for by the owner, 2026-09-20:** *"ye aik live user ki instant reporting page hy — isko fast
  banana ho to kia websocket wala way har lihaz sy behtar nhi hoga?"*

## Decision

**The Live Events "live now" section stops being a by-product of a thirty-day query. The server
keeps the live picture as batches arrive and pushes the change over Server-Sent Events, so a live
tick reads no table at all.** Everything else on the page — the thirty-day list, its totals, the
event feed — stays an ordinary bounded query on its own schedule, and the page says so.

The transport alone would have changed nothing. A WebSocket that asks the same thirty-day question
on every tick costs the same thirty-day question. What makes it cheap is that the server already
sees every batch arrive at `POST /v2/analytics/track`, so the fact is taken where it already passes
through instead of being read back out of `analytics_events`.

## Why

Measured on production on 2026-09-20 (decision 0121): the active-user read the page polled is
**5.0 s of server time and 671 MB read from disk**, and `USERS_POLL_MS` was **5,000**. With the tab
open on the default thirty-day range that is **12 reads a minute, one of the box's two MySQL cores
held at about 100 %, and ~134 MB/s of disk, continuously** — which is why Funnel Analysis crawled in
the next tab.

The derived count was also wrong in a second way nobody had noticed: it was
`activeUsers.filter(live).length` over a list the server caps at 200 rows, so a phone on the app but
outside the shown page was not in the count.

| with the page open, 30-day range | before | after |
|:--|--:|--:|
| reads a minute for the live count | 12 | **0** |
| reads a minute for the user list | 12 | 1 *(panel `1777492`, decision 0121)* |
| MySQL seconds a minute | ~60 | ~5 |
| disk read a minute | ~8.0 GB | ~0.67 GB |

## What is held in memory, and how much

Standing rule since 2026-09-13: what belongs on storage is never kept in memory, and every
long-lived holder is named with its size.

- **One small row per device** seen in the last **5 minutes** — id, user, build, platform, country,
  last arrival, a count. No events, no parameters, no history.
- **At most 1,000 entries of about 300 bytes → under 300 KB, always.**
- Sized against production: the **busiest five minutes of the last seven days held 27 distinct
  devices** (3,968 events); a normal five minutes holds 11. The cap is about **thirty-seven times
  the worst case ever observed**, and it exists so a bot or a retry storm cannot make this an
  unbounded map — not because 1,000 is expected.
- Over the cap the **oldest go first**, and `dropped` is returned, so the page can say the number is
  a floor. A cap that silently lowers a number is worse than no cap.
- This is not data that belongs on storage: it describes the last five minutes and is worthless five
  minutes later. `analytics_events` remains the record of what happened.

## A restart

`LiveNowSeeder` runs **one** bounded query on `ApplicationReadyEvent` — the devices with an event in
the last five minutes, a `created_at` range decision 0115 measured at 25 ms class, limited to what
the registry would hold — and then never asks again. Until it has run, `seeded` is false, so the
page can say *not counted yet* rather than *nobody is here*: those are different answers. A failure
there is logged and dropped.

## If a second backend instance ever runs

There is one today: one container on one box. A second would see only the batches its own copy
handled, so each would report a share of the truth and the panel would show whichever one it
reached. **The fix — a shared store, with this class keeping its shape and writing through — has to
be done before the second instance, not after**, because the failure mode is a number that still
looks plausible. It is written in the class, not only here.

## SSE, not WebSocket — the owner's question answered

| | WebSocket | SSE |
|:--|:--|:--|
| direction needed | two-way; we use one | one-way, which is what this is |
| Vercel `/backend` rewrite | a rewrite to another host does not carry a protocol upgrade, so the panel would have to leave the same-origin proxy that exists so blocked networks still work | ordinary HTTP, goes straight through |
| `@RequireRole(ADMIN)` + admin-sign-in pass | handshake sits outside `AuthorizationInterceptor`; needs an authorisation path of its own | applied exactly as on every other panel route |
| new server surface | Spring's WebSocket stack | none |

Through the two proxies, all measured or read on the box on 2026-09-20:

- nginx buffers a proxied response by default. `X-Accel-Buffering: no` turns it off **for this
  response only**, so no VPS configuration changes.
- nginx is `proxy_read_timeout 900`. The stream **ends itself after 10 minutes**, so a clean close
  and reconnection is the normal case rather than a broken read.
- a comment line every 20 s keeps it warm; **at most 16 streams open at once**, 503 above that,
  which the panel reads as "keep polling".
- **one scheduled loop serves every open stream**, not a thread each, and it sweeps the registry
  whether or not anybody is watching.

The panel reads the stream with `fetch` + `ReadableStream`, not `EventSource`: `EventSource` cannot
send the `Authorization` header, and the alternative would put the admin token in the URL — and so
in nginx's access log — on every reconnection. The header shows **live / live (poll) / rabta nahi**,
because a number that has stopped updating looks exactly like a number that is not changing.

## Rejected

- *A WebSocket.* See the table. It buys a return channel nobody uses and costs the proxy and the
  authorisation path.
- *Sending differences instead of whole snapshots.* The two ends would have to agree on what the
  other already holds, across a reconnection they cannot coordinate. The whole picture is a few
  hundred small rows — smaller than the argument.
- *Putting the token in the query string so `EventSource` could be used.* It would be written to the
  access log on every reconnection, for ever.
- *Counting a refused build's batch.* Builds at or below the version floor have their events dropped
  at ingestion, and a phone whose events nobody keeps must not appear as a live user.
- *Letting the live count keep coming from the user list as a fallback once the stream is seeded.*
  The two answer different questions and the list's is narrower; the page would have silently shown
  the smaller number as if it were the wider one.
- *Raising the proxy timeout so the stream could live longer.* Already rejected in 0115.

## A trap found on the way, now fixed

`build.gradle.kts` runs the test JVM with `-Duser.timezone=UTC`. Production runs the jar that way
and the CI runner is a UTC box, so both have always tested in UTC — a developer Mac had not. That is
not cosmetic: an entity timestamp is written through `InstantAttributeConverter` in explicit UTC,
while a native query binds and reads an `Instant` through the JDBC connection's own zone. On this
UTC+5 machine a row saved at `11:39Z` read back through a native query as `06:39Z`, so **every
real-database test of a `created_at` range was silently measuring a window five hours from the one
it asked for** — which is why the existing ones use windows days wide.

## Cost

1,229 backend tests, 0 failures (1,212 baseline + 17 here), including
`WebpanelReadsAreBoundedTest`, `AnalyticsPanelReadsTest` and `RoutesDeclareWhoMayCallThemTest`. No
migration, no app release, no VPS change.

## What this does NOT fix

**Only the live section.** "Pehli invoice ka safar" is still 17.1 s and "Muqabla" still 10.8 s on a
thirty-day range. Those need the structural work of decision 0121 — the buffer pool, the covering
index, the partitions — and its five questions are still open.

## Open questions for the owner

1. Deploy the backend branch and the panel branch together? The panel falls back to polling against
   a backend that does not have the route, so the order is not dangerous — but the gain only arrives
   with both.
