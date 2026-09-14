# 0099 — A phone cannot remove itself, and a removed phone gets no new pass

**Status:** decided by the owner on 2026-09-14 ("Dono karo").
- **The server fix** is built on `fix/a-phone-cannot-remove-itself` and deploys as batch17.
- **The stuck guest's row** is re-admitted after that deploy.
- **The app half** is built for 1.4.6.

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

## Still open (Tier 1)

- **Should a password sign-in re-admit a removed phone?** Today only the device-link approval does.
