# 0131 — The live stream says it is not compressed

- **Date:** 2026-09-20
- **Status:** built. `invotick-apis` branch `fix/live-stream-is-never-compressed` (`ded2bce`, off
  `stage` `895fec1`). **Not deployed.** No migration.
- **Found while verifying decision 0132. It is not the bug that decision fixes.**

## Decision

The live-now stream answers **`Content-Encoding: identity`**, alongside the `X-Accel-Buffering: no`
and `Cache-Control: no-transform` it already sent.

## Why

A compressor holds bytes until it has a block worth emitting. This stream sends a few hundred bytes
every couple of seconds, which is far below any compressor's flush threshold. The result is the
worst shape a failure can take: **the browser receives the response headers, believes it is
connected, and then receives nothing at all** — while the page's own indicator stays green, because
the indicator is set when the headers arrive.

Reproduced on 2026-09-20 through a proxy that answered `Content-Encoding: gzip`:

| | frames read in 8 s | the page's indicator |
|:--|--:|:--|
| `Content-Encoding: gzip` | **0** | "live" |
| `Content-Encoding: identity` | every frame; the list row appeared in **33 ms** | "live" |

**Production does not compress this route today** — which is exactly why the owner's header could
say "5 live" at all. So this was not his bug. It is one proxy setting away from being one, on a path
that already has two proxies (Vercel's `/backend` rewrite and nginx), and it costs one header to
remove.

`Cache-Control: no-transform` is supposed to forbid this. It is not honoured widely enough to rely
on, so the response states its encoding as well. `identity` is the correct spelling of "no encoding
applied", and nginx's gzip module leaves a response that already declares a `Content-Encoding` alone.

## Rejected

- *Relying on `no-transform` alone.* Measured not to be enough: the proxy that produced the zero-frame
  reading was already being sent it.
- *Turning compression off at nginx for this path.* It would fix one of the two proxies, needs a VPS
  change, and would be undone by anyone tidying the config. The response saying what it is travels
  with the response.
- *Padding each message to force a flush.* Wasted bytes on every tick to work around a header.

## Cost

One header. `ALiveStreamIsNeverCompressedTest` holds all three headers. **1,244 tests, 0 failures**
(this branch adds 2, so `stage` at `895fec1` is 1,242 — the 1,238 I was given is a commit or two
stale).

## Open questions for the owner

1. None. It is one header and a test; ship it with 0132 or before it.
