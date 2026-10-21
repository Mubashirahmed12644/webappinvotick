# 0221 — Login lockout, emailed-code limits, the auth review, and bounded admin reads

- **Date:** 2026-10-15
- **Status:** built, **not deployed**. Backend branch `fix/auth-hardening-2026-10-15` (worktree
  `kaam/worktrees/invotick-apis-authhard`, off `integ/kisht2-2026-10-15` `3db5e41`). **Gradle not run** by the agent
  that built it. No migration. No app change.
- **Tier 1** (auth / identity) for items 1–4; Tier 3 (admin panel reads) for 7–8.
- Security audit 2026-10-15 (`kaam/research/security-audit-2026-10-15.md`): **F-LOGIN-LOCKOUT**, the auth review its §5
  could not finish, **F6**, **B1**, **B2**, **F7**, **F-IP-ECHO**, **INFO-1**, **INFO-5**.
- **Related:** 0034 (a page costs what it shows), 0076 (logs name people by id), 0099 (a password proves the account),
  0111 (closed accounts), 0118 (wrong admin sign-ins counted), 0119 (one place decides the caller's address), 0217
  (batch 1), 0218 (guest secret), 0219 (social link onto an unverified account), 0220 (billing).

## Commits

| # | Commit | What |
|---|---|---|
| 1 | `52c84fa` | F-LOGIN-LOCKOUT: wrong passwords judged before the password is checked; a held try tells nothing |
| 2 | `fe62162` | Emailed codes: SecureRandom, constant-time, per-address limits, a day's lock at most, no admin enumeration |
| 3 | `2fea2ed` | Only a reset code's pass resets a password; every password change ends the other sessions; email-change code limit |
| 4 | `bb220d4` | INFO-1 (a pass opens only its own account), renewal once a day, push-token lookup never a pattern |
| 5 | `32c3f71` | F6: shared by the row's flag, never by an id full of zeros; Health Centre count |
| 6 | `dab11ca` | B1: unpaged admin lists capped, cut by the database |
| 7 | `30f82bc` | B2: funnel ≤ 186 days; IP list ≤ 1,000 a call |
| 8 | `fbc5268` | F-IP-ECHO: a typed IP must be an IP; logged masked |
| 9 | `4e23a86` | F7: an invoice, item, product or template names only rows its account may use |
| 10 | `d938eea` | INFO-5: the committed `.env*.example` files hold placeholders |
| 11 | `2e895e8` | Follow-up to 1: a check with no address uses the account's own count only |
| 12 | `7b66a4c` | Email-change count adds with a plain lambda |
| 13 | `de07cfe` | F6 follow-up: an unowned row is not shared; an owner is never refused on his own row |

## 1. F-LOGIN-LOCKOUT — what was wrong

Read on `integ/kisht2-2026-10-15` (`AuthService.login`, `adminLogin`, `recordFailedLogin`, `assertAccountActive`):

- Five wrong passwords set `account_locked_until` for 30 min, but the lock was asked **after** the password had been
  checked. During the lock a wrong password still answered **401** and the right one **423**: the lock stopped no
  guessing and told the guesser when they had guessed right.
- "Account locked" was mailed on **every** failure from the 5th: unlimited mail to any owner, by anyone.
- An address nobody registered was never counted, so it answered 401 for ever while a real one locked: a difference.
- The lock column also shut **Google, Apple and the guest pass** out (`assertAccountActive` answered 423 there too), so a
  stranger guessing the password locked the owner's Google sign-in.

## 1. Decision

`SignInAttempts` (in memory, bounded, the pattern of `AnalyticsIngestLimits`): three counts, judged **before** the
password is looked at, on `/v1|v2/auth/login` and `/v2/auth/admin-login`:

| Count | Holds from | Waits | Window |
|---|---|---|---|
| this account from this address | 5th wrong | 1, 2, 4, 8 min, at most 15 | a day |
| this account from anywhere | 10th wrong | doubling, at most 30 min | a day |
| this address over any account | 50th wrong | doubling, at most 60 min | an hour |

- A held try is answered **429** with one sentence whatever the password ("Too many sign-in attempts. Try again in N
  minutes, or use Forgot password."). An unknown address is counted and held exactly like a real account. A held try's
  password is checked against a dummy BCrypt hash, so it costs what a checked one costs; unknown addresses already got
  Spring's dummy check.
- Every wait is **time-boxed**; a held (unchecked) try does not extend it.
- The owner always keeps two doors this never touches: **Forgot password** (a reset code ends every hold on the
  account and the stored count) and **Google/Apple**.
- "Account locked" is mailed **once**, when the account is first held in its day. Its text no longer promises 30 min.
- An internal address (loopback, private) is never counted per address: every production request names its caller
  through Caddy's `X-Real-IP`; an internal one is us or an edge that stopped saying who called, and holding it would
  hold every user at once. A check with no address at all (change-password, profile password) uses the account count.
- Nothing writes `account_locked_until` any more; `failed_login_attempts` still counts checked wrong passwords.

**Apps:** every build already shows a 429's sentence (the code routes have used 429 for months); 403, which sends the
app to the code screen (`LoginViewModel`), is never used for this. A right password is unaffected.

### Rejected
- **401 "Invalid email or password" while held** (the audit's wording "same answer"): it closes the oracle but tells a
  real owner his right password is wrong. 429 for every try while held closes it too, because the password is not looked
  at.
- **A table of attempts** (`login_attempts` exists, unused): every wrong password would write a row; a restart costing a
  guesser a few fresh tries is cheaper.
- **Server-side sleep** for the "exponential delay": it holds a request thread per guess; a held answer is the delay.
- **Locking the account permanently / for 30 min at the 5th failure**: lets any stranger hold the owner out at will.

## 2. The auth review (audit §5), item by item

| Area | Verdict | Why / what changed |
|---|---|---|
| Code generation | **fixed** | `(100000..999999).random()` (kotlin.random) → `SecureRandom`. 6 digits; email/reset 10 min, admin 5 min, email change 15 min. |
| Code comparison | **fixed** | `MessageDigest.isEqual` for the sign-up/reset/admin/passkey/email-change codes. |
| Single use | **safe** | cleared on success in every path. |
| Code guess limits | **fixed** | Tiers kept (5 → 15 min, 10 → 1 h, 15 → 6 h, 20 → **24 h**; the 4th was **30 days**, settable by anyone). A stored longer lock ends a day after it was set (`User.otpLockEndsAt`). A week without a new lock starts the tier at 1 again (it never fell back). New: from the 20th wrong code in an hour **per address** over every account, the address waits (≤ 60 min). |
| Code mail limits | **fixed** | Account's own hourly cap + gap kept. New: 30 code mails per address an hour (sign-up, resend, forgot, admin, passkey, email change) and 20 per account a day. A refused request spends nothing; forgot-password for an unknown address spends like a real one. |
| Unknown address at verify | **fixed** | 404 "User not found" → the same 400 "Invalid OTP" a wrong code gets, counted. |
| Admin code enumeration | **fixed** | `admin-verify-otp` answered 404 / 403 / 400 (no account / not admin / admin): it listed the admins. Now 400 "Invalid code" for all three. |
| Reset pass | **fixed** | `/reset-password` accepted **any** pass and set a password without the old one: a stolen session became a permanent takeover. Now only the pass `/verify-password-reset` hands out (JWT claim `rst` with its time), within 60 min; else 403. Every app build calls it with exactly that pass (`AuthNavigation` → `ResetPassword(token)`). |
| Reset ends sessions | **safe** (was) | `logoutAllForUser` already; now also clears holds and the stored count. |
| Profile password (`PUT /v1/profile/password`) | **fixed** | Changed the password and nothing else: other phones (a thief's) stayed signed in, no `password_changed_at`, no mail, no count. Now ends every other session (keeps the caller's, as the screen expects), dates it, mails, counts wrong old passwords. |
| change-password counter | **fixed** | wrong current passwords now counted (0118 had noted it had none). |
| Email change | **fixed** | Code guessable without limit for 15 min (a guest pass could claim an address it cannot read): now 5 wrong codes and the change must be asked again; request spends the code-mail budget (a free guest could mail strangers without limit). Old address told, every session ended: **safe** (75f4672). No password asked to change email: **owner decision** (below). |
| Forgot-password enumeration / timing | **accepted** | Sign-up answers 409 "Email already exists" by design, so hiding existence on forgot/resend alone closes nothing; the owner's per-account "please wait" sentence stays (the app shows it). Closing enumeration means changing sign-up: owner decision. |
| Device removal | **safe** (0217 F5) | a pass is tied to its first phone; removed → refused with or without header. Residual: a pass never used from a named phone is not listed; "sign out everywhere" ends it. |
| Removed phone at guest sign-in | **0218** | guest secret, in shadow. |
| Token renewal | **fixed** | A build ignoring `X-Renewed-Token` minted a new 90-day pass and a `user_sessions` row on **every call** of its last 30 days. Now the same old pass gets the same renewal for a day (bounded memory). Renewal keeps scope/impersonation rules: **safe**. |
| Pass ↔ account (INFO-1) | **fixed** | The account was loaded by the pass's email claim and the subject never compared: a pass whose address later named another account opened it. `AccountDetails` carries the id; mismatch → 401. |
| Notification-token query | **fixed** | `LIKE CONCAT('%', :token, '%')` with the raw token: `%` (sendable with no pass at login-as-guest) loaded every account holding a token, per call. Escaped (`ESCAPE '!'`); tokens < 32 chars scanned for on nobody; > 4,096 not stored. |
| Old passes after a password change | **residual** | Revocation covers every listed session. Passes minted before renewals were recorded (2026-09-14) are unlisted and expire by ~2026-12-13. A `password_changed_at` check in the filter was rejected: it would also end the caller's own pass on the profile-password change. |

## 3. F6 — the zero-heavy UUID guess

Every REST ownership check (17 services) skipped the owner when an id was ≥ 70 % zeros (`isDefaultDataUuid`), the shape
of the app's seeded defaults. So one account's row whose id looked like a seed's was open to every caller, and a real
shared default could be updated or soft-deleted by anyone, for everyone.

**Decision:** `isSharedRecord(isSystemDefault)` — shared = the row's own `is_system_default`, and nothing else. Shared
rows are readable by all and changed through REST / v1 sync **only by their own account** (`refuseChangeToShared`, 403
for anyone else); **an owner is never refused on his own row**, flagged or not.

**Correction, same day (`de07cfe`):** the first version also counted "a row with no owner" as shared. A
client made through REST has no `user_id` of its own (its owner is its business's), so that opened every web-made
client to every account and refused its own owner's delete — caught by `AWebWriteReachesThePhonesTest` in the
coordinator's full run. An unowned row is judged by each service's own owner check, as before 0221.

**Kept on the guess on purpose** (data I cannot read decides): sync v2's `ensureReferenceAccessible` and the v1 payment
sync's payment-method check — they let a push *name* a seed-looking row. New Health Centre card **"Rows whose id looks
like a seed's"** (`seed-looking-rows`): per table, owned-unflagged seed-looking rows (where 0221 changed who reaches a
row) and shared ones. Bounded and indexed: a primary-key range (ids below `00000000-0001-…`), ≤ 1,000 rows a table, the
exact 70 % rule on those, every 6 h. Amber when any owned unflagged one exists; never red.

## 4. F7 — references

Invoice create/update (tax, terms, payment method, template, signature, stamp), invoice-item create (tax, unit, category),
product update (tax, unit, category), template update (header, background, signature, stamp) attached rows by id with
no owner check; an invoice's answer could hand back another account's signature image link. Now one rule,
`mayReference`: own, shared (flagged), or seed-looking (exactly sync v2's rule), else 403. In v1 sync the one record
is FAILED inside its 200.

## 5. B1 / B2 — bounded admin reads

- Unpaged `/v1/webpanel/invoices`, `/inventory-items`: newest **5,000** (first page of the paged query; the unbounded
  queries are removed). `/getUsersForMap`: **50,000** points. `/getAllUsersWithStats`: **2,000** users with the
  aggregates narrowed to them (no caller in the panel today). Bare-array shape kept; `size` unchanged (≤ 200).
- Funnel `query` and `dimensions`: at most **186 days**, else 400 before reading (panel default 30).
- `GET /v1/ip`: newest **1,000**, `page`/`size` optional (the panel does not call it).
- **Left:** the funnel dropdowns' DISTINCT name reads — LIMIT 300 over the covering `(name, event_timestamp)` indexes;
  a date range may push MySQL off the index-only plan. Needs an EXPLAIN on production volume (owner/ops).

## 6. Small items

- **F-IP-ECHO:** lookup/refresh/delete take only an IP literal (no DNS), else 400; every IP-package log line masks the
  address (`203.0.*.*`), the login-IP batch job included. The *answer* keeps the typed IP whole (owner, 2026-09-14).
- **INFO-5:** `.env*.example` credentials → `CHANGE_ME_…` placeholders (the JWT guard refuses them), DB URL → localhost.
- **INFO-7 (docker root):** production already runs the container as `999:987` (`deploy/backend/compose.yml`); the
  Dockerfile is unchanged.

## Behaviour a real user can see

None for a right password, a right code or an ordinary request, except:
- 429 with a sentence after repeated wrong passwords or codes (now also for an unknown address);
- the code screen says "Invalid OTP" instead of "User not found" for an unregistered address;
- the profile password change signs **other** phones out and mails "password changed";
- the inventory page shows at most the newest 5,000 items; a funnel over > 186 days is refused.

## Owner / ops (not done here)

1. **Rotate** any value that was in the `.env*.example` files if it was ever used outside a laptop (git history keeps them).
2. **Read the new card** "Rows whose id looks like a seed's" after deploy: if it shows 0 owned-unflagged rows for a
   while, sync v2's id guess (`ensureReferenceAccessible`, the v1 payment-method check, `mayReference`) can go too.
3. **Email change without the password:** a stolen session can still change the address (the old address is told).
   Asking for the password breaks Google/Apple-only accounts; a code to the *old* address is the usual answer — a
   product decision.
4. **Sign-up reveals whether an address has an account** (409). Hiding it changes the sign-up flow.
5. Funnel dropdown reads: EXPLAIN on production before adding a date range.
6. `/actuator/prometheus` on `security.public-paths` (INFO-8): left, because the monitoring scrape may rely on it;
   confirm the scraper's path and auth first.
7. `IpRecordRepository.findByIsDeletedFalseAndLastFetchedAtBefore` (refresh job) is still unbounded.

## Gradle (for whoever runs it)

Targeted, then full (`docker start invotick-test-mysql` first; JDK 21 per CLAUDE.md):

```
./gradlew test --rerun-tasks --tests 'dev.backend.infotick.service.auth.limits.*' --tests 'dev.backend.infotick.service.auth.AWrongPasswordIsHeldBeforeItIsCheckedTest' --tests 'dev.backend.infotick.service.auth.TokenRenewalServiceTest' --tests 'dev.backend.infotick.controller.auth.*' --tests 'dev.backend.infotick.controller.ARowIsSharedByItsFlagNotItsIdTest' --tests 'dev.backend.infotick.controller.ip.*' --tests 'dev.backend.infotick.config.APassOpensOnlyItsOwnAccountTest' --tests 'dev.backend.infotick.config.ExampleEnvFilesHoldNoCredentialsTest' --tests 'dev.backend.infotick.service.AnAccountNamesOnlyRowsItMayUseTest' --tests 'dev.backend.infotick.service.account.*' --tests 'dev.backend.infotick.webpanel.*' --tests 'dev.backend.infotick.controller.ProfileControllerApiTest'
./gradlew test --rerun-tasks
```
