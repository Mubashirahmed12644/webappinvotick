# 0136 — A stranded record gets a new number, so the work can be sent

**Status:** built on the app branch `fix/147-a-stranded-record-gets-a-new-number` (off
[0133](0133-a-record-the-server-already-holds-is-not-created-again-and-the-audit-behind-it.md)'s
`d2f35deb`), **`65b6d9c2`**, pushed, not merged, not released. `:data:testDebugUnitTest` **334/334**,
Android and iOS-simulator compiles pass. **App only, no server change, no schema change, no
migration, no version bump.**

**The owner, 2026-09-20: *"Abhi bana do."*** It ships in the **same release** as the prevention, not
after it.

**Related:** 0133 (the prevention and the audit), 0130 (where it was found), 0053, 0050; sync agent
rules 7, 8, 11, 24; **G3**.

## 1. What it does

A record the server has refused **for good** because its id belongs to another account can never land
under that id. It is still this user's work, sitting on one phone. So the phone gives it **a number
of its own**, moves its children onto the new number, and sends it as an ordinary create.

It runs before a push, beside the other repairs, and it never asks the server anything.

## 2. What identifies the state — and nothing else is touched

The queue's own words, and only these:

- the operation is **`TERMINAL`** — the verdict a retry can never change; and
- the server's message on it names **`OWNERSHIP_VIOLATION`**.

Deliberately excluded:

- a record that is merely **unsent**, or **quarantined**, or failing for **any other reason**
  (`STALE_CONFLICT`, `INVALID_REFERENCE`, `NOT_FOUND`…): none of those is TERMINAL-with-that-message;
- a guest's record refused because **that guest's work has not joined an account yet** (rule 24). It
  resolves itself the moment the claim happens, and a new number would be the wrong answer to it.
  The query excludes it by name.

A test proves all three are left exactly as they were.

## 3. How a half-finished run is safe — by construction, not by a marker

Each record moves inside **one Room `@Transaction`**, in the order the foreign keys demand:

1. the copy under the **new** id is inserted **first**;
2. the children are moved onto it **second**;
3. only then is the old row deleted.

**At no point does a line point at an id that does not exist**, and anything that throws rolls the
whole record back. There is no marker to get out of step, because there is no state between the two
ends. A test forces exactly that failure — the new number handed out is one the phone already uses,
so the insert is refused part-way — and asserts the invoice and its line are untouched.

**Safe to run again:** once a record has moved, the old id is gone from this phone, so the next run
finds nothing. A test runs it twice and asserts the second run changes nothing.

**The copy cannot lose a column:** it is the entity's own `copy(id = …)`, so every column comes
across by construction and a column added later comes with it. Only the id and the three columns that
say what the server knows are different.

**The other owner's row is never read, written, or looked up.** (G3.)

## 4. Duplicates

**The old record cannot come back here.** A pull only ever sends this account's rows, and the old id
belongs to another account — so the server will never hand it to this phone.

If it somehow did, the user would see **one account's own duplicate**: two rows of theirs, visible
and deletable, never another account's data. That is the acceptable end of the trade, and it is why
the new row is a copy rather than a move of the id in place.

## 5. What it reports

**One row per run, not one per record** — `sync_failed stage=queue_renumbered`, with the count in
`attempts` and the kinds in the reason (*"client 1, product 2"*). That is how the recovery gets
counted in production after the release. It is in 0050's table as a count and its run, nothing more.

## 6. How much of the 75 it actually rescues — re-measured 2026-09-20

| | Records | Phones |
|:--|--:|--:|
| **Rescued** — invoices 22, invoice lines 15, clients 9, products 2, payments 2, estimates 1, estimate lines 1 | **52** | up to 20 |
| **Out of reach** — stamps 6, templates 5, signatures 4, headers 3, payment methods 3, terms 1, businesses 1 | **23** | |
| Total | **75** | 30 |

**52 of 75 — 69%** — and every kind that carries a user's actual work (documents, their lines, their
clients, their products) is in.

**Why the other 23 are out of reach, honestly.** Their ids also live **inside
`invoices.presentationJson`**, a blob of text, so moving one means rewriting JSON — a different job
with a different risk. A business is named by nearly every table. Both are separate work, not
skipped by accident.

**A boundary worth naming:** freeing a document does not free a reference it makes to one of those
23. An invoice that still names another account's template or stamp can still be refused for that
reference. Most invoices carry the seeded template id, which is never in this state, so this is a
small remainder — and `templates INVALID_REFERENCE` is already 9 records on 8 phones in 0133's audit.
Re-measure after the release before doing anything about it.

## 7. Rejected

- **Changing the id in place.** SQLite checks the foreign key at the end of each statement, so the
  parent's key cannot move while its children still name the old one, and the children cannot move
  first to an id that does not exist yet. Deferring the check would work but needs a connection-level
  pragma inside the transaction — more machinery, and no safer than insert → move → delete.
- **A marker column saying "being renumbered".** A marker is a state that can get out of step with
  the rows. One transaction has no in-between to record.
- **Writing the copy with an explicit column list.** A column added later would be silently dropped.
  `copy()` cannot forget one.
- **Renumbering everything, including the presentation assets.** Their ids live in a JSON blob; a
  half-understood rewrite of it would be exactly the silent damage this exists to undo.
- **Asking the server what it holds.** It already told us, in the refusal. Asking again would make
  the recovery depend on being online at the right moment.
- **Reporting one row per record.** That is the noise 0029, 0125 and 0130 removed.

## 8. Open

- The 23 out of reach, and the reference boundary in §6.
- **Measure after the release:** `sync_failed stage=queue_renumbered` — how many phones ran it, how
  many records each rescued — and then re-run 0133's count of `OWNERSHIP_VIOLATION` records, which
  should stop growing and start falling.
