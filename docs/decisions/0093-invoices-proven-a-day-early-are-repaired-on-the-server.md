# 0093 — Invoices proven a day early are repaired on the server, before 1.4.6

**Status:** decided by the owner on 2026-09-14 ("Haan, is tareeqe se").
- **The undo register is live:** `V20260914_06` shipped alone as batch15 (`07525b77`, 06:57 UTC 2026-09-14). The
  read-only check found the migration applied and `invoice_date_repair` present.
- **The code** (`0bc9b05`: the repair endpoint, undo, echo guard, counters) ships in the next batch.
- **No invoice is changed yet.** The real run waits for the owner's go on the dry run's exact count.

**Related:**
- `docs/INVOICE-DATE-REPAIR-PLAN.md`;
- `memory/invoice-date-shifts-a-day.md`;
- 0056, where estimates were fixed another way, because their time of day survived;
- G3, trust.

## Context

- **The cause.** Builds up to 1.4.0 stored a picked invoice date as the phone's local midnight. The server kept the UTC
  day of that moment, which is one day early everywhere east of Greenwich.
- **The size.** 4,340 live 2026 invoices sit a day early.
- **The proof.** 1,745 of them (Group A: 4 May to 23 Aug, written by the old app) are proven by the phones' own share
  copies, where 61 of 63 are exactly one day ahead.
- **Why the phones cannot repair it.** An app update's full pull writes the server's copy over the phone's.
  - So the phones now hold the wrong day too.
  - Every later update would spread it again.
  - A repair driven by the phones would send the wrong day back.

## Decided

- **Group A's 1,745 invoices move one day forward, on the server, before the 1.4.6 release.** The 1.4.6 full pull then
  carries the right day to every phone.
- **A dry run comes first.** Nothing is written before the owner's go on its exact count.
- **An undo register.** A small new table keeps each invoice's old and new dates. Its migration ships alone and first.
- **A 120-day echo guard.** When a phone sends the old wrong day back, that is an echo: the server keeps the repaired
  day and applies the rest of the change.
- **Each repaired record gets a receipt:** `version` + 1 and `last_synced_at` now, with no writer. The device's edit
  time is kept.

## Rejected

- **A repair driven by the phones.** After an update they hold the wrong day too.
- **A server rule for every invoice.** It cannot tell a shifted day from a real "yesterday".

## Consequences

- **The web shows the right day at once.** Phones get it with the 1.4.6 update, or with their next full pull.
- **Group B is left alone** (the owner, 2026-09-14: "Haan, abhi na chheden").
  - Its 2,595 invoices have no proof, and some may already be right.
  - One of them is repaired only once its own proof is found.
- **Builds up to 1.4.0 that still send dates are counted for a week first** (the owner, 2026-09-14: "Pehle aik hafta
  ginti"). Nothing changes on arrival until the owner has seen the number and decided whether the server corrects
  those dates.
- **About 535 payments wait for the Payments form's review** (the owner, 2026-09-14: "Haan, ruka rahe"). Their dates
  look shifted in the same way, and they are fixed together with that review.
