# 0091 — Support sees a user's app read-only, with contacts masked and every look recorded

**Status:** decided by the owner on 2026-09-14, and built. Not deployed yet.
- **The table is LIVE:** `V20260914_04` went alone as batch12 (`8dfb5fa`, 2026-09-13 23:54 UTC). The migration
  applied, and `support_view_log` exists.
- **The code is LIVE:** batch14 (`ad625178`, 2026-09-14 00:47 UTC). The support lookup answers 200 to an admin and 401
  without a token.
- **The panel is LIVE:** `c2e414b` on main. Vercel reported success, and admin.invotick.com answers 200.
- How long the record is kept (365 days, the agent's default) waits for the owner's word.

**Related:**
- 0075: admin-as-user is deleted, and support gets a read-only view;
- `docs/SUPPORT-VIEW-PLAN.md`;
- AGENTS.md §5 and §5a.

## The owner's answers, 2026-09-14

1. **Build it now** ("Abhi shuru kro"), after checking the panel's existing work. Continue that work where it serves
   best; otherwise build fresh.
   - The audit found nothing to continue as it was. The existing pages sent emails unmasked, or read far too much.
   - `/users/[userId]` gains a Support tab. Everything else is new, under `/v1/webpanel/support/**`.
2. **Emails and phones are masked everywhere** ("Haan, har jagah"). That covers the users list, the map, the sync
   occurrences and contact data. A reveal shows one value at a time.
3. **Names and addresses stay unmasked** ("Abhi nahi"), so support can recognise the user.
4. **No reason is needed for a reveal** ("Zaroori nahi"). Who looked, when, and at what is recorded anyway.
5. **Build the audit table now** ("Abhi banao"), against the recommendation to wait.
   - `support_view_log` holds one row per view or reveal: ids, the section, the action and the outcome, never field
     values.
   - Each look is recorded three ways: a log line, a counter and a row.

## Built

- **Seven admin-only reads:** lookup, summary, devices, sync failures, premium (never the purchase token),
  who-looked, and reveal. Lookup is a POST, so the search text never lands in access logs.
- **Limits:** each admin gets 120 reads per 10 minutes and 30 reveals per hour.
- **The user page's Overview reads 30 days,** not the whole event history. The heaviest user has 31,669 events.
- **Tests:** 881/881 on `751d17b`.

## Rejected

- **Continuing the existing single-user pages as they were.** They sent emails unmasked, and read without bounds.
- **A search in the query string.** It lands in access logs, and the text is often an email or a phone number.

## Found while building

- **Before 2026-09-13, `/v1/ip/**` answered with no login at all, and returned linked accounts' full records:**
  - the password hash;
  - the OTP and its expiry;
  - notification tokens;
  - a pending email code;
  - the login IP.
- **`4f089db` trims the response** to the id, the name and a masked email.
- **The facts about the exposure** are being established separately, for the owner.

## Consequences

- **Deploy order:** the table first and alone, then the code, then the panel.
- **Still open for the owner:**
  - how long to keep the record. The default is 365 days, and it is a setting;
  - whether the Overview header's last-login IP should be masked too.
