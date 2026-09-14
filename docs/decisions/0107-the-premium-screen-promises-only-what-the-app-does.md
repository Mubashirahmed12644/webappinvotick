# 0107 — The premium screen promises only what the app does

**Status:** decided in parts by the owner on 2026-09-14, one question at a time.
- The billing agent builds it for 1.4.6 once all five parts are decided.
- The live builds (1.3.9 → 1.4.5) keep the old text, because it lives inside the app.

**Related:**
- the billing agent's findings (`.claude/agents/billing.md`, known gap #8);
- `memory/first-premium-user-2026-09-10.md`;
- Google Play's Subscriptions and Deceptive Behavior policies;
- Apple App Store Review Guidelines 2.3.1(a) and 3.1.2(c).

## Context

- **The benefits list.** The premium screen lists 12 benefits, and only "No Ads" is both real and premium-only.
  - Three exist in no build:
    - "Auto follow-ups for unpaid invoices";
    - "Shareable payment links";
    - "Priority Cloud Sync".
  - The other 8 are free for everyone.
- **The chips.**
  - "50K+ Businesses": the server holds 4,586, and Play shows "10K+ downloads".
  - "4.8★": Play shows no rating for the app.
- **How long.** The list has been in every release since 1.3.9 (June 2026).
- **Who saw it.** In the 20 days to 2026-09-14:
  - 305 phones opened the screen;
  - 35 pressed Continue;
  - 1 real purchase came from it: the first premium user, in Australia.
- **The rules.** Google Play requires subscription benefits to be truthful and accurate. Apple forbids promoting
  services an app does not offer.

## Decided

1. **The three benefits no build delivers come off the screen in 1.4.6** ("Haan, 1.4.6 mein hatao").
   - No "coming soon" either, because that is a promise too.
   - A line returns, in true words, in the build that ships its feature.

2. **The two chips tell the truth** ("Sach number likho").
   - "50K+ Businesses" becomes Play's own figure, "10K+ downloads".
   - "4.8★" goes until Play shows a real rating, and then it shows that number.
   - Rejected: dropping both, which would lose a true number; leaving them, which is untrue.

3. **Only "No Ads" is presented as a premium benefit** ("Alfaz sach karo").
   - The eight features everyone already has are no longer called premium benefits.
   - Locking any of them to premium is a separate decision, to be made after measurement.
   - Rejected: locking them now, which is a big change that could stop new users reaching a first invoice; leaving the
     list as it is.

4. **The "7-day refund" pill goes** ("Hata do").
   - A promise already shown still stands for whoever bought under it.
   - The first premium user can ask until 2026-09-17 11:44 UTC.

Part 5 (the live builds) is moot: the owner froze 1.4.6 and ships it now.

## Rejected

- **"Coming soon" beside the three benefits.** It is still a promise.
- **Leaving them.**
