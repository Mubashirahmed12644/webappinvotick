# 0120 — The admin panel remembers every sign-in, machine by machine

- **Date:** 2026-09-20
- **Status:** decided by the owner on 2026-09-20: *"setting main login history rakho machine wise"*, and for the shape:
  *"bilkul jaisy google ky account main hoti hy"*. Built on branches. Not merged, not deployed.
  - Backend migration `feat/admin-devices-table` `dc42754`: `V20260920_01__admin_sign_in_history.sql`, plus the two
    lines that name the new tables to the guards that ask every table (as 0117's migration had to).
  - Backend code `feat/admin-devices` `49fc394`, on top of the migration. `AdminSignInHistoryTest` 9/9, red first by
    mutation. Full suite 1202/1202.
  - Panel `feat/admin-devices` `0fa1079` (on 0117's panel branch). tsc clean, `next build` green.
  - Deploy order: 0117's migration and code (deploying now) → 0118 `fix/auth-failure-counters-commit` `d968489` →
    this migration → this code → the panel.
- **Decision:** the panel's API Access page gets Google's two lists: **"Aap ke devices"** and **"Security activity"**.
  Failures are kept as well as successes, each machine is a card, and one machine can be signed out from another.
- **Related:** 0117 (passkeys, the same page) · 0118 (the counters, and the spoofable IP) · 0034 (a page costs what it
  shows) · 0119 (the trusted client IP) · storage, not RAM (standing rule).

## Context

- The owner cannot see who has been signing in to the panel, or trying to. 0118 made the wrong passwords and wrong
  codes *count*; nothing kept what happened, from where, or when.
- `user_sessions` has had `user_agent` and `device_info` columns all along, NULL on every production row, because
  nothing ever set them.

## Decided

**What is recorded.** One append-only line per event, for ADMIN accounts only: `sign_in`, `wrong_password`,
`wrong_code`, `locked`, `passkey_refused`, `passkey_added`, `passkey_removed`, `device_signed_out`. Each carries the
method (`password_code`, `password`, `passkey`), the machine, the label shown at the time, the User-Agent, the reported
IP, and whether it was that machine's first success.

- Never a password, a code, a challenge or a pass.
- An email that names no account is kept **only as a SHA-256 hash** — a stranger's typing is not ours to store, and the
  hash still groups repeats.
- An email that names an ordinary app account is skipped: the panel's sign-in is open to every email, and an app user's
  wrong password belongs to his own counters, not to this list.

**What a machine is.** A random 128-bit id the **server** gives the browser in an HttpOnly, Secure, SameSite=Lax
cookie, for two years.

- A cookie the server sets is what survives on the owner's iPhone, where the panel's own stored pass keeps being lost
  — the reason the passkey was built at all (0117).
- It is not a pass and opens nothing. It groups lines and says which sessions to end, so a caller sending someone
  else's key gains nothing.
- The label comes from the User-Agent ("iPhone · Safari", "Mac · Chrome"), or from the passkey's own name when a
  passkey signed in. Vercel's `/backend` rewrite passes the browser's User-Agent through.

**Signing one machine out.** Every live pass of this account whose `user_sessions.device_key` is that machine is
revoked (`revoked_tokens` + `is_active = false`), so its next request is answered 401. A renewed pass keeps its
machine, or it would slip out of its own device after a renewal. The machine asking cannot sign itself out (400) —
that is the sign-out button.

**Reading.** Every read is the caller's own account's, taken from the pass and never from the request:
`/v2/auth/admin-security/devices`, `/devices/{key}/events`, `/activity`, `/settings`, all `@RequireRole(ADMIN)`, so
only a pass from the admin sign-in opens them. Paged, date-ranged, index-walking; the per-machine counts are counted in
SQL (0034).

**Retention.** 180 days, deleted daily by `AdminSignInHistoryPurge`, along with any machine not seen inside that
window.

**The new-device email.** On by default, switchable on the page (`admin_security_settings`). It carries no code and no
link that signs anybody in — a mail that can be acted on is a mail worth faking. It names the device, the time, the
approximate place and the reported IP, and says to sign that device out from the panel.

**The IP.** Read through **one** helper, `ReportedClientIp`, labelled "reported" wherever it is shown, and used for
nothing else. The header is spoofable today (0118's open finding: nginx `set_real_ip_from 0.0.0.0/0`, proven with
`203.0.113.77`). When the trusted resolver `ClientIp` lands — another agent, panel branch
`feat/panel-forwards-client-ip`, decision [0119](0119-one-place-decides-which-address-a-request-came-from.md) — that one class delegates to it and nothing above changes, because nothing else in
this feature reads a header.

## Rejected

- **A new sidebar page.** The owner asked for it inside the settings he already opens; health and access pages have
  taught us that a page of its own is a page nobody opens (`memory/health-centre.md`).
- **A device id the panel makes and stores in the browser** (`localStorage`). That is exactly the store the owner's
  iPhone keeps losing, and a lost id means a new machine and a needless "new device" email every time.
- **Grouping machines by the User-Agent alone.** Two Macs on the same Chrome are one card, and a browser update makes
  a new machine.
- **Grouping by IP.** Spoofable, shared by everyone behind one mobile network, and different every few hours.
- **Fetching a place for every line as the page loads.** The IP lookup is paid; the page reads only what `ip_records`
  already holds, so a machine whose IP was never looked up says "maloom nahi".
- **Keeping the typed email of an attempt that names no account.** The hash answers the only question the list asks.

## What a real user could notice

- Admins only. Nothing about the app or its users changes.
- The panel asks for nothing new: the machine's id arrives in a cookie the server sets on the sign-in itself.
- The first sign-in after this ships is a "new device" for every machine, so the owner gets one email per machine he
  uses — once.
- A machine signed out is signed out for good: its pass is revoked, not merely hidden.
- The place shown is approximate, and will be missing for an IP nobody has looked up before.
