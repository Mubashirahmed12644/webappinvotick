# 0007 — How a user's first currency is chosen

- **Date:** 2026-07-26
- **Status:** decided — built in the app, not released
- **Decision:** Resolve the starting currency down a ladder, and always store the result:
  1. **IP country** (existing `locationApi` lookup) — correct whenever the network is there.
  2. **Device region** — the region half of the locale (`en-PK` → `PK`), never the language.
  3. **Device language, only where one language means one country** — Urdu → Pakistan, Thai →
     Thailand, Japanese → Japan. English, Arabic, Spanish, French, Portuguese, German, Russian and
     Chinese are excluded by name.
  4. **USD** — last resort.
- **Why:** the IP lookup needs a network, and on a first launch without one it failed and stored
  nothing. Every downstream `?: "USD"` then fired, so a shop in Lahore was quietly set up in
  dollars — and a client's currency is locked once its first invoice exists, so that first wrong
  guess is permanent for that client. See [0003](0003-currency-stored-on-invoice.md).
- **Rejected:**
  - **Language alone.** Raised by the user and correct to raise: most Pakistani users run their
    phone in English, so `en` says nothing about where they are. Only the *region* is trustworthy,
    and language is admitted only where it is unambiguous.
  - **SIM country** (`getSimCountryIso()`). Proposed because it is language-proof and needs no
    permission, and not taken — it adds a platform dependency for a case the region and language
    rungs already cover, and it is wrong for anyone using a foreign SIM. Still available if the
    fallback proves unreliable.
  - **Asking the user when we can't tell.** Honest, but it puts a currency picker in front of
    someone's first invoice, which costs G1 activation for a case the ladder now almost always
    resolves.
  - **Leaving USD as the silent default** — the status quo, and the bug.
- **Consequences:**
  - `DeviceRegionProvider` is a new expect/actual in `core/common` (Android, iOS, desktop).
  - The location-fetched flag is still set only on a real IP success, so a device that fell back to
    its region or language retries and corrects itself on a later launch.
  - Three hardcoded `"USD"` defaults remain and should be revisited separately:
    `BusinessEntity.currency`, `CreateBusinessRequest`/`UpdateBusinessRequest.currency`, and the
    `catch` in `CreateBusinessViewModel`. They matter less now that the preference is always
    populated, but each is still a path that can inject dollars unasked.
