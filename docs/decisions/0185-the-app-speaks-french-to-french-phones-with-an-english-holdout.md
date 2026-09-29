# 0185 — The app speaks French to French-language phones, with a 50/50 English holdout

**Date:** 2026-09-29 · **Owner's decision, same day** ("bilkul banao"), widened the same day: *"app main yan invoice
main jo special words hain yaan short words hain unko bhi achy sy localised kerna"*.
**App:** `feat/french-ui-holdout` off `VC_113_VN_149` (merged with `8a5776e7`; head `1c1646fc`). **Web:** `feat/french-invoice-labels`
off `main`. Neither is merged, deployed or released. **The owner approves the screenshots first**
(`kaam/research/french-ui-2026-09-29/index.html`). The web change deploys together with the app build that carries
the new offline bundle. **No schema change.**

## Why
Meta installs in France, 2026-09-17 → 09-29 (`kaam/research/2026-09-29-france-retention.md`):

| Phone language | Installs | Saved an invoice | Shared |
|---|---:|---:|---:|
| French | 155 | 6.5 % | 2.6 % |
| Other | 33 | 21 % | 12 % |

French phones match the others on every step that needs no reading (the splash, the business card tap). The gap opens
at the first form they must read and type in (business: typed 64 % vs 87 % for all installs), and repeats at the
client and item forms. French phones in Africa show the same gap. Until now the app had French only for its
(unreachable) language picker, and it offered 26 languages in Android's per-app language list while speaking one — a
false claim (`no-false-claim-anywhere`).

## What was decided
1. **Who gets French: the phone's language, `fr*`, in any country.** Not the country: English-language phones in
   France do fine (typed 93 %), and French phones in Belgium, Switzerland, Canada and Africa have the same problem.
   "The phone's language" is what the platform gives this app — the system language, or the per-app language set in
   the phone's Settings — never the app's own override.
