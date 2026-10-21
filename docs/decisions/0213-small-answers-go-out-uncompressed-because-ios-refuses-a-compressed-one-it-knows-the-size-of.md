# 0213 — Answers under 2 KB go out uncompressed (iOS refused the compressed ones)

**Date:** 2026-10-13 · **Decided by:** owner asked for the iOS sign-in to work; the fix is the agent's.

## What happened
On iOS (TestFlight 1.0.1 builds 30, 31, 32) every e-mail + password sign-in showed "Couldn't sign you in" although the server
answered 200. The simulator console named it: `IllegalStateException: Content-Length mismatch: expected 718 bytes, but received
1052 bytes`. Ktor's Darwin engine compares the length it was told (the compressed size) with the body NSURLSession hands over
(already decompressed). Android (OkHttp) does not do this check. The login answer is ~1052 bytes, which Caddy's `encode zstd gzip`
(default minimum 512 bytes) compressed to ~720.

## Decision
`encode zstd gzip { minimum_length 2048 }` in the shared `(invotick_api)` block of `/srv/edge/Caddyfile` on the new server.
Answers under 2 KB go out plain with their own length; larger ones still compress. Costs a few hundred bytes on small answers.
Fixes every iOS build already out, with no app release.

## Rejected
- *Persist the account copy best-effort* (built first, it did not help: the throw was earlier). Kept, harmless.
- *`Accept-Encoding: identity` for every iOS request* — would send sync pulls uncompressed; needs an app release.
- *Force-quit / closed database theory* — disproved by a cold start that failed the same way.

## Follow-up
Confirm sync and other small answers on iOS stay healthy (they were not failing before). The app should stop depending on this
(Ktor upgrade or an engine setting) — 1.5.3 list. Backup: `/srv/edge/Caddyfile.before-min-length-2026-10-13`.
