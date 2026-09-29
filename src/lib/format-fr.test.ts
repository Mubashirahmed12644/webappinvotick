// A French document writes the SAME figures as the English one, only punctuated the French way
// (decision 0185). Every assertion here parses the French text back to a number and compares it with the
// English text's number: if the two ever read differently, a client is shown a different amount.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatFixed2, formatMoney, formatPercent, frenchDigits, roundShown } from "./format.ts";
import { LABELS, ESTIMATE_LABELS } from "./invoice-labels.ts";
import { FR_ESTIMATE_LABELS, FR_LABELS, frenchLabelsFor } from "./invoice-labels-fr.ts";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n.ts";

const NNBSP = " ";
const NBSP = " ";

/** The number an English money string says: "$1,234.50" / "CHF 1,234.50" / "Rs-5.00" / "$-5.00". */
function englishValue(s: string): number {
  const neg = s.includes("-");
  const digits = s.replace(/[^0-9.]/g, "");
  return (neg ? -1 : 1) * Number(digits);
}

/** The number a French money string says: "1 234,50 €" / "-5,00 $". Only U+202F may group. */
function frenchValue(s: string): number {
  const m = /^(-?)(\d{1,3}(?: \d{3})*)(?:,(\d+))? \S.*$/u.exec(s);
  assert.ok(m, `not a French amount: ${JSON.stringify(s)}`);
  const [, sign, int, frac] = m;
  return (sign ? -1 : 1) * Number(`${int.replaceAll(NNBSP, "")}.${frac ?? "0"}`);
}

const VALUES = [
  0, 0.004, 0.005, -0.005, 0.01, 0.1, 1, 1.005, 2.175, 2.185, 9.995, 10, 12.3, 99.99, 100, 999.995,
  1000, 1234.5, 1234.567, 12345.678, 99999.999, 100000, 1234567.89, 987654321.126, 1e9 + 0.5,
  -0.01, -1, -2.175, -1234.5, -999999.995, 58123.45, 3965.74, 14.5 * 0.15, 0.1 + 0.2,
];
// SYMBOLS ones, ISO codes through Intl (CHF, CAD, JPY 0 decimals, KWD/BHD 3 decimals), raw app symbols.
const CURRENCIES = ["EUR", "USD", "GBP", "PKR", "INR", "CHF", "CAD", "XOF", "MAD", "JPY", "KWD", "BHD", "€", "Rs", "$", "FCFA"];

test("every French amount reads back as exactly the English amount", () => {
  for (const cur of CURRENCIES) {
    for (const v of [...VALUES, ...VALUES.map(String)]) {
      const en = formatMoney(v, cur);
      const fr = formatMoney(v, cur, "fr");
      assert.equal(frenchValue(fr), englishValue(en), `${cur} ${v}: en ${JSON.stringify(en)} fr ${JSON.stringify(fr)}`);
    }
  }
});

test("French amounts: narrow no-break space thousands, decimal comma, symbol after a no-break space", () => {
  assert.equal(formatMoney(1234.5, "EUR", "fr"), `1${NNBSP}234,50${NBSP}€`);
  assert.equal(formatMoney(1234.5, "CHF", "fr"), `1${NNBSP}234,50${NBSP}CHF`);
  assert.equal(formatMoney(1234567.891, "USD", "fr"), `1${NNBSP}234${NNBSP}567,89${NBSP}$`);
  assert.equal(formatMoney(0, "EUR", "fr"), `0,00${NBSP}€`);
  assert.equal(formatMoney(-5, "EUR", "fr"), `-5,00${NBSP}€`);
  assert.equal(formatMoney(999, "€", "fr"), `999,00${NBSP}€`);
  assert.equal(formatMoney(1500, "Rs", "fr"), `1${NNBSP}500,00${NBSP}Rs`);
  // The half-away-from-zero rounding of the app, on the calculated decimal (2.175 → 2.18), both languages.
  assert.equal(formatMoney(2.175, "EUR", "fr"), `2,18${NBSP}€`);
  assert.equal(formatMoney(2.175, "EUR"), "€2.18");
  // Intl's own decimals for the code, exactly as the English line: none for JPY, three for KWD.
  assert.equal(formatMoney(1234.5, "JPY"), "¥1,235");
  assert.equal(formatMoney(1234.5, "JPY", "fr"), `1${NNBSP}235${NBSP}¥`);
  assert.equal(formatMoney(1234.5, "KWD", "fr"), `1${NNBSP}234,500${NBSP}KWD`);
});

