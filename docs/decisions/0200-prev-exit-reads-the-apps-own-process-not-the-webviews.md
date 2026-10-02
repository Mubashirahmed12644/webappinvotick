# 0200 — `app_cold_start.prev_exit` reads the app's own process, not the WebView's renderer
- **Date:** 2026-10-03
- **Status:** decided (app branch `fix/150-crashes-and-anrs`, commit `aa2b41fee`; not yet in a released build)
- **Decision:** `prev_exit` is the exit record of **our own process**; of those since the last open, the newest crash or
  ANR wins. Three new keys on `app_cold_start` — `prev_exit_detail`, `prev_stack`, `prev_crash` — carry the evidence.
  Any crash or ANR ratio is split by app version, and the first trustworthy build is the one that ships this.
- **Why:** up to versionCode 114 the app took the newest exit record of the **package**. The package also hosts the
  WebView's isolated renderer, which Android kills a few milliseconds after our process dies, for any reason. So the
  newest record was usually the renderer's, read as `other`. On the test Pixel, 7 of 8 deaths of our process were
  followed by a newer renderer record. In production (`release`, 2026-09-03 → 10-03): `other` is 40 % of the rows that
  carry a `prev_exit`; crash or ANR is 0 of 712 on 113, 1 of 801 on 114, and 17 of 8,231 on 97–107. That is
  blindness, not stability — the store-review card's "not after a crash" check read the same record.
- **Rejected:** a catch around the read (it would have kept the wrong record and said nothing); reading the renderer's
  record as a second event (one process death is one event, §1.1); re-labelling old rows (the record was never ours).
- **Consequences:** see AGENTS-EVENTS §1.34 — the version split, the three keys, and the key-count arithmetic.
