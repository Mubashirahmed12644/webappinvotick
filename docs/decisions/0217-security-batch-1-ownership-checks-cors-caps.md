# 0217 — Security batch 1: ownership checks, CORS, response headers, and caps on what strangers can write

**Status:** built 2026-10-15, **Gradle not run, not pushed, not deployed.**
- Backend: `fix/security-batch1-2026-10-15` off `origin/stage` `24f836a` (worktree `kaam/worktrees/invotick-apis-sec1`).
- One migration, `V20261015_01__uploaded_file_owner.sql` (commit `3dc0a34`, first on the branch), which **ships alone, first**.
- No app release needed. No existing row is changed.

**Source:** the security assessment of 2026-10-15, `kaam/research/security-audit-2026-10-15.md` (findings F1, F2, F4,
F5, F-CORS-LOCALHOST, F-HEADERS-HSTS, F-ANALYTICS-DOS, F-UPLOAD-1, and A3's secret-in-logs half). Ordered by the owner
the same day. **Related:** 0034 (a page costs what it shows), 0045 (the web share page's analytics), 0053 (guest work
joins in one step), 0099 (a sign-in re-admits a removed phone), 0111 (account erase), sync rule 28.

**Out of scope, the owner decides separately:** F3 (guest secret), F-AUTH-SOCIAL (social-login linking), A1/A2/A4 and
A3's forged-voided half (billing refund logic), the Spring Boot upgrade, the login lockout.

## The rule every fix keeps

A legitimate owner's request behaves exactly as before, and every live build (1.4.x to 1.5.2) keeps syncing. Each
fix is server-side, judged before anything is written, and has a test written to fail on the old code.

## What was wrong, and what changed

| Finding | Was | Now | Commit |
|:--|:--|:--|:--|
| **F1** `/v2/sync/push` invoice-payment update | The one update of 21 with no owner check. An old copy was answered STALE_CONFLICT **with the owner's record** (userId, payment, invoice, amount); a newer copy **re-pointed the owner's link** onto the caller's invoice. | `assertOwnership` before `refuseRevival`/`checkNotStale`, like every other group. A link stored with no owner belongs to its invoice's owner, then its payment's. | `aadcf5f` |
| **F2** `/v1/sync/push` payments and invoice-payment links | "Create" is an upsert by a device-chosen id; the stored row's owner was never compared. Another account's payment could be rewritten and moved; a link's amount changed. A payment could name another account's payment method. | Skipped (this method's existing refusal: `null`, logged SKIPPED) before any field is touched when the stored row is another account's. A payment method must be the caller's or a shared default (v2's rule). | `b3617ab` |
| **F4** share create | No check that the caller owned `invoiceId` (which the public read hands out). A stranger could revoke the sender's unsent link and delete its preview, break the approval badge (403), or mint a permanent `invotick.com/i/` page with any snapshot. | 403 when the invoice/estimate is another account's. A document the server does not hold yet is let through (the pre-warm runs before the invoice's push). The reuse lookup and the badge read the **caller's own** share. Snapshot capped at 16 MiB of characters. | `f8a4ee9` |
| **F5** "Remove device" | Checked only against the `X-Device-Id` a call sends; a call without it went through. A removed phone, or anyone holding its pass, kept full access by leaving the header out (or naming another phone). | The first call that names a phone **ties the pass to that phone** (`user_sessions.device_info`, a column nothing had ever written), and the filter judges that phone on every later call too. Refused exactly as the removed phone's own sync is: 401 "This device was signed out." (handled by every build; `RemovedPhoneGate` from 1.4.6). A renewed pass inherits its phone. Fails open. | `a758c8c` |
| **F-CORS-LOCALHOST** | Production reflected `Origin: http://localhost:3000` with `Allow-Credentials: true`. | Origins are configuration. `security.cors.allowed-origins` holds our own sites; `security.cors.extra-origins` is empty in production and `http://localhost:3000` in the `local` and `dev` profiles. | `296db04` |
| **A3** (secret in logs) | Google's RTDN secret travels as `?token=`, and Caddy's access log redacts headers but not the URI: the secret is written in plain text on every delivery. Compared with `!=`. | The controller also accepts the secret in **`X-Play-Rtdn-Token`**; the query is still accepted. Constant-time comparison. One INFO line says which carrier was used. The Caddy log filter is below, **not applied**. | `c72a6a6` |
| **F-HEADERS-HSTS** | `nosniff` and `X-Frame-Options` present; no HSTS (Spring writes it only for a request that arrived over TLS, and Caddy hands every request on over plain http), no CSP, no Referrer-Policy. | Every answer: `Strict-Transport-Security: max-age=31536000 ; includeSubDomains`, `Referrer-Policy: no-referrer`, and a CSP from `security.headers.content-security-policy`: `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox` (blank in `local`, for Swagger UI). | `5b572be` |
| **F-ANALYTICS-DOS** | `/v1|v2/analytics/track` take no pass and had no bound: 500 events in one request were all stored, nothing stopped any size. | Body 2 MiB before anything reads it; 500 events per request and 32 KiB per event (413); per 10 minutes 30,000 events per address and 10,000 per phone (429). Judged before the service runs; a refused request stores nothing. | `1e29e27` |
| **F-UPLOAD-1** | Any signed-in caller stored any file: the extension was taken verbatim from the file name, the bytes never looked at, no owner recorded. A guest stored `evil.svg` and `evil.html`. | At most 20 files a call; each must be JPEG, PNG, WebP, GIF, HEIC/HEIF/AVIF or PDF **by its first bytes** (415); the account's uploads in 24 h within 500 files and 1 GiB (429); each stored file recorded under its account in `uploaded_file`. The caller's extension is kept when it names the same type, so every address looks as before. | `3dc0a34` (migration), `deab6f3` |

## How each cap was set (so no real traffic is refused)

A phone gives up on a refused analytics batch after about 30 seconds of retries (`AnalyticsFlusher`: 5 attempts,
backoff from 1 s), so a cap a real phone can reach loses real events. Read from `invoice-kmp-app` 1.4.0, 1.4.2, 1.4.4,
1.4.6, 1.5.1 and 1.5.2:

- **Analytics.** Every build sends at most 50 queue items per request (`BATCH_SIZE = 50`), each one event, so ≤ 50
  events; one flush sends at most 1,000 (`MAX_DRAIN_BATCHES = 20`). An event is about 1–2 KiB (~20 stamped parameters,
  the longest value capped at 200 characters by the app), so a request is about 100 KiB. Caps: 500 events (10×), 32 KiB
  an event, 2 MiB a body (20×). The fleet sends well under 1,000 events in 10 minutes; one phone at most 1,000 per
  flush. The per-address allowance (30,000) covers phones behind one carrier address and the web share page, whose
  events all arrive from Vercel's few addresses; it is not exempted, so `platform=Web` cannot be used to bypass it.
  **The all-zero device id has no phone budget** — every old iPhone drains its whole backlog under it. Decision 0045's
  version-gate exemptions are untouched.
- **Uploads.** Every build sends one image per call (`ImageSyncService.BATCH_SIZE = 1`), as JPEG, PNG or WebP (Android
  `ImageMetadata.mimeType`, seeders; iOS `UIImageJPEGRepresentation`). An account holds a handful of images; 34,321
  images were on disk for the whole user base after five months. Caps: 20 files a call, 500 files and 1 GiB per account
  per 24 h. The 10 MB per file is the existing multipart cap.
- **Share snapshot.** Up to six images as base64 WebP (photos 1,400 px, marks 800 px): a few MB at most. Cap 16 MiB,
  just under Jackson's own 20,000,000-character limit.

All of them are properties (`analytics.ingest.*`, `uploads.*`), so a wrong number is a configuration change, not a
release. Analytics refusals write one WARN line a minute per reason (`track refused`); upload refusals one per refusal
(`upload refused`).

## Rejected

- **F1:** taking ownership of an ownerless link on update (`existing.user = user`, as the audit suggested). It would
  change what a legitimate owner's copy writes and the number it is answered with; the check alone closes the hole.
- **F2:** throwing on a foreign row. The v1 push is one transaction per phase, and a throw would roll back the
  caller's other records; this method already refuses by returning `null`. Retiring v1 sync: no v1 push got past the
  token in 15 days (sync rule 22), but removing a route is a decision of its own.
- **F4:** refusing an id the server does not hold. The Invoice Created screen's pre-warm runs before the invoice's own
  push, so it would break the first share of nearly every invoice.
- **F5:** refusing every call without `X-Device-Id` — builds up to 1.5.2 send it on sync and a few other calls only.
  Revoking the removed phone's passes in `revoked_tokens` — the answer would change from "This device was signed out."
  to "Invalid token", which the app reads differently (a guest asks for a new pass; an account is signed out). Binding
  the device into the JWT at sign-in — only builds from 1.4.6 name the phone when they sign in, and old passes would
  stay unbound. A new column — `user_sessions.device_info` already existed and was never written.
- **CORS:** a boot-time refusal of localhost origins in production — the property split does it without a new failure
  mode at startup.
- **Headers:** headers only at Caddy — the app has to be correct on its own (and the edge is not in this repository's
  deploy); the Caddy snippet below is optional defence in depth. A CSP without `sandbox` — `sandbox` is what makes a
  file from `/uploads` shown as a page harmless.
- **Analytics:** truncating or dropping excess events silently (a real batch must never lose events, and an attacker's
  must not be half-stored); counting requests instead of events (one phone's null-session drain is one request per
  event, up to 1,000 in seconds); a per-address budget that exempts the web; trusting the body's `userId` less, and
  treating implausible build numbers as untrusted — both are worth doing but change what is stored, so they are open
  below.
- **Uploads:** keeping a declared content type or file name as evidence; reading the whole file into memory to sniff
  it (16 bytes are read); a JPA entity for `uploaded_file` — plain SQL lets the code fail open if it ever runs before
  the migration; storing the caller's address for a per-address quota (privacy; an id is enough).
- **A3:** moving to OIDC-authenticated Pub/Sub push now — right direction, but it touches billing delivery and needs the
  owner's console; the header is the server half that makes either the Caddy rewrite or OIDC possible later.

## Deploy order

1. **`3dc0a34` alone** (the migration, plus the two schema-guard registrations that must ride with it:
   `ClosedAccountEraser` erases `uploaded_file` rows with an account, and `AGuestsWorkMovesInOneStepTest` lists the
   table as a record, not work). Check the Health Centre and that `uploaded_file` exists.
2. **The rest** (`aadcf5f` … `1e29e27`; the branch already has the migration first). The upload code fails open without the table, but the order
   stands.
3. **Caddy** (owner/ops, below), any time after 2.
4. **Rotate the RTDN secret** after the Caddy filter is live, and delete the old access logs that hold it.

## Caddy patches (text only, not applied — `/srv/edge/Caddyfile` on the new VPS, `ops/vps-n/edge/Caddyfile` in the backend repo)

**A3 — never write the RTDN secret to disk.** In the `(access_log)` snippet's `format filter`, beside the existing
lines:

```
		format filter {
			wrap json
			request>uri query {
				replace token REDACTED
			}
			request>headers>X-Play-Rtdn-Token replace REDACTED
			request>headers>Authorization replace REDACTED
			request>headers>Proxy-Authorization replace REDACTED
			request>headers>Cookie replace REDACTED
			request>headers>X-Internal-Token replace REDACTED
			request>headers>X-Gx-Token replace REDACTED
			resp_headers>X-Renewed-Token replace REDACTED
			resp_headers>Set-Cookie replace REDACTED
		}
```

Optional, in the `stage` site block before `import invotick_api`: hand the secret to the backend in the header and take
it off the URI, so nothing downstream ever sees it in a URL (Pub/Sub cannot send a header itself):

```
	@rtdn path /v1/billing/play/notifications
	request_header @rtdn X-Play-Rtdn-Token {query.token}
	uri @rtdn query -token
```

Then `caddy validate --config /etc/caddy/Caddyfile` and `systemctl reload caddy`; purge
`/var/log/caddy/*.access.log*` lines written before the reload; rotate `GOOGLE_PLAY_RTDN_SECRET` and the push
subscription's URL together.

**F-HEADERS-HSTS — the same headers at the edge (optional; the app now sends them).** In `(invotick_api)`:

```
	header {
		defer
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		Referrer-Policy "no-referrer"
		X-Content-Type-Options "nosniff"
		-Server
	}
```

`defer` makes Caddy write them as the response leaves, replacing the backend's copy rather than adding a second one.
Caddy's apt build has no rate-limit module, so an edge limit on `/v*/analytics/track` needs a custom build
(`caddy-ratelimit`); not proposed here.

## Risk to live builds

- **F1, F2:** none for an owner. A link with no stored owner whose invoice is another account's is now refused; that
  was a cross-account write.
- **F4:** a share made in the seconds between a sign-up and its guest claim, for an invoice still owned by the guest on
  the server, is answered 403; the app falls back to sharing without a link (`invoice_share_link_fallback`).
- **F5:** only a removed phone's pass is refused, with the answer it already got on sync. One extra indexed read of
  `user_sessions` per authenticated call, plus one conditional UPDATE per call that names a phone (matching nothing once
  tied). A store that cannot answer signs nobody out.
- **CORS:** a browser page served from `localhost:3000` can no longer call production; developers use the `local`
  profile. The panel and the web app call through their own same-origin proxies.
- **Headers:** HSTS for a year on `stage`/`gw`/`go` (already HTTPS-only); `includeSubDomains` reaches only their own
  subdomains, never `invotick.com` or `www`. The CSP's `sandbox` would stop any script in the admin analytics-docs HTML
  page if it has one.
- **Analytics, uploads:** none from what any build sends (the caps are 10–20× above it).

## Still open

- **F5's last gap needs F3:** a removed guest phone on a build that names no phone on `login-as-guest` (up to 1.4.5)
  can still get a fresh, unbound guest pass; header-less calls with it go through.
- **Analytics:** the body's `userId` is still trusted (INFO-3), and a forged high `appVersionCode` still passes the
  version gate.
- **Uploads:** the per-account quota is weak against a caller who mints new guest accounts; F3 and an edge limit close
  that. Unowned files written before this change stay unowned. The account erase deletes an account's register rows;
  deleting its unreferenced files is not built.
- **A3:** the forged-"voided" half (re-verify a voided message with Google before applying it) is billing logic, the
  owner's decision; then OIDC-authenticated Pub/Sub push.
- The other findings of the assessment (F6, B1, B2, F7, F8, F-IP-ECHO, INFO-1..8).

## Guards (written to fail on the old code)

| Test | On the old code |
|:--|:--|
| `AnotherAccountsPaymentLinkStaysItsOwnersTest` (MySQL) | the read is STALE_CONFLICT with `serverRecord`; the write is SUCCESS with the row moved |
| `EveryUpdateAsksWhoseRecordItIsFirstTest` (source scan of all 21 `updateFromSync`) | fails at `InvoicePaymentSyncV2Service`: never asks |
| `TheV1SyncWritesOnlyTheCallersOwnPaymentsTest` | the victim's payment and link are rewritten and saved |
| `OnlyTheOwnerSharesADocumentTest` | the refusals save a share; the scoped lookup does not compile; an oversize snapshot validates |
| `ARemovedPhonesPassDiesWithoutItsHeaderTest` | does not compile; the header-less and other-phone calls went through |
| `TheProductionCorsTrustsNoLocalOriginTest` | the property does not exist; `corsOrigins` does not compile |
| `ThePlayTokenTravelsInAHeaderTest` | does not compile; a header-only delivery was 403 |
| `SpringContextBootTest` (second test, same context; MySQL) | no `Strict-Transport-Security` |
| `AnalyticsIngestIsBoundedTest` | does not compile; its "real phone" cases pin the 50-event batch, the 1,000-event drain and the zero-id iPhones |
| `AnUploadIsAnImageOfItsOwnerTest` | does not compile; the HTML, the SVG and the 21st file were stored, nothing recorded |

Updated honestly: `SentLinkSurvivesPrewarmTest` stubs the caller-scoped share lookup (same arguments plus the caller's
id; assertions unchanged); `AGuestsWorkMovesInOneStepTest.NOT_WORK` names `uploaded_file`.
