# 0187 — Portuguese, Spanish and Arabic, with one shared English holdout

**Date:** 2026-09-29 · built the same day as 0185, on the same structure.
**App:** `feat/more-languages` off `VC_113_VN_149`. **Web:** `feat/more-invoice-languages` off `main`. Neither is merged,
deployed or released. **The owner approves the screenshots first**
(`kaam/research/more-languages-2026-09-29/index.html`). The web change deploys together with the app build that carries
the new offline bundle. **No schema change.**

## Why these three
Android installs, release builds, 1–28 September 2026, by the phone's language (`device_journey` joined to the phone's
`analytics_sessions_v2.device_language`):

| Phone language | Installs | Saved an invoice | Shared |
|---|---:|---:|---:|
| English | 5,114 | 21.5 % | 11.0 % |
| French | 1,193 | 17.3 % | 5.6 % |
| **Portuguese** | **571** | 23.5 % | **7.4 %** |
| **Arabic** | **423** | **15.8 %** | **4.0 %** |
| **Spanish** | **62** | 17.7 % | **1.6 %** |
| Indonesian | 33 | 27.3 % | 15.2 % |
| every other language | < 21 each | | |

- **Portuguese and Arabic are the next two populations after French**, and both share far less than English phones.
  Portuguese is almost all Africa: Angola 340, Mozambique 112, Guinea-Bissau 27, Cape Verde 21, São Tomé 17; Portugal 5,
  Brazil about 4. Arabic is spread: Egypt 69, Algeria 56, Libya 38, Yemen 36, Syria 30, Morocco 19, Sudan and South
  Sudan 13 each, and the diaspora in Sweden, Germany, France and the Netherlands.
- **Spanish is small today** (62; Venezuela 12, Bolivia 6, then the Dominican Republic, Nicaragua and Mexico) but it is
  the language of the next campaigns, and it costs almost nothing once Portuguese exists: the same structure, a Latin
  script, left to right.
- The same gap 0185 found in French is there: the steps that need no reading match, the forms that must be read fall
  behind.

## What was decided
1. **One list of interface languages** (`InterfaceLanguages.ALL` in `core/common`): code, name in its own language,
   direction, and which test it belongs to. The completeness test, the picker, `locales_config.xml`,
   `CFBundleLocalizations` and the invoice's label sets all read it. Adding a language is one entry and its
   translations; a half-written language fails the build.
2. **French keeps its own test, untouched.** `french_ui_holdout_percent`, `french_ui_assigned`, its salt and its stored
   arm keep their names and meanings, so 0185's numbers stay one continuous series.
3. **One shared holdout for the three new languages.** Remote Config **`translated_ui_holdout_percent`** (text, default
   `"50"`), event **`translated_ui_assigned`**. Same rules as 0185: the phone's language in any country, sticky per
   install, a pick in Drawer → Language wins, `"0"` releases held-out phones, `"100"` keeps new installs English.
   - *Why one test, not three:* three keys to keep in step is three chances to forget one, and Spanish alone is too
     small for a test of its own. The arms are still read per language (`device_lang`), so nothing is pooled in the
     analysis.
   - *Why not fold them into the French test:* renaming or widening `french_ui_holdout_percent` would change a running
     test's meaning in the middle of its data.
4. **Stamps** (AGENTS-EVENTS §1.30): `lang_variant` gains `pt|es|ar`; `en_holdout` is shared, and its language is
   `device_lang`. `app_lang` gains `pt|es|ar`.
5. **Hand translation of every string French has: 3,482 per language**, including every runtime sentence (`rt_*`).
   No machine translation of our own labels. Money, tax and legal words were chosen per market (Glossary below).
6. **The drawer's picker:** Phone language / English / Français / Português / Español / العربية, each named in its own
   language, only the complete languages. Android's per-app list and iOS's `CFBundleLocalizations` list exactly
   `en, fr, pt, es, ar` (a test fails if either differs from the list).
7. **A new document is written in the interface language** (as 0185 did for French); **an existing invoice keeps the
   language it was written in**. Frozen share snapshots are unchanged.

## Right to left (Arabic)
- **The whole interface mirrors**: the layout direction comes from the interface language (`AppLanguageHost` provides
  `LocalLayoutDirection`). Icons that point (back, forward, chevrons) are `autoMirror`.
- **Numbers never break.** Every placeholder in an Arabic string is inside a bidi isolate (U+2068 … U+2069), so
  `-$5.00`, `INV-0042` or a Latin client name keeps its own order inside an Arabic sentence. A string that starts with
  a placeholder gets a right-to-left mark first, so the sentence still reads right to left. The completeness test fails
  on any Arabic placeholder that is not isolated.
