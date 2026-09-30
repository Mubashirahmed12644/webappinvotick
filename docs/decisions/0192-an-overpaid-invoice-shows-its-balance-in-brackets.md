# 0192 — An overpaid invoice shows its balance due in brackets

**Date:** 2026-09-30. **Decided by:** the owner.
**Web:** `feat/overpaid-balance-in-brackets` (`b20b72d`), off `gitlab/main` `18c87c4`. Not deployed.
**App:** `feat/overpaid-balance-in-brackets` (`28ed61941`), off `VC_113_VN_149` `3354f7806`. Not merged, not released.
**Offline bundle:** md5 `b9ac2f81246acb14d4c1753eebd13305`, in both the Android and the iOS copy.
**No schema change, no money arithmetic changed.** The web and the app bundle ship together, with the next app update.

## What happened
- A client may pay more than an invoice's total: an advance. That is legitimate. It is never blocked, and never
  carried to another invoice.
- Example: total Rs658.00, amount paid Rs2,158.00.
  - The app's invoice card under the preview read **"Balance Rs(1,500.00)"**.
  - The invoice document read **"BALANCE DUE Rs0.00"**.
- The two surfaces disagreed about the same invoice.

## Where the 0 came from
- **The app clamped the balance to zero** before it reached the document, in two places:
  - `SaveInvoiceViewModel` (the saved-invoice screen, and the snapshot a share link freezes);
  - `PreviewInvoiceViewModel` (the preview screen).
- The card was never clamped. It prints `toUIString2Decimals`, which writes a negative the accounting way:
  `(1,500.00)`, with no minus sign.
- **A second defect sat under the clamp.** The snapshot mapper (`InvoiceSnapshotMapper.num`) kept only digits, dot and
  minus. It read `(1,500.00)` as **+1500**.
  - The create/edit screen was not clamped, so its live document already read **"BALANCE DUE Rs1,500.00"** on an
    overpaid invoice: a debt the client had already paid.
  - Removing the clamp alone would have spread that to every screen and every share link.
- **The native renderer** (`invoicePdf`, still drawn by `TemplateModule`) re-punctuates figures for French, Portuguese,
  Polish, Turkish, German, Swedish, Dutch and Indonesian documents. It garbled a bracketed figure: `1 500,00 Rs( )`.
- The web (`InvoiceDocument`) had no bracket rule. A negative balance would have printed `Rs-1,500.00`.
- The backend stores the app's snapshot as it arrives and computes no balance. No backend change.

## What was decided
1. **BALANCE DUE on an overpaid invoice is the negative figure in brackets**, exactly as the card writes it:
   **"BALANCE DUE Rs(1,500.00)"**. The card stays as it is.
2. **Only that row changes.**
   - An invoice that is owed or exactly paid renders byte for byte as before. The English golden is unchanged (72/72).
   - TOTAL, AMOUNT PAID, the status (Paid) and the PAID stamp are unchanged.
   - No figure is recomputed: the brackets go around the figure the app already calculated.
3. **The brackets go around the figure only; the symbol stays where the language puts it.**
   - English, Spanish, Arabic, Persian, Hindi, Burmese, Thai, Chinese: `Rs(1,500.00)`.
   - French: `(1 500,00) Rs`. German, Turkish: `(1.500,00) Rs`. Dutch: `Rs (1.500,00)`. Indonesian: `Rs(1.500,00)`.
   - Web (`formatBalanceDue`) and native (`DocumentFigures.figure`) produce the same text.
4. **Right to left:** the bracketed figure is isolated (FSI … PDI) like every other figure on an Arabic or Persian
   page, so it keeps its own order.
5. **A negative too small to show** (under half a paisa) is shown as the zero it rounds to, never as `(0.00)`.

## What changed
- **App:** no clamp in `SaveInvoiceViewModel` or `PreviewInvoiceViewModel`. The mapper reads a bracketed balance as
  negative (`signed`, balance only). `DocumentFigures.figure` keeps brackets around a re-punctuated figure. The
  `InvoiceTotalsInfo.balanceDue` KDoc no longer promises "clamped at 0".
- **Web:** `formatBalanceDue` in `format.ts`, used by the BALANCE DUE row of `InvoiceDocument`. Every render path
  draws that one component: the app's offline bundle, `/embed/render`, the share page `/i/{token}`, and the free tool.
- **Tests, each red without the change:**
  - app `AnAdvanceIsANegativeBalanceTest`: `1500.0` instead of `-1500.0`;
  - app `ReceivePaymentOpensForThisInvoiceTest.anAdvanceShows…`: `0.00` instead of `(1,500.00)`;
  - app `ABracketedBalanceKeepsItsBracketsTest`: `1 500,00 Rs( )`;
  - web `overpaid-balance` check: 54 of 105 failed.

## Rejected
- **A separate "Credit / Advance" line, with BALANCE DUE Rs0.00.** It adds a row that exists nowhere else in the app,
  and the document would still disagree with the card.
- **Both the bracketed balance and a credit line.** The same money said twice.
- **Leaving it as it is.** The document and the card disagree about one invoice: a trust problem (G3).

## Not changed, and why
- **Links already shared keep their old frozen snapshot**, so they still show `Rs0.00` until the invoice is shared
  again (hard invariant 4).
- **An old app build keeps clamping.** Its new shares still carry 0. Only builds with this change send the negative
  balance.
- **The web and the app bundle ship together**, so the app's offline page and the web page show the same thing
  (hard invariant 1). The web alone going first would change nothing visible: until the new app spreads, every
  snapshot it receives still carries 0.
