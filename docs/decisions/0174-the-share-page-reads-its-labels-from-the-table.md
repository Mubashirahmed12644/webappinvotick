# 0174 — The share page reads its labels from the table, and only the invoice's own sentences are translated live

- **Date:** 2026-09-26
- **Status:** built, not merged, not deployed. Web `Webinvotick`, branch `fix/share-page-labels-from-table` off
  `release/web-with-android-149` @ `419313d`. No schema change, no server change, no new or renamed event.
- **Asked by:** the coordinator, for the owner: a client translating a shared invoice into Chinese read
  "扫描下载Invotic" — our own name cut — and labels that differ from what the app shows the sender.

## What was wrong

`/i/{token}` → `SharedInvoiceViewer` → `translateInvoice` (`src/lib/translate-invoice.ts` @ `419313d`) sent all
32 labels **and** the business's name, the client's name, company, address, city and country to Google on every
language pick. The committed label table (`src/lib/invoice-labels-i18n.ts`, 24 languages, 271 human corrections
from `1fc4bc7` / `0d09e2a`) was used only by `/api/translate-invoice` — and the app, which renders from a
generated Kotlin copy of that same table (`InvoiceLabelTranslations.kt`, used by `TranslateApi.kt` on the device).

Measured against Google's live answer on 2026-09-26, what the client read versus what the table says:

| | live (before) | table (after) |
|---|---|---|
| zh-CN "From" | 来自 | 销售方 |
| zh-CN "Disc" | 光盘 (optical disc) | 折扣 |
| zh-CN "P.O #" | 邮政信箱号 (PO box) | 采购订单号 |
| zh-CN "Scan to download Invotick" | 扫描下载Invotic | 扫描下载 Invotick |
| ar "Bill To" | بيل ل ("Bill" as a name) | فاتورة إلى |
| ar "Disc" | القرص (the disc) | خصم |
| ar "P.O #" | ص.ب # (PO box) | رقم أمر الشراء |

Also on the old path: an **estimate** shared as a link was headed with the invoice's labels in every language
(it translated `LABELS`, never `ESTIMATE_LABELS`), and a translator failure left the page in English even though
the table needs no network.

## Decided

1. **One function decides what a translated document says**: `translateDocument` in
   `src/lib/translate-document.ts`. The share page and `/embed/render` call it through `translateInvoice`;
   `/api/translate-invoice` calls it directly. Labels come from the table; the translator is only handed text.
2. **Only the invoice's free text goes to live translation**: item descriptions (`items[].name`), `notes`,
   `paymentInstructions`, `terms`. **Not** the business's name, the client's name, company, address, city or
   country — they are what someone is called and where they are — and never amounts, dates, currency or numbers
   (those were never sent).
3. **A language the table does not carry keeps English labels.** Kept from the route's existing, commented
   behaviour: English is a known wording; a live guess is what the table was made to replace. The share page
   cannot reach this case — its picker lists exactly the table's 24 languages, and the check asserts that.
4. **"Invotick" is never translated or cut.** Four estimate footers in the table had it cut or transliterated
   (th, gu, ne "Invotic"; hi "इनवोटिक") and are fixed. At runtime, a label whose English carries the name and
   whose translation does not falls back to the English line. The generator now applies its brand repair to the
   estimate table too.
5. **`scripts/checks/share-labels.check.tsx`** replaces the live translator with a stub that marks what it
   touches, runs the share page's own `translateInvoice` for every table language (invoice and estimate), and
   fails if a label is not the table's, if a label or a name reaches the translator, if a footer in either table
   does not spell "Invotick" whole, or if the rendered zh-CN / ar page lacks the table's words. With
   `APP_REPO` set it also compares against the app's Kotlin copy.

## Rejected

- **Posting the whole snapshot to `/api/translate-invoice` from the browser.** One source, but it would send the
  logo, header, signature and stamp images back to the server for a language pick. The shared function gives the
  same single source without that.
- **Keeping names translated for parity with the app.** The app's `TranslateApi.kt` (`VC_113_VN_149` @
  `852269eb`) still sends business/client name, company, address, city and country — so until it follows, those
  six fields differ between the app's translated preview and the link. Named as the app's follow-up below rather
  than kept wrong on both sides.
- **Live-translating labels for languages outside the table** (what the app does for it/tr/ko/pl/vi). Not needed on
  the web, where the picker is the table.

## Still open — app side, not in this change

- `InvoiceLabelTranslations.kt` on `VC_113_VN_149` lacks `footerContact` in all 24 languages (added to the web
  table with 0151, never regenerated), so the app's translated own-footer reads "Contact us" where the link reads
  联系我们 / اتصل بنا — 48 differences in the check with `APP_REPO` set. It also carries the four cut estimate
  footers. Regenerate it from this table (`scripts/apply-label-overrides.mjs`; note its `APP_TABLE` path still
  points at `~/Documents/invoice-kmp-app`, the pre-move location).
- `TranslateApi.collectStrings` should drop the six name/address slots to match rule 2.
- Shared snapshots are frozen, but translation happens at read time, so **old links get this fix on deploy**.
