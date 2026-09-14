# 0099 — A phone cannot remove itself, and a removed phone gets no new pass

**Status:** decided by the owner on 2026-09-14 ("Dono karo").
- **The server fix is live:** batch17, `32b89cde`, started 10:03 UTC 2026-09-14. The proofs after the deploy:
  - a request without a token answers 401;
  - the refusal writes one WARN line naming its phone and build;
  - 0 ERROR lines in the 3 minutes after the deploy.
- **The stuck guest's row was re-admitted at 10:05 UTC.** The exact filter matched 1 row, 1 row changed, and the row now
  reads as admitted.
  - The phone's next sync should be accepted, and its waiting record should arrive.
  - The proof: its `last_seen_at` moves past 19:49:11, and the "Revoked device refused" lines stop.
- **The app half** is being built for 1.4.6.

**Related:**
- sync agent rule 28;
- 0098;
- G3.

## Context

- **What happened.** On 2026-09-13 at 19:49 UTC a guest phone (`e0e2de82`, 1.4.5, its account's only device) pressed
  "Log out" on its own row in Linked devices.
- **Why it could.** The app sends `X-Device-Id` only on sync calls. So the server never knew which row was the caller's,
  and the "this is the device you are using" check never ran.
- **Since then** every sync is refused "This device was signed out.", and the phone answers each 401 by fetching a new
  guest pass. That is 110 refusals so far, and its last push (1 record) never arrived.
- **How often.** In the last 7 days this is the only phone, and no registered phone is affected. There have been 12
  revokes ever, and 11 of them were our own tests.

## Decided

- **The server:**
  - **A revoke that does not name the calling phone is refused** and removes nothing ("Update Invotick to remove a
    device."). Builds up to 1.4.6 cannot remove a device until they send the header on that call.
  - **A phone its account removed gets 403 and no guest pass.** Never 401, because every build answers a 401 by asking
    again. This binds only calls that name their phone.
  - **Every refusal writes one WARN line** naming the status, reason, device, build, platform and endpoint.
  - **A refusal no longer writes an ERROR line** whose content a stranger can shape. Such a line could page Slack.
- **The stuck guest: its row is re-admitted** once the guard is live.
  - One row, `revoked_at = NULL`, with an exact filter that counts 1 first.
  - The phone's next sync is then accepted, and its record arrives.
- **App 1.4.6:**
  - Send `X-Device-Id` on the device list, the revoke and the guest pass.
  - On the 403, or on the sync 401 "This device was signed out.":
    - stop syncing and stop asking for passes;
    - keep every row;
    - say once that the phone was removed from another device and its invoices are still on it.

## Rejected

- **The guard only,** which would leave the guest's record stranded.
- **Doing nothing.** Any phone could strand its own work the same way.

## Decided later the same day (Tier 1)

- **A correct password sign-in re-admits a removed phone.** The owner, 2026-09-14: "Haan, password se wapas".
  - **Why:** the password is the account's key. Whoever holds it can sign in on any phone, so keeping one phone out
    protects nothing.
  - **To keep a phone out,** change the password.
  - **Google sign-in** proves the account the same way, so it follows the same rule.
- **Rejected: re-admission only through another device's approval.** It is stricter, but a phone removed by mistake would
  need a second device, and one-phone users would be stuck.

## Built the same day: phones whose sign-in does not name the phone

- **A removed phone comes back on its first sync after a correct password or Google sign-in.** This is how the owner's
  rule above reaches the builds up to 1.4.6. The coordinator gave the go on 2026-09-14. Built on
  `fix/password-sign-in-readmits` for batch18: tests `680763e`, fix `fda5290`, full suite 980/980. Not deployed.
  - **Why it is needed:** a sign-in re-admits only a phone it can name (`X-Device-Id`), and no build up to 1.4.6 names
    its phone when it signs in. On those builds the sign-in worked, and every sync after it was refused with "This
    device was signed out.". Every build does name its phone on sync.
  - **How:** a password or Google sign-in writes into its pass how it was earned and when (`proof`, and `proofAt` in
    milliseconds). When a removed phone calls, the server compares that time with the removal inside one transaction.
    It lets the phone back in only if the sign-in came after the removal.
  - **Never, whatever the pass claims:**
    - a guest pass, an admin-impersonation pass or a drain pass;
    - a pass with no proof: a renewal, a device link, an API token or an admin sign-in;
    - a proof the server does not write (anything but a password or Google);
    - a sign-in dated at or before the removal. So a phone removed again after it came back stays out.
  - **Evidence:**
    - a refusal line says why the pass could not bring the phone back (`sign_in=none|before_removal|not_written`);
    - a re-admission writes one INFO line naming the sign-in.
- **Rejected:**
  - **The pass's own issue time.** A renewal mints a new pass. If one ever copied the proof, an old sign-in would pass
    for a new one. So the sign-in's time is a claim of its own.
  - **The standard names `amr` and `auth_time`.** `auth_time` counts in seconds, and nothing outside this server reads
    these passes.
  - **Waiting for 1.4.6.** Every older phone would stay locked out after a correct sign-in until it updates.
  - **Allowing it only on the sync path.** The proof is in the pass, so the path adds no safety, and old builds name
    their phone only on sync anyway.
