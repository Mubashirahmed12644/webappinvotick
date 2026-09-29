// A document written in Portuguese, Spanish or Arabic writes the SAME figures as the English one (decision 0187).
// Portuguese re-punctuates them (`1 234,50 Kz`), Spanish and Arabic keep the app's own `1,234.50`. Every assertion
// reads the text back to a number and compares it with the English text's number: if the two ever read differently,
// a client is shown a different amount.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatFixed2, formatMoney, formatPercent, roundShown } from "./format.ts";
import { LABELS, ESTIMATE_LABELS } from "./invoice-labels.ts";
import { PT_ESTIMATE_LABELS, PT_LABELS } from "./invoice-labels-pt.ts";
import { ES_ESTIMATE_LABELS, ES_LABELS } from "./invoice-labels-es.ts";
import { AR_ESTIMATE_LABELS, AR_LABELS } from "./invoice-labels-ar.ts";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n.ts";

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);

function englishValue(s: string): number {
  const neg = s.includes("-");
  // The figure is the last run of digits: a symbol may itself hold a dot ("د.إ", "Bs.").
  const figures = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? ["NaN"];
  return (neg ? -1 : 1) * Number(figures[figures.length - 1].replaceAll(",", ""));
}

/** The number a Portuguese money string says: "1 234,50 Kz" / "-5,00 €". Only U+00A0 may group. */
function portugueseValue(s: string): number {
  const m = new RegExp(`^(-?)(\\d{1,3}(?:${NBSP}\\d{3})*)(?:,(\\d+))?${NBSP}\\S.*$`, "u").exec(s);
  assert.ok(m, `not a Portuguese amount: ${JSON.stringify(s)}`);
  const [, sign, int, frac] = m;
  return (sign ? -1 : 1) * Number(`${int.replaceAll(NBSP, "")}.${frac ?? "0"}`);
}

const VALUES = [
  0, 0.004, 0.005, -0.005, 0.01, 0.1, 1, 1.005, 2.175, 2.185, 9.995, 10, 12.3, 99.99, 100, 999.995,
  1000, 1234.5, 1234.567, 12345.678, 99999.999, 100000, 1234567.89, 987654321.126, 1e9 + 0.5,
  -0.01, -1, -2.175, -1234.5, -999999.995, 58123.45, 3965.74, 14.5 * 0.15, 0.1 + 0.2,
];
// The currencies these installs invoice in (AOA, MZN, CVE, BRL, EUR; USD, MXN, VES, BOB, DOP; EGP, AED, DZD, MAD,
// SAR, LYD, KWD with three decimals), the app's own symbols, and raw symbols the app passes.
const CURRENCIES = ["AOA", "MZN", "CVE", "BRL", "EUR", "USD", "MXN", "VES", "BOB", "DOP", "EGP", "AED", "DZD", "MAD", "SAR", "LYD", "KWD", "JPY", "PKR", "€", "Kz", "R$", "د.إ"];

test("every Portuguese amount reads back as exactly the English amount", () => {
  for (const cur of CURRENCIES) {
    for (const v of [...VALUES, ...VALUES.map(String)]) {
      const en = formatMoney(v, cur);
      const pt = formatMoney(v, cur, "pt");
      assert.equal(portugueseValue(pt), englishValue(en), `${cur} ${v}: en ${JSON.stringify(en)} pt ${JSON.stringify(pt)}`);
    }
  }
});

test("Portuguese amounts: no-break space thousands, decimal comma, symbol after a no-break space", () => {
  assert.equal(formatMoney(1234.5, "EUR", "pt"), `1${NBSP}234,50${NBSP}€`);
  assert.equal(formatMoney(1234567.891, "USD", "pt"), `1${NBSP}234${NBSP}567,89${NBSP}$`);
  assert.equal(formatMoney(0, "EUR", "pt"), `0,00${NBSP}€`);
  assert.equal(formatMoney(-5, "EUR", "pt"), `-5,00${NBSP}€`);
  assert.equal(formatMoney(1500, "Kz", "pt"), `1${NBSP}500,00${NBSP}Kz`);
  assert.equal(formatMoney(2.175, "EUR", "pt"), `2,18${NBSP}€`);
  assert.equal(formatMoney(1234.5, "KWD", "pt"), `1${NBSP}234,500${NBSP}KWD`);
  assert.ok(!formatMoney(1234.5, "EUR", "pt").includes(NNBSP), "Portugal groups with U+00A0, not French U+202F");
});

