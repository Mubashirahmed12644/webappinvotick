# 0010 — One Health Centre, and a check is a component

**Date:** 2026-07-27
**Status:** Accepted, shipped

## What happened

Four faults were found on one day, all by accident, none of them crashing anything:

| Fault | How long | How it was found |
|---|---|---|
| `excahnge.invotick.com` TLS expired | 5 weeks | while looking for something else |
| `gw.invotick.com` TLS expired | 4 weeks | same search |
| Exchange rates frozen | 16 days | reading the service's own healthcheck |
| 2,717 invoices with the wrong currency | unknown | a hand-written SQL query |

Every affected endpoint answered 200 throughout. The exchange-rate service had been reporting
`"All API keys exhausted"` on its own `/healthcheck` for sixteen days, to nobody.

`gw.invotick.com` is the QR code and link in the footer of every invoice. For four weeks our users'
clients opened a shared invoice and were shown a browser security warning — often the first thing
they ever saw of Invotick. That is a **G3 (trust)** failure of the worst kind, caused by nothing more
than an absence of looking.

## Decision

**Everything that can fail silently gets a check in one place: `/health`.**

**A new check is a `@Component` implementing `HealthCheck`. It is never a new page.**
`HealthCentreService` injects `List<HealthCheck>` and discovers it. Adding a check must not mean
editing a list, because the check nobody remembers to register is the one that would have caught the
next thing.

Sync Health and Billing Health, which were nav items of their own, became cards with a `detailPath`
pointing at their old page as the drill-down.

## Why those two moved

Both already collected everything needed. Sync Health was displaying every symptom of the atomic
`/v2/sync/push` bug — devices refused, data not arriving — while a user was writing in to report two
invoices by name. The data was on a page, and the page was fine.

**A page you have to decide to visit is a page nobody visits on the ordinary day when something
starts going wrong.** That is the whole finding. Ten dashboards is the same as none.

## Rules the checks must follow

1. **Ask whether the thing is wrong, not whether it has the shape of wrong you already saw.**
   The 2026-07-25 currency backfill reported `still_empty = 0` — true and meaningless, because
   `Invoice.currency` defaults to `"USD"`, so a missing currency was never stored empty. The check
   now asks whether the currency *disagrees with its client*. A verification that can only see one
   shape of a bug declares success the moment that shape is gone.
2. **A check that throws is `UNKNOWN`, never `OK`,** and `needsAttention` counts `UNKNOWN`. A silent
   failure reporting health converts an absence of information into false reassurance — precisely
   how a certificate stayed expired for five weeks behind endpoints that all answered 200.
3. **Severity follows who is hurt, not what is broken.** Billing turns critical only on "paid but not
   enabled" (loses a customer, and they will not write in — they will leave); "enabled without
   payment" only warns (costs money, nobody is upset). Sync ranks by *devices*, not occurrences —
   one defect on forty devices is an outage, forty occurrences on one device is a retry loop.
4. **Interval matches how fast the truth can change.** A certificate moves every ninety days; a quota
   moves hourly. Checking faster than that only adds load and noise.

## Rejected

- **A monitoring service (Uptime Kuma, Pingdom, etc.).** They answer "is it up". All four faults were
  up. The questions that would have caught them — *are these rates recent? does this invoice's
  currency match its client?* — are product questions, and only this codebase can ask them.
- **Alerting first.** Nothing is fixed by delivering an alert to the same person who was not reading
  the healthcheck. Visible-by-default first; alerting later, once the checks have proved they are
  not noisy.
- **Longer TLS certificates.** Asked directly. Public CAs cap at 398 days today and the industry
  limit becomes 47 days by 2029, so this is closing, not opening. Long certificates also make the
  problem worse: a stolen key stays valid longer, and a task performed yearly never becomes a habit.
  The answer is automation plus this check as the backstop.

## The part still weak

`TlsCertificateCheck` holds a hand-kept domain list (`HEALTH_TLS_DOMAINS`, currently 9). That is the
same failure mode one level down — a domain nobody adds is a domain nobody watches. It shipped with 5
and the missing ones included `api.jariya.net`, which expires 6 August and whose renewal is already
failing. Worth reconciling against nginx `sites-enabled`, and worth replacing with discovery.