test("English money output is unchanged by the French path (the default stays English)", () => {
  assert.equal(formatMoney(1234.5, "EUR"), "€1,234.50");
  assert.equal(formatMoney(1234.5, "EUR", "en"), "€1,234.50");
  assert.equal(formatMoney(584, "Rs"), "Rs584.00");
  assert.equal(formatMoney(1234.5, "CHF"), `CHF${NBSP}1,234.50`);
});

test("roundShown is the figure both languages start from", () => {
  for (const v of VALUES) {
    assert.equal(frenchValue(formatMoney(v, "EUR", "fr")), roundShown(v));
  }
});

test("quantities and rates: same digits, French punctuation", () => {
  for (const v of [0, 1, 1.5, 12.345, 1000, 1234567.891, -3.2]) {
    const fr = formatFixed2(v, "fr");
    assert.equal(Number(fr.replaceAll(NNBSP, "").replace(",", ".")), Number(v.toFixed(2)), fr);
    assert.equal(formatFixed2(v), v.toFixed(2));
    assert.equal(formatPercent(v), `${v.toFixed(2)}%`);
    assert.equal(formatPercent(v, "fr"), `${fr}${NNBSP}%`);
  }
  assert.equal(frenchDigits("1,234.50"), `1${NNBSP}234,50`);
  assert.equal(frenchDigits("12"), "12");
});

test("dates: the same calendar day, written the French way", () => {
  assert.equal(formatDate("2026-09-29", "fr"), `29${NBSP}sept.${NBSP}2026`);
  assert.equal(formatDate("05/09/2026", "fr"), `5${NBSP}sept.${NBSP}2026`); // day-first, as the app writes it
  assert.equal(formatDate("2026-02-01", "fr"), `1${NBSP}févr.${NBSP}2026`);
  assert.equal(formatDate("2026-08-15", "fr"), `15${NBSP}août${NBSP}2026`);
  assert.equal(formatDate("31/02/2026", "fr"), "31/02/2026"); // impossible: shown as written, both languages
  assert.equal(formatDate(null, "fr"), "—");
  // English untouched.
  assert.equal(formatDate("2026-09-29"), "Sep 29, 2026");
  assert.equal(formatDate("05/09/2026"), "Sep 5, 2026");
});

test("every label has a French value, non-empty, and the estimate's own words", () => {
  for (const k of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    assert.ok(typeof FR_LABELS[k] === "string" && FR_LABELS[k].trim().length > 0, `FR_LABELS.${k}`);
  }
  assert.ok(FR_LABELS.totalWithTax.trim().length > 0);
  for (const k of Object.keys(ESTIMATE_LABELS) as (keyof typeof ESTIMATE_LABELS)[]) {
    if (ESTIMATE_LABELS[k] === LABELS[k]) continue; // not one the estimate changes
    assert.ok(FR_ESTIMATE_LABELS[k]?.trim(), `FR_ESTIMATE_LABELS.${k}`);
  }
  assert.equal(frenchLabelsFor("ESTIMATE").invoice, "Devis");
  assert.equal(frenchLabelsFor("INVOICE").invoice, "Facture");
  for (const v of Object.values(FR_LABELS)) assert.ok(!v.includes("#"), `no English "#" in ${v}`);
});

test("the generated table's French row IS the curated set (so the app's copy says the same words)", () => {
  assert.deepEqual(LABEL_TRANSLATIONS.fr, { ...FR_LABELS });
  assert.deepEqual(ESTIMATE_LABEL_TRANSLATIONS.fr, { ...FR_ESTIMATE_LABELS });
});