test("Spanish and Arabic figures are the English figures, character for character", () => {
  for (const cur of CURRENCIES) {
    for (const v of VALUES) {
      const en = formatMoney(v, cur);
      assert.equal(formatMoney(v, cur, "es"), en, `es ${cur} ${v}`);
      assert.equal(formatMoney(v, cur, "ar"), en, `ar ${cur} ${v}`);
    }
  }
  for (const v of [0, 1, 1.5, 12.345, 1000, -3.2]) {
    assert.equal(formatFixed2(v, "es"), v.toFixed(2));
    assert.equal(formatFixed2(v, "ar"), v.toFixed(2));
    assert.equal(formatPercent(v, "es"), `${v.toFixed(2)}%`);
    assert.equal(formatPercent(v, "ar"), `${v.toFixed(2)}%`);
  }
});

test("roundShown is the figure every language starts from", () => {
  for (const v of VALUES) assert.equal(portugueseValue(formatMoney(v, "EUR", "pt")), roundShown(v));
});

test("quantities and rates in Portuguese: same digits, Portuguese punctuation", () => {
  for (const v of [0, 1, 1.5, 12.345, 1000, 1234567.891, -3.2]) {
    const pt = formatFixed2(v, "pt");
    assert.equal(Number(pt.replaceAll(NBSP, "").replace(",", ".")), Number(v.toFixed(2)), pt);
    assert.equal(formatPercent(v, "pt"), `${pt}%`);
  }
});

test("dates: the same calendar day in every language", () => {
  assert.equal(formatDate("2026-09-29", "pt"), `29${NBSP}set.${NBSP}2026`);
  assert.equal(formatDate("2026-02-01", "pt"), `1${NBSP}fev.${NBSP}2026`);
  assert.equal(formatDate("2026-09-29", "es"), `29${NBSP}sep.${NBSP}2026`);
  assert.equal(formatDate("2026-01-05", "es"), `5${NBSP}ene.${NBSP}2026`);
  assert.equal(formatDate("2026-09-29", "ar"), "29/09/2026");
  assert.equal(formatDate("05/09/2026", "ar"), "05/09/2026"); // day-first, as the app writes it
  assert.equal(formatDate("31/02/2026", "pt"), "31/02/2026"); // impossible: shown as written
  assert.equal(formatDate(null, "ar"), "—");
  assert.equal(formatDate("2026-09-29"), "Sep 29, 2026");
});

test("every written language has every label, non-empty, and the estimate's own words", () => {
  for (const [code, set, est] of [["pt", PT_LABELS, PT_ESTIMATE_LABELS], ["es", ES_LABELS, ES_ESTIMATE_LABELS], ["ar", AR_LABELS, AR_ESTIMATE_LABELS]] as const) {
    for (const k of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
      assert.ok(typeof set[k] === "string" && set[k].trim().length > 0, `${code}.${k}`);
      assert.ok(!set[k].includes("#"), `${code}.${k}: no English "#"`);
    }
    for (const k of Object.keys(ESTIMATE_LABELS) as (keyof typeof ESTIMATE_LABELS)[]) {
      if (ESTIMATE_LABELS[k] === LABELS[k]) continue;
      assert.ok(est[k]?.trim(), `${code} estimate.${k}`);
    }
    for (const k of ["footerGenerated", "footerScan"] as const) assert.ok(set[k].includes("Invotick"), `${code}.${k} names Invotick`);
    assert.deepEqual(LABEL_TRANSLATIONS[code], { ...set }, `the generated table's ${code} row IS the curated set`);
    assert.deepEqual(ESTIMATE_LABEL_TRANSLATIONS[code], { ...est });
  }
  assert.equal(PT_ESTIMATE_LABELS.invoice, "Orçamento");
  assert.equal(ES_ESTIMATE_LABELS.invoice, "Cotización");
  assert.equal(AR_ESTIMATE_LABELS.invoice, "عرض سعر");
});
