# 0162 — No ad loads before consent, and the form comes after the user has landed

**Status:** decided, built (Android, app branch `feat/gdpr-consent`) · **Date:** 2026-09-23 ·
**Goals:** G3 (trust), G1 (activation), monetisation

## What happened

Invotick had **no GDPR consent of any kind**. Verified in code on 2026-09-23: no Google UMP, no
`ConsentInformation`, no Consent Mode, no consent-based gating of any ad. The only thing resembling a
privacy control was "delete account", which is erasure, not consent.

Two separate problems, and the second is the sharper one:

1. **GDPR.** EEA/UK users were served personalised ads without ever being asked.
2. **AdMob's own EU consent policy.** Breaking it puts the **ad account** at risk of suspension — so
   this is not a compliance nicety, it is the revenue.

The app is global on Play (production 1.4.7 / 1.4.8), so those users exist. The AdMob console GDPR
message was published for Android on 2026-09-23, which is what gives UMP a form to show at all;
without it every EEA user falls through as "form not available".

## Why the placement is the whole decision

A consent form is a full-screen question from Google, and the only two places it can go are the
cold-start splash — the first thing a new user sees, before they have any reason to trust us — or the
first ad-moment after they have reached the app.

Invotick's splash is already the most expensive part of the funnel: about 80% of cold starts get
through it (target 98%), and it already holds for an app-open ad. Putting a legal dialog in front of
a stranger, on a screen that is already the biggest leak, trades G1 for nothing — the same consent
can be collected thirty seconds later from a person who has seen what the app is.

## Decision

1. **Land-first.** The consent form is **never** shown on the cold-start splash. A cold start whose
   consent is not yet resolved shows **no app-open ad** and no form; the user reaches the app, and
   the form appears at the first ad-moment there — in practice the banner composing on the screen
   they land on.
2. **Every ad load is gated**, all three formats — app-open, interstitial and banner. Nothing is
   requested from AdMob until UMP says it may be.
3. **Nothing ever waits for consent.** An ad-moment that arrives before the gate opens proceeds
   **without an ad** rather than holding anything. The save path in particular completes first and
   raises the form afterwards, so no invoice is ever held for a consent dialog.
4. **Only the moments the user has landed on may raise the form** — the banner, a resume, a save, a
   late app-open. The splash and the background preload read the answer and never ask.
5. **A "Privacy options" entry in the drawer**, drawn only where UMP says one is required — so it
   never appears outside the EEA/UK, and never on a platform with no consent layer.
6. **Two events, both coded, both first-party essential UX:** `screen_view` for `consent_form`, and
   `consent_decision`. Full parameters in `AGENTS.md` §5b.
7. **Firebase Consent Mode v2 is synced from the IAB TCF result** at process start and after every
   resolution, so ad signals read `source=API` instead of the weak `source=MANIFEST`. Outside GDPR
   the TCF strings are empty by design and everything is granted there — otherwise the signal would
   read as weak for the ~96% of users who were never asked.

## What it costs, and why that is a number rather than a claim

Skipping an app-open ad is real revenue, so it is **counted, not assumed**
(memory: `monetisation-measure-never-assume`):

- every skipped cold-start app-open ad is an `app_open_decision` with **`outcome=consent_pending`**
  on the `splash` path;
- the same word is a new `AppOpenRequestRefusal.CONSENT_PENDING` and a new `ad_blocked_by` value on
  `app_foreground`.

**The residual cost, stated plainly.** Google UMP stores its answer, so from a phone's *second*
launch onwards the gate is already open at process start and nothing is skipped. On a **fresh
install** the answer is not stored yet, so a status lookup (`requestConsentInfoUpdate`, which can
never show a form) is fired at the first activity — and outside the EEA/UK that returns NOT_REQUIRED
and opens the gate while the splash is still working. If the splash asks before that lookup returns,
**that one app-open ad is skipped**, for a non-EEA user, once per install. It was left that way
rather than made to wait: a wait would be a delay added to a first launch for everybody, and the
`consent_pending` rows measure the alternative exactly. If the count justifies it, the fix is to let
the splash's existing 6,000 ms window absorb the lookup — a decision to take with the number in hand.

## Rejected

- **The form on the splash.** The obvious placement, and the one that costs the most. The splash is
  already where ~20% of cold starts are lost; a legal dialog in front of a stranger who has not yet
  seen an invoice screen trades the biggest goal for a few hours of earlier collection. Rejected by
  the owner on 2026-09-23.
- **A third event, `consent_privacy_options_opened`.** The drawer entry already has its own
  auto-captured tap, so a coded event beside it is one press arriving under two names — exactly the
  defect that removed nine coded twins in 1.4.3 (AGENTS-EVENTS §1.1, §1.11). Which door the form came
  through is `entry` on the two events instead, the shape decision 0155 gave the paywall.
- **A remote flag over the gating.** `PROJECT_RULES` asks for a kill-switch on a behavioural change
  "where practical", and here it is not. A switch whose off-state stops gating ads on consent is a
  switch that turns an AdMob EU-consent-policy breach back on; and the only other placement it could
  select is the splash one rejected above, which the decision log exists to stop us rebuilding. What
  *is* changeable without a release is the thing that matters — the `consent_pending` count, which
  lets the placement be revisited with evidence.
- **One word for "denied" and "partial".** Folding a user who refused everything together with one
  who allowed device storage but not personalisation would make the only interesting number in this
  funnel unreadable; they have different consequences for revenue.
- **Treating `not_required` as a grant.** It is neither a grant nor a refusal. Reading it as consent
  would overstate what we hold; reading it as a refusal would switch off ads for ~96% of users.

## Consequences

- **A `consent_form` view is a European user.** Any count of it is a count of EEA/UK phones, not of
  users, and no row of any kind exists under these names before 1.4.9.
- **Old rows never say `consent_pending`.** A breakdown of `app_open_decision` that spans 1.4.9 is
  mixing a release that could not report this reason with one that can.
- **Denying consent does not stop ads** — it stops *personalised* ads. Google serves
  non-personalised inventory, at a lower rate. Expect EEA revenue per impression to fall and EEA
  impressions to stay.
- **The IAB TCF reading lives in one place** (`ConsentSignals`, pure and tested): the Firebase sync
  and the funnel outcome were parsing the same bit-strings twice, with the purpose indices written by
  hand in both.
- **iOS is not covered.** Its UMP + ATT work is separate, and until it lands an iPhone shows no
  consent form, sends none of these events, and draws no Privacy-options entry.
- **The privacy policy may now say we obtain consent** — and could not before. Until this ships the
  policy must not claim GDPR compliance.
