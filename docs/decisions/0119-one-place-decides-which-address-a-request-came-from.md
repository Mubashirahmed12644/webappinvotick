# 0119 — One place decides which address a request came from

**Date:** 2026-09-20
**Status:** built on branch `fix/client-ip-trust` (rebased onto 0120's `feat/admin-devices`, 49fc394), not deployed. The nginx change is written here and **not
applied**.

## What was wrong

Every per-IP rule in the backend read `X-Forwarded-For` and took its first entry. That header is written by whoever
sends the request. nginx on the VPS made it worse: `set_real_ip_from 0.0.0.0/0` in `/etc/nginx/nginx.conf` tells
nginx to believe the `X-Real-IP` of **any** caller, so a request sent straight to `stage.invotick.com` carrying a
made-up address was logged, counted and stored under it (proven on 2026-09-20 with `203.0.113.77`).

What was riding on that address:

- the admin passkey's per-IP limit, 10 sign-in challenges per 5 minutes (decision 0117) — a caller writing a new
  address on every try had a fresh allowance each time, for ever;
- `users.lastLoginIp`, which the panel shows and the admin login history (0120) will show;
- `login_attempts` per-IP counts, the geo lookups behind the country on a user's row, and the short-link click log.

A per-IP lock was already rejected in decision 0118 for this reason ("every client IP is spoofable"). This is the
fix that closes it.

## What was decided

**One resolver, `dev.backend.infotick.config.ClientIpResolver`, decides the address. Nothing else reads a header.**
`ClientIpIsReadInOnePlaceTest` fails the build if any other file in `src/main` mentions `X-Forwarded-For`,
`X-Real-IP`, `Proxy-Client-IP`, `WL-Proxy-Client-IP`, `CF-Connecting-IP`, `.remoteAddr` or `getRemoteAddr(`.

It is deliberately short:

1. **The address nginx saw on the connection** — `X-Real-IP`, which nginx overwrites on every request it passes on.
   It is believed only when the connection itself comes from a loopback or private address, which is the only way
   nginx reaches the backend (the container publishes `127.0.0.1:8085` only).
2. **`remoteAddr`** otherwise.

`X-Forwarded-For` is never read again: every entry in it but nginx's own is whatever the caller wrote. A value that
is not an IP literal is dropped rather than looked up — a name there would have the server asking a DNS server of
the caller's choosing on every request.

`ReportedClientIp` (decision 0120, the admin devices / login history) was written as a seam for exactly this. On
this branch it takes the resolver and parses nothing itself, so the sign-in history's "reported IP" is the same
address as everything else — and still decides nothing.

## The owner's choice: no shared secret

A second step was built first and then removed: the panel and the web app, which sit on Vercel, would send the
address Vercel saw next to a shared secret (`CLIENT_IP_PROXY_SECRET`), and only that secret would make a forwarded
address believable. The owner rejected it on **2026-09-20** — *"cheezon ko mujhy mehfooz and simple rakhna hy"* —
after being told exactly what it buys and what it costs. It is recorded here so a later session does not propose it
again without knowing that.

**What the secret would have bought:** the *person's* address on calls that come through our own Vercel apps —
the admin panel's browser calls (`/backend/…`) and the web app's server-side calls. With it, the admin login
history would name the owner's own city, and a per-IP limit would count each panel user separately.

**What was accepted instead:** those two report **Vercel's** address.

- The admin login history's city for a panel sign-in is Vercel's region, not the owner's city. The device, the
  time and the account are unaffected.
- A per-IP limit applied to panel traffic counts all panel traffic together. The passkey's limit (0117) is the one
  in place today: 10 challenges per 5 minutes per address, with a global 300. Reached through the panel, that is a
  shared allowance for whoever is signing in from the panel at that moment — acceptable because the *account* lock
  (0118) is what actually stops a guesser, and the passkey is exempt from it by the owner's own rule.
- Nothing about safety rests on the address. This is what made "simple" the right trade rather than a cheap one.

**What is fixed either way, and is most of the traffic:** every call from the Android and iOS apps, every share
link opened in a browser, and every direct call reaches nginx itself. For all of those the address becomes the true
one, and nobody can write their own any more.

Two costs of the secret that the owner also weighed: a second secret to hold in two places and rotate, and a
header that is only as good as the last place it was copied to.

## What else was rejected

- **Trusting Vercel's IP ranges.** Vercel's outgoing addresses are shared by every Vercel customer, so "it came
  from Vercel" says nothing about whose app sent it.
- **Narrowing `set_real_ip_from` alone.** Same reason, and it would leave four different readings of the address in
  the code.
- **Per-controller fixes.** Four files read the address four ways; that is how it drifted.
- **A DNS lookup of a claimed value**, and **`InetAddress.getByName` on the raw string** — either one lets a caller
  make the server resolve a name it chose.

## What changed

**Backend** (`fix/client-ip-trust`, rebased onto `feat/admin-devices` 49fc394 — the order going to `stage` is
0117 → 0118 → 0120 tables → 0120 code → this):
`ClientIpResolver` + its two tests; `AuthController`, `AuthControllerV2`, `AdminPasskeyController` and
`ShortLinkController` lose their private helpers and take the resolver. No new configuration, no schema change.
`ReportedClientIp` (0120) becomes a one-line delegate. Full suite green on that base, 1,212 tests.

**Admin panel:** nothing. The branch `feat/panel-forwards-client-ip` that carried the proxy header was **deleted**
when the owner chose simplicity.

**Web app:** nothing, and nothing was needed: its backend calls are made server-side from Vercel and never
forwarded an address.

**nginx: written, not applied.** In each Invotick server block only (`stage`, `gw`, `go` — the same directory also
serves Jariya and Grafana, which are not touched):

```nginx
  # 0119: this server believes no caller's own X-Real-IP. Overriding the list here replaces the http-level one,
  # which is set_real_ip_from 0.0.0.0/0, for this server only.
  set_real_ip_from 127.0.0.1;
```

Then `$remote_addr` — and so the `X-Real-IP` nginx passes on, and the access log — is the address the connection
really came from.

## Deploy order (each step works on its own)

1. **Backend.** On its own it already stops `X-Forwarded-For` being believed, which is the forgery that needs no
   tools at all.
2. **nginx**, after it. Until this line is in, a forged `X-Real-IP` still gets through; after it, nothing does.

Backup, the change and the rollback are single commands in the report that accompanies this decision.
