# 0211 — An estimate stores its own currency, and every screen reads it from one place

- **Date:** 2026-10-09
- **Status:** decided by the owner (2026-10-09, AskUserQuestion: "fix it in 1.5.1, and prepare the backfill list — list
  only"). Built on `fix/estimate-currency-is-locked-on-the-estimate` (app repo, `5f7aa5e47`, off `release/1.5.1` `4f84684e7`), rides
  **1.5.1**, not released. **No server change.** Backfill **listed, not written**.
- **Decision:** An estimate carries its own `currency`, exactly as an invoice has since the 2026-07 fix
  (memory/currency-not-stored-on-invoice): a snapshot of its client's locked currency taken at save, stored on the
  estimate, synced both ways. Every estimate screen asks **one** resolver, `estimateCurrency(estimate, client, business)`
  = the estimate's own → its client's → its business's.

## What was wrong (read-only investigation on production, 2026-10-09)

- The app's estimate had **no currency column and no DTO field**. The server column `estimates.currency` exists and has
  read a pushed value since 2026-08-21 (`EstimateSyncV2Upsert.currency`, the `READ_ONLY` fix), but no app ever sent one:
  287 estimates, 244 without (43 set only by an old build, 5–13 May 2026).
- Each screen derived the sign itself, from different places:

  | Screen | Read from | |
  |---|---|---|
  | Create / edit form | the client (else the account's default) | right |
  | Saved screen (render, share link, PDF) | the client, else **USD** | right unless the client had none |
  | Preview — lines | the client, else **USD** | |
  | Preview — totals, native render and the HTML snapshot | **the business** | **wrong** for a client in another currency |
  | Saved template thumbnail | a literal **`$`** | wrong |
  | List — every card | **the summary's** currency | wrong for a client in another currency |
  | List — summary | a **raw sum** of all amounts | a € 1,000 estimate added Rs 1,000 to a PKR total |

- 50 of 246 live estimates (20 %, 25 users) have a client whose currency is not the business's: the same estimate read
  € on the form and Rs on Preview's total and in the link the client received. Invoices were already right.

## The design

| Question | Answer |
|---|---|
| Where it lives | `estimates.currency` (nullable). Room v7 → v8, `@AutoMigration`, `8.json` committed, `7.json` kept. Every existing row keeps NULL — the migration writes nothing (`AnUpdateToV8KeepsEveryEstimateTest`, `AppDatabaseMigrationTest.migrate7To8_…`). |
| What is written at save | The form's currency (the client's locked one). The repository (`EstimateRepositoryImpl.currencyFor`) fills the client's when a caller passes none, and **never blanks** one. |
| Locked | A finished estimate's currency is **never rewritten for the same client** — not by a later save, a status change or a pull without the field. Two deliberate exceptions: a **client change** in the edit screen writes the new client's (the screen shows the new client's currency, and the row must say what the screen said); a **draft** still on the create screen (kept at the Save gate) takes the screen's currency, because the user may still change it there. |
| Old estimates (NULL) | Read through the resolver — their client's currency, which is locked, so it is the currency they were written in. Filled on the phone at their next save; filled on the server only by the backfill below. |
| One resolver | `estimateCurrency()` in `domain/…/SummaryCurrencyRates.kt`, beside the invoice's `writtenIn`. Preview and Saved share `documentCurrencySign()` / `documentTotals()` (one copy). The list card prints the estimate's own currency; the summary converts. |
| List summary | Each estimate counted in its own currency, converted into the chip's by the invoices tab's rules (0081: `BuildSummaryRates`, a missing rate counts at face value, **"≈"** on a figure that holds a converted amount, never on an exact one). The chip shows when the list mixes currencies. The totals carry the currency they were added in (memory/money-number-and-its-symbol). |
| Business fallback | Kept only for display, and only when neither the estimate nor its client has a currency — the old screens' behaviour, so nothing that showed a sign yesterday shows none today. Never written onto an estimate, and never used for an invoice. |
| Convert to invoice | The invoice takes the estimate's currency, else its client's (as before). Never the business's. |
| Sync | `EstimateDto.currency`, optional both ways. The server stores it on create and update and sends it on pull already — **no server change**. A pulled copy without it (old server row, or an edit from a build ≤ 1.5.0) never clears a currency on the phone. Guest → user migration needs nothing: `UserMigrationDao` re-owns rows by `UPDATE`, and the legacy-file move reads its column list from the table. |
| Renderer / web | No new field: `InvoiceSnapshot.currency` already carries the sign; only its value changes. Offline bundle and `InvoiceRenderData` untouched (invariants 1, 2). |

## Proof

- Tests, each red first: `AnUpdateToV8KeepsEveryEstimateTest`, `AnEstimateKeepsItsOwnCurrencyTest` (save, lock, client
  change, draft, push, pull, wire), `AnEstimateIsReadInOneCurrencyTest`, `AnEstimateDocumentPrintsOneSignTest`,
  `TheEstimatesSummaryCountsEachInItsOwnCurrencyTest`, `EveryEstimateScreenReadsOneCurrencyTest` (no estimate screen
  answers the currency by itself again). Gate 2969 / 0 failed (baseline 2935, +34). Dark audit pass. Xcode Debug
  build succeeded.

## Known gap (server, a separate decision)

`EstimateSyncV2Service.updateFromSync` writes `existing.currency = dto.currency`. An edit pushed by a build ≤ 1.5.0 (no
field) therefore sets a filled currency back to NULL on the server — phones keep theirs, and the screens still read the
client's, but the server copy loses it until a 1.5.1 phone saves that estimate again. The fix is one line,
`dto.currency ?: existing.currency`, as the invoice's `resolveCurrency(…, fallback = existing.currency)` does. Not made
here: a backend change is its own decision.

Side finding, not changed: `estimates.business_id` is NULL on all 251 live server estimates — the create form never puts
the business on the estimate row. Server screens that need the business reach it through the client.

## Backfill — listed, not written

`kaam/ops-scripts/estimates-currency-backfill.sh` (dry run by default; `--write --expect N`; register table
`estimate_currency_backfill_20261009` first; `--restore RUN_ID`). Fills `currency` from the client's locked currency,
only where the estimate has none and the client has a 3-letter code. Does not move `version`/`updated_at`: phones
already show the client's currency, and a bump would send every row down again. Dry run on N, 2026-10-09:

- **206 live estimates, 120 accounts** (184 / 111 users + 22 / 9 our own test accounts); +36 deleted with
  `--include-deleted`.
- By month: May 18 · Jun 7 · Jul 5 · Aug 15 · **Sep 123** · Oct 38.
- 37 of the 206 are in a currency other than their business's (USD 32, KES 3, HKD 1, SGD 1) — the ones whose Preview
  and share link showed the wrong sign.
- Never touched: 2 with no client; 13 that already carry a currency different from their client's.
- **Write waits for the owner's go on the number**, after 1.5.1 is live (so an old build's edit is the only way back
  to NULL — see the gap above).

## Rejected

- **Derive at read time from the client or the business** (no stored column). That is the invoice's original defect:
  correct only on the phone that loads the client, wrong on every server-rendered surface, and any screen that derives
  differently — as Preview did — disagrees with the rest. A financial document stores its own currency.
- **A server-only backfill without an app change.** The server column would be filled once and then stay empty for
  every new estimate, because the app never sends the field; and the app's screens would still each derive their own.
- **A Room data migration that fills old rows from the client** (the invoices' v3 → v4). The resolver already reads the
  client's currency for a NULL row, so a data step adds risk to the one migration that may not fail, for no visible
  change. The column is filled on the next save instead.
- **Filling from the business when the client has none.** A plausible wrong label is worse than none (the owner's rule
  of 2026-07-25); the business stays a display fallback only.
- **A strict lock even when the client changes.** The form would show the new client's currency while the stored row,
  Preview and the link kept the old one — the very disagreement this decision removes.
- **Converting the list summary without "≈".** A converted total presented as exact is a false sentence
  (no-false-claim-anywhere); 0081 already settled this for invoices.