- In RTL, every text style uses `TextDirection.ContentOrLtr` and no letter spacing (letter spacing breaks joined Arabic
  script). A text that is only an amount or a code therefore lays out left to right.
- **Latin fields stay left to right**: email, phone, website, invoice number, amounts, passwords (`forFieldValue` by
  keyboard type).
- **The invoice document** (web + offline bundle): `dir="rtl"` from the document's own language, not from the reader.
  The table's columns, the totals and the addresses mirror. Amounts, dates, invoice numbers, phones and emails are
  isolated. **Digits stay Western (0–9)**: most Arabic-language phones in our data use the default digits, which are
  Western in Egypt's and the Maghreb's settings, and an invoice read by an accountant abroad must not change digits.
- **iOS:** a held-out Arabic-language iPhone is forced to left to right, because iOS draws the system parts in the
  phone's direction.

### Known gaps (not fixed in this branch)
- **The native Compose-Canvas PDF/share image is not mirrored.** It shows the Arabic words in the English layout. It is
  the renderer being retired (north star), the HTML renderer is right, and mirroring it is a rewrite of its layout.
- Arabic plurals are written count-neutral ("الفواتير: 3") instead of the six Arabic plural forms. Correct, less
  elegant.

## What the screenshots showed, fixed in the same branch
- The Preview button cut its own label: "Pré-visu…", "Vista pre…". It now shrinks the text (down to 10 sp) instead.
- The business-number field's label did not fit half a row in Portuguese and Spanish: now "N.º de registo" /
  "N.º de registro".
- Chevrons, the help icon and the trend arrows now mirror in Arabic (`autoMirrored`).
- Everything else in the Arabic screens mirrored as intended: back arrow on the right, amounts on the left of each row,
  invoice numbers, phones and emails in their own order, at font scale 1 and 1.5.

## The invoice document
- Hand-written label sets: `src/lib/invoice-labels-{pt,es,ar}.ts`, plus estimate words (Orçamento, Cotización, عرض سعر).
- **Figures:** Portuguese re-punctuates (`1 234,50 Kz`: no-break space thousands, decimal comma, the symbol after);
  Spanish and Arabic keep the app's own `1,234.50`, because Latin America writes it that way (Mexico, the Dominican
  Republic, and the US Spanish our Spanish phones mostly report). Every figure reads back as exactly the English number
  (tests over 34 values × 23 currencies).
- **Dates:** pt `29 set. 2026`, es `29 sep. 2026`, ar `29/09/2026` (numeric on the document; month names only in the
  app's screens).
- **Paid stamp:** PAGA / PARCIALMENTE PAGA / NÃO PAGA · PAGADA / PAGADA PARCIALMENTE / NO PAGADA · مدفوعة / مدفوعة جزئيًا /
  غير مدفوعة.
- The generated label table (`invoice-labels-i18n.ts`, copied into the app) now takes the curated pt/es/ar rows instead
  of the machine rows, so the share page's "read in" picker shows the same words.
- **English is byte-identical**: the golden check renders English documents and compares them byte for byte; French is
  unchanged (its check passes).

## Glossary
One per language, with the questions a native speaker should check first:
`kaam/research/more-languages-2026-09-29/GLOSSARY-{pt,es,ar}.md`.
- **Portuguese:** European norm, which Angola, Mozambique, Cape Verde, Guinea-Bissau and São Tomé follow. Fatura, IVA,
  Orçamento, "o seu" rather than "você". Brazilian readers understand all of it.
- **Spanish:** neutral Latin American. Factura, Cotización (not Presupuesto), Impuesto (not IVA: US Spanish and several
  markets call sales tax "impuesto"), "usted".
- **Arabic:** Modern Standard Arabic. فاتورة, عرض سعر, الضريبة (generic, not ضريبة القيمة المضافة, which not every market
  has).

## Rejected
- **The small languages now** (Indonesian 33, German 20, Swedish 18, Dutch 17, Persian 12). Too few installs to read a
  test, and every language is a cost on every future string. The list makes adding one later a single entry.
- **Machine translation of our own labels** (the table the share page used for pt/es/ar). A trust product cannot say
  "Valor devido" in one place and "Montante em dívida" in another; the curated sets replace those rows.
- **Three separate tests.** See 3.
- **Folding the three into the French test.** See 3.
- **Arabic-Indic digits (٠١٢٣).** See Right to left.
- **Brazilian Portuguese.** About 4 installs against more than 500 African ones that follow the European norm.
- **Presupuesto for estimates in Spanish.** Spain's word; in Latin America a "presupuesto" is a budget.
