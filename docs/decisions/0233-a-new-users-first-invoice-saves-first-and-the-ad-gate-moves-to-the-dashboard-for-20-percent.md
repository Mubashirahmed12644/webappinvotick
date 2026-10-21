# 0233 — A new user's first invoice saves first and the ad gate moves to the dashboard for 20 percent of new phones, and both sides are measured

**Date:** 2026-10-22 · **Owner:** the owner, one tap in chat ("Pehli invoice par gate ka A/B, 20% holdout"), then, the same day: "in 20% walay users ki ads ki jagah badal do, na ke ad band kardo" (the ad is MOVED, never removed) · **Registry id:** 158 · **Tier 3 (monetisation)** with a G1 purpose
**Rule it obeys:** AGENTS.md section 1 (monetisation is a requirement; this is an owner-approved TEST that is measured on both sides, not a removal, and the result is put back to the owner as a question).

## Why (production, read-only, 2026-10-22)

- G1 is flat: new installs reach a confirmed share in 7.8 to 9.1 percent of cases in every week since 31 August (24 h read); invoice created drifts 20.4 -> 17.7 percent. The funnel shape is the same every week: item added 41 percent, invoice created 18 percent, a 23-point drop, the largest.
- The save ad gate (`AdOrPremiumDialog` on the create-invoice screen, 30 days: dismissed 1,705 times by 1,207 phones, "watch ad" 292 by 151, "go premium" 422 by 375) is a candidate cause, not a proven one: the 2026-10-19 G1 report found 43 percent of Save presses without an invoice.
- What the gate earns: the save interstitial, 3,809 impressions and **$21.75 in 30 days** (the whole app: app-open $137.46, banners about $13). That is the most it can cost, for old and new users together.
- The gate is also a door to the paywall (422 "go premium" taps by 375 phones): moving it changes when that door is seen (after the save, on the dashboard) in the test arm, so premium is a guardrail.

## Decided

1. **Who:** a phone with no invoice ever saved on it (local invoice count 0, never saved before; a user with invoices is never touched), on build 1.5.5 or later.
2. **Arms:** by phone, stable device bucket (FNV-1a, as the nudges): `move` = 20 percent, `show` = 80 percent (as today). In `move` the FIRST invoice saves at once with no ad dialog in front of it; the same ad-or-premium dialog (the same ad unit, the same "go premium" door, the same dismiss) is shown ONCE when the user is back on the dashboard after that first save. Every later save is exactly as today. The ad is moved, not removed, so the arm keeps its ad and its premium door; only the order changes.
3. **The switch:** a Remote Config percent `first_invoice_gate_move_percent` with the **code default 0** (a missing key must never change the flow for everyone; the test starts only when the key is set to 20 after the release is verified; the owner's yes of today covers setting it).
4. **Not touched:** the estimate save gate, banners, app-open and every other ad, the paywall's other doors, and any later invoice.
5. **Planned size:** to see +4 points on a base of 18 percent (invoice created within 24 h) the `move` arm needs about 1,600 phones; at about 2,400 new phones a week and 20 percent in that arm that is about 3 to 4 weeks. The panel prints the weeks still needed.

## How the panel proves it (both sides, decision 0232's style)

- **Primary (the goal, G1):** confirmed share or payment within 24 h of first open, per arm; beside it invoice created within 24 h and, as a reading date, within 7 days. Newcombe interval, minimum 200 phones and 10 outcomes per arm, `Not enough data` below.
- **The price, shown with the same weight (never an automatic verdict, a question for the owner):** ad money per new phone in the first 7 days in each arm (from `ad_impression_value`, all formats), the difference in USD per 1,000 new phones, how often the moved dialog is actually seen (a user who leaves the app after saving never sees it), and the plain sentence "the move arm earned $X more or less per 1,000 new phones and gained N more first shares per 1,000".
- **Guardrails (a breach names the switch):** premium: paywall views and purchases per 1,000 new phones through the dialog's "go premium" in both positions (fewer than 10 buyers per arm: never red); the moved dialog's own result rows (shown, ad watched, premium tapped, dismissed) next to the old position's; return on day 2-7 and day 7 (-2 points); errors per 1,000 phones (+50 percent); crash and ANR.
- **Events (coded):** `first_invoice_gate_assigned` once per phone with `arm` (move or show); the existing ad events and `invoice_created_success` carry the rest; the arm is stamped as the parameter `gate_arm` on `invoice_created_success` and `invoice_shared_success` for those phones.
- **Silence and data-travel:** the Health Centre check watches `first_invoice_gate_assigned`; synthetic data with a known answer goes through the real road (0141) incl. a breach case, a thin case, a phone that already has an invoice (never assigned), our own phone.

## Verdict handling

The panel never says "remove the gate". It reports Better/Worse on G1 only for G1, prints the price next to it, and recommends ITERATE with the sentence above; the owner decides.

## Not decided

Whether the gate moves for everyone, stays, or changes: that follows the reading, after about 4 weeks, as a question. Removing the ad was NOT part of this decision.
