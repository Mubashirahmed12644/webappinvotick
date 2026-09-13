# 0080 — A record the database refuses is refused alone, and the rest of its push is written

**Status:** proposed by the sync agent on 2026-09-13 and built. The owner said deploy on 2026-09-14 ("Haan, abhi live
karo"). **LIVE 2026-09-13 20:26 UTC** as batch9 `1d432e6a` (pipeline 2845034501, test 916 s). The 6 h and 24 h checks
are owed.
- Backend `fix/one-bad-push-is-not-a-500-forever` @ `f0156c1`, from stage `66ba2fc7`. Full suite 814/814.
- **The owner, 2026-09-14, on the long name ("Dono"):** the server accepts product names up to 1,000 characters (a
  migration, shipped alone and first), and the app caps the name at 255 with a counter (1.4.6). Being built.

**Related:**
- `.claude/agents/sync.md` rule 5 (a refusal of one record) and rule 24 (the claim counter);
- the structural order of 2026-09-11 — this is the database-refusal half of fix #3 (S1), ahead of #2;
- 0050 and 0029.

## Context (production, read-only, 2026-09-13)

- **Three guest phones have had every sync push refused:**
  - `46e70cdc` since 2026-09-11 15:09 UTC;
  - `2173bc74` and `93c0aa01` since 2026-07-01.

  In the 6 h to 16:44 UTC they failed 37/37, 8/8 and 2/2 pushes.
- **The cause is one product name.** Each push carries a product whose name is longer than `inventory_items.name`
  (varchar 255). MySQL refuses the insert (error 1406) and Hibernate marks the whole transaction rollback-only. The
  push is then answered 500 (`UnexpectedRollbackException`) or 400 (`DataIntegrityViolationException`).
- **Why it never ends.** 1.4.5 throws before it reads any per-record result, so the bad record never climbs the retry
  ladder. The same 100 queue rows go back every 15 minutes for ever, and nothing the phone has made since reaches the
  server.
- **Ruled out:**
  - batch3 and 0071. The failures began on 09-11. Loki was dark 09-12 01–16 UTC, so "first seen" was not "first
    happened".
  - Duplicates inside one push. They only decide which query forces the insert out.
  - The failure recorder.

## Proposed

- **A push the database accepts** is written exactly as before.
- **A push that cannot commit runs again.**
  - Every run after the first writes each record in its own operation, so the record the database refuses is pinned.
  - That record is then left out in every copy and answered `FAILED UNEXPECTED_ERROR`, with the database's error
    codes (never the value) and `data.field`. Every build already keeps that answer and retries.
- **A line naming the refused product** is refused `INVALID_REFERENCE`, as rule 5 already does for the child of a
  refused parent.
- **At most 10 refused records.** Beyond that the push fails as before.
- **Each refusal is recorded once,** from the run the phone's answer came from.
- **The guest-claim counter counts after the commit,** so a push that runs again counts a sign-up once.

## Rejected

- **A savepoint per record.** Rule 5 already rejected it, and Hibernate's session is unusable after a failed flush.
- **A transaction per record.** It breaks "one push is one transaction".
- **Writing record by record on every push.** It would move every push's timing, which is where rule 3 lost the
  device's time twice.
- **Truncating the name on the server.** It silently changes what the user typed.
- **A new error type.** Older builds would not know it.
- **A per-column length check.** It covers length only, so it is a possible follow-up, not the net.

## Consequences

- **After the deploy, the three phones recover on their next push by themselves.** This is read from the 1.4.5 code,
  not yet observed:
  - applied records turn SYNCED;
  - stale duplicates end;
  - the long-named product is retried, then quarantined;
  - the backlog drains 100 rows a push.
- **The long-named product stays on its phone** until one of two things happens, and which one is the owner's question
  when questions resume:
  - `name` is widened, which means a migration, shipped first and alone;
  - or the app caps names.
- **Measure at 6 h and 24 h:**
  - the three accounts' pushes are answered 200;
  - their latest `last_synced_at` moves past 07-01 / 09-11;
  - `sync_failure` rows appear whose reason starts "The database refused";
  - push 400/500 per hour.

## Amendment 2026-09-14: first check, and long product names fit

- **Live** 2026-09-13 20:26:05 UTC (batch9, stage `1d432e6a`, pipeline 2845034501).
- **First check, to 21:54 UTC.**
  - Push 400s and 500s fell from 27 and 96 in the 6 h before, to 0 and 0 in the 48 min after.
  - The three known phones had not pushed again, so that is not yet proof for them.
  - A fourth guest phone (`f1b05cfd`, 1.4.5) did recover.
    - Its pushes had been refused 400 from its first one, at 16:53, because of a client name over 255.
    - From 20:29:39 its pushes ran again and were answered 200, 4 of 4.
    - The client was refused alone, and the rest was stored.
- **The owner's answer, 2026-09-14: "Dono".**
  - **The server takes a product's name up to 1,000 characters.**
    - `V20260914_01` widens `inventory_items.name` and the lines' copies, `invoice_items.name` and
      `estimate_items.name`.
    - It changes them in place: on MySQL 8.0.46 no table was copied.
    - It ships alone and first. The entities' `length = 1000` follows with code.
    - Branch `fix/long-product-names-fit` at `202cc38` and `f550f65`; 818/818.
  - **The app caps a product's name at 255 characters** and shows a counter (1.4.6).
- **Rejected:**
  - widening `inventory_items.name` alone. A line takes its product's name, so the line would be refused next.
  - TEXT instead of varchar(1000). The mapped type changes, so code would have to ship with the migration.
  - naming `ALGORITHM=INPLACE` in the SQL. MySQL picks it anyway, and a surprise would become a failed migration that
    no image can start past.
- **Unchanged:** every other name still holds 255. A longer one is still refused alone and stays on its phone.
- **Measure after `V20260914_01`, at 6 h and 24 h:**
  - the three phones' products are stored;
  - their latest `last_synced_at` moves past 07-01 / 09-11;
  - "The database refused" rows for `inventoryItems name` stop.