2. **A 50/50 holdout, so the effect is measured, not assumed.**
   - Remote Config **`french_ui_holdout_percent`**, read as **text** (a missing number reads as 0 on the SDK, and 0 is
     this key's "everybody French"); blank → default **50** (`percent_source=missing`), not 0–100 → 50 (`invalid`).
   - Only a French-language phone whose person has not chosen a language is dealt an arm: **`fr`** or
     **`en_holdout`** (the app exactly as it was: English strings, the phone's own system widgets).
   - Dealt **once**, from an FNV-1a bucket of the device id with its own salt (`french_ui_holdout_v1`, independent of
     the overlay test), after the splash's ad gate (the overlay test's moment, so a console value has had the longest
     to arrive). An unusable id (the all-zero one) deals a random bucket and says so (`bucket_source=random`).
   - **Sticky**: stored on the phone (`LanguagePrefs`, synchronous, read before the first frame), never re-dealt when
     the share changes. The one exception: **`"0"` ends the test** — a phone held on English is let go to French, once,
     and `french_ui_assigned` fires again with `released=true`. `"100"` deals every new French phone English; nobody
     already on French is taken off it.
   - Before the deal (the first start's splash), a French phone is shown in French — its own language.
3. **A person's own choice always wins.** Drawer → **Language**: *Langue du téléphone* / English / Français, each
   language named in itself. It switches the interface at once, on Android and iOS, without losing the open screen.
   A phone whose person chose first is never dealt; a phone dealt before keeps its arm on record, so the test is read
   as dealt (intention to treat) and the crossover is visible as `lang_pick=manual`.
4. **Only languages the interface is written in are claimed**: `locales_config` lists en and fr (it listed 26); iOS
   declares `CFBundleLocalizations` en, fr.
5. **The whole app, not only the first-invoice path**, so no screen is half English: 3,246 new English strings moved
   into Compose resources (3,511 in all), every one with a hand-written French translation (3,479 French; the 32
   without are developer-only screens). English is byte-identical (below).
6. **The invoice document too** (owner's widening): a curated French label set, French number and date formats on a
   French document only, and a new document's language = the interface language. Existing invoices never change.

## How it works
- **Screens** read `stringResource` from each module's `composeResources/values` (French in `values-fr`).
- **Sentences made outside a screen** (view models, validators, `ShownError`) stay written in English where they are
  made and go through **`RuntimeText.t/f`** (core/common): the English is the lookup key, the resource name is derived
  from it (`rt_<slug>_<fnv>`), and the table is the `rt_*` Compose resources in `domain`. An English interface gets its
  input back unchanged. `error_shown` still carries codes only.
- **The language reaches Compose Resources through the platform** (`Locale.setDefault` / `AppleLanguages`), the
  documented way to change an app's language at run time. The resources' own environment override
  (`LocalComposeEnvironment`) is Kotlin-`internal` and was refused by the compiler. `AppLanguageHost` re-applies it on
  every root recomposition and redraws the tree through a static composition local, so nothing is rebuilt.
- **Tap identities stay English**: the shared buttons whose event name fell back to their (now translated) label
  pass the English as `analyticsLabel` (Create Business, Create Client, Create Tax, Save/Update …), so a French
  phone's taps arrive under the same names. Stamped `analyticsId`s never depended on the label.

## Events (AGENTS-EVENTS §1.28)
Parameters on every event and screen view — no new name for the variation:
`lang_variant` (`fr|en_holdout|not_eligible`; absent = not dealt yet) · `app_lang` (`en|fr`, what is drawn) ·
`device_lang` (primary subtag) · `lang_pick=manual`. One coded **`french_ui_assigned`**: `lang_variant`, `bucket`,
`holdout_percent`, `percent_source`, `bucket_source`, `device_lang`, `released`.
**Read the test by `lang_variant`**, split by `is_first_open` for new installs; G1 is `invoice_shared_success`
(decision 0006).

## The invoice document
- Labels (web `invoice-labels-fr.ts`, and the native `DocumentLabels` generated from the same table): Facture ·
  Émetteur · Facturé à · Détails de la facture · N° de facture · Date d'émission · Date d'échéance · N° de commande ·
  Téléphone · E-mail · N° · Description · Qté · Prix unitaire · Remise · TVA · Montant · SOUS-TOTAL · REMISE · TVA ·
  FRAIS DE LIVRAISON · TOTAL / **TOTAL TTC** (only when the document carries a tax) · MONTANT PAYÉ · RESTE À PAYER ·
  Notes · Conditions générales · Instructions de paiement · Signature · Devis · Valable jusqu'au · PAYÉE /
  PARTIELLEMENT PAYÉE / IMPAYÉE. **No "Total HT"**: a line's amount already includes its tax, so the subtotal is not
  excluding tax.
- Formats on a French document only: `1 234,50 €` (U+202F thousands, decimal comma, U+00A0 before the symbol), the
  same digits and rounding as the English; dates `29 sept. 2026`.
- Language: a new invoice/estimate stores `language` = the interface language; an edit keeps what the row has; null,
  `en` and anything else render English exactly as before. `InvoiceSnapshot.language` ↔ `InvoiceRenderData.language`
  field for field; English leaves the key out, so old frozen snapshots and English JSON are unchanged.
- The native renderer is still live (every downloaded PDF and shared image), so it was localised too.

## Two defects the walk found, fixed in the same branch
- **The splash forced English.** `SplashViewModel` called `changeLang(accountPreferences?.language ?: "en")` on every
  launch — `Locale.setDefault` on Android, the app's `AppleLanguages` on iOS. For the French arm (no override: the
  phone already says French) that put screens back into English right after the splash while the runtime table
  stayed French; on iOS it persisted. The splash now passes "fr" when the interface is French; English is unchanged.
- **iOS saw a French iPhone as English.** `persistentDomainForName(NSGlobalDomain)` returns nothing inside the
  sandbox, so the phone's language fell back to the app's own (stale `["en"]`) override: `device_lang=en`, never
  dealt. The phone's language is now read by stepping past the app's value for one read; the old splash's stale
  value is removed once per install (no build before this declared `CFBundleLocalizations`, so iOS Settings could not
  have set it). iPhone 17 Simulator, fr-FR: before `device_lang=en` and "Setting up your workspace"; after
  `device_lang=fr`, `app_lang=fr` and "Configuration de votre espace".

## Layout (what the French screenshots showed, fixed in the same branch)
- Top bar titles shrink (down to 10sp) before they ellipsize; a title that fits is drawn exactly as before.
- The saved invoice/estimate action row was a fixed 52dp box that cut "Télécharger" in two: now 52–76dp and a
  one-line label that shrinks. The first-invoice button shrinks instead of losing its last word.
- Dashboard counts read "Factures : 5", "Brouillons : 1" (count-neutral), because the English template has no
  plural ("1 Drafts") and "1 brouillons" would be wrong.

## Proof
- English unchanged: `verify_english.py` over the diff — every new resource's English equals a literal the file had
  before, except the whole-sentence rewrites of glued plurals and concatenations, each reviewed; no pre-existing
  English value changed (265 checked). Web: 12 English renders byte-identical to goldens from `main`.
- Amounts unchanged: web `format-fr.test.ts` (16 currencies × ~70 values parse back equal), app
  `AFrenchFigureIsTheEnglishFigureTest`.
- Gate on the final branch: `testDebugUnitTest --rerun-tasks` **1,947 tests, 0 failures** (1 skipped), counted
  from every test-results XML; `:composeApp:compileKotlinIosSimulatorArm64` green; the iOS stamps test green.
- The rule: `FrenchUiHoldoutTest` (eligibility per country, stickiness, the manual pick, "0", "100", the split, bucket
  independence), `AppLanguageControllerTest`, `TheLanguageStampsRideOnEveryEventTest`, and
  `TheFrenchInterfaceIsCompleteTest` (every key has French with the same placeholders; every `rt_*` name matches its
  English).

## Rejected
- **By country** (France only): English phones in France do fine; French phones elsewhere have the same gap.
- **Play Console's automatic translation**: it reads only Android `res/values*/strings.xml` (we had 1 string there);
  Compose resources ship as assets and literals are invisible to it — and machine French for money words is a G3 risk.
- **Machine translation of our own labels** (the share page's Google path): kept for receivers' other languages, never
  the source of our French.
- **Full invoice localisation in this change** (seller's own text, legal mentions such as SIRET or "TVA non
  applicable, art. 293 B du CGI"): a product decision of its own.
- **A per-module ad-hoc string table** instead of Compose resources, and translating short labels word by word.
- **`AppCompatDelegate.setApplicationLocales`**: `MainActivity` is a `ComponentActivity`, so below Android 13 it
  would store the choice and change nothing; and it would change the holdout's system widgets too.

## Left in English, on purpose
Server sentences; the customer-ledger and payment-slip documents; the landing's "Invoice Maker" wordmark; stamp texts drawn into the stamp image; stored data
(seed categories, units, taxes, payment-method codes); developer screens; iOS permission prompts (need
`fr.lproj/InfoPlist.strings` in the Xcode project). Dashboard and list amounts keep `1,234.56` in the app's screens
(only the invoice document is re-punctuated).

## Glossary
`kaam/research/french-ui-2026-09-29/GLOSSARY.md` — the binding term list and the short-word table (Qté, N°, Remise,
TVA, Sous-total, Échéance, Payée, Brouillon, En retard, pce, h, j, Aujourd'hui …). For a native speaker to check first:
"TVA" for the generic tax field (Québec uses TPS/TVQ) · "Relevé client" for the customer ledger · "Payée"/"Payé"
agreement · "À encaisser"/"Reste à payer" · "Émetteur" and "Description" (vs "Désignation") on the document ·
the subscription terms on the paywall · the sign-up legal line · the share caption that goes to clients
("🧾 Facture jointe. Créée avec Invotick — …").
