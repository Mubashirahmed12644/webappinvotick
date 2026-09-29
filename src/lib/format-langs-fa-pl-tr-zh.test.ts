// A document written in Persian, Polish, Turkish or Chinese (the second wave of decision 0187) writes the SAME
// figures as the English one. Polish re-punctuates them like Portuguese (`1 234,50 zł`), Turkish with a full stop
// between thousands (`1.234,50 ₺`, a rate `%20,00`), Persian and Chinese keep the app's own `1,234.50`. Every
// assertion reads the text back to a number and compares it with the English text's number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatFixed2, formatMoney, formatPercent } from "./format.ts";
import { LABELS, ESTIMATE_LABELS } from "./invoice-labels.ts";
import { FA_ESTIMATE_LABELS, FA_LABELS } from "./invoice-labels-fa.ts";
import { PL_ESTIMATE_LABELS, PL_LABELS } from "./invoice-labels-pl.ts";
import { TR_ESTIMATE_LABELS, TR_LABELS } from "./invoice-labels-tr.ts";
import { ZH_ESTIMATE_LABELS, ZH_LABELS } from "./invoice-labels-zh.ts";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n.ts";

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);

function englishValue(s: string): number {
  const neg = s.includes("-");
  const figures = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? ["NaN"];
  return (neg ? -1 : 1) * Number(figures[figures.length - 1].replaceAll(",", ""));
}

/** "1 234,50 zł" / "-5,00 €": only U+00A0 groups. */
function polishValue(s: string): number {
  const m = new RegExp(`^(-?)(\\d{1,3}(?:${NBSP}\\d{3})*)(?:,(\\d+))?${NBSP}\\S.*$`, "u").exec(s);
  assert.ok(m, `not a Polish amount: ${JSON.stringify(s)}`);
  const [, sign, int, frac] = m;
  return (sign ? -1 : 1) * Number(`${int.replaceAll(NBSP, "")}.${frac ?? "0"}`);
}

/** "1.234,50 ₺" / "-5,00 €": only a full stop groups. */
function turkishValue(s: string): number {
  const m = new RegExp(`^(-?)(\\d{1,3}(?:\\.\\d{3})*)(?:,(\\d+))?${NBSP}\\S.*$`, "u").exec(s);
  assert.ok(m, `not a Turkish amount: ${JSON.stringify(s)}`);
  const [, sign, int, frac] = m;
  return (sign ? -1 : 1) * Number(`${int.replaceAll(".", "")}.${frac ?? "0"}`);
}

const VALUES = [
  0, 0.004, 0.005, -0.005, 0.01, 0.1, 1, 1.005, 2.175, 2.185, 9.995, 10, 12.3, 99.99, 100, 999.995,
  1000, 1234.5, 1234.567, 12345.678, 99999.999, 100000, 1234567.89, 987654321.126, 1e9 + 0.5,
  -0.01, -1, -2.175, -1234.5, -999999.995, 58123.45, 3965.74, 14.5 * 0.15, 0.1 + 0.2,
];
// What these users invoice in: IRR, AFN (Persian); PLN, EUR, GBP (Polish); TRY, EUR (Turkish); CNY, TWD (Chinese);
// three- and zero-decimal currencies, and raw symbols the app passes.
const CURRENCIES = ["IRR", "AFN", "PLN", "EUR", "GBP", "TRY", "CNY", "TWD", "USD", "KWD", "JPY", "PKR", "€", "zł", "₺", "د.إ"];

test("every Polish and Turkish amount reads back as exactly the English amount", () => {
  for (const cur of CURRENCIES) {
    for (const v of [...VALUES, ...VALUES.map(String)]) {
      const en = formatMoney(v, cur);
      const pl = formatMoney(v, cur, "pl");
      const tr = formatMoney(v, cur, "tr");
      assert.equal(polishValue(pl), englishValue(en), `${cur} ${v}: en ${JSON.stringify(en)} pl ${JSON.stringify(pl)}`);
      assert.equal(turkishValue(tr), englishValue(en), `${cur} ${v}: en ${JSON.stringify(en)} tr ${JSON.stringify(tr)}`);
    }
  }
});

test("Polish and Turkish amounts: their own grouping, decimal comma, symbol after a no-break space", () => {
  assert.equal(formatMoney(1234.5, "PLN", "pl"), `1${NBSP}234,50${NBSP}zł`);
  assert.equal(formatMoney(-5, "EUR", "pl"), `-5,00${NBSP}€`);
  assert.ok(!formatMoney(1234.5, "EUR", "pl").includes(NNBSP), "Poland groups with U+00A0");
  assert.equal(formatMoney(1234.5, "TRY", "tr"), `1.234,50${NBSP}₺`);
  assert.equal(formatMoney(1234567.891, "EUR", "tr"), `1.234.567,89${NBSP}€`);
  assert.equal(formatMoney(0, "EUR", "tr"), `0,00${NBSP}€`);
  assert.equal(formatMoney(1234.5, "KWD", "tr"), `1.234,500${NBSP}KWD`);
});

test("Persian and Chinese figures are the English figures, character for character", () => {
  for (const cur of CURRENCIES) {
    for (const v of VALUES) {
      const en = formatMoney(v, cur);
      assert.equal(formatMoney(v, cur, "fa"), en, `fa ${cur} ${v}`);
      assert.equal(formatMoney(v, cur, "zh"), en, `zh ${cur} ${v}`);
    }
  }
  for (const v of [0, 1, 1.5, 12.345, 1000, -3.2]) {
    for (const lang of ["fa", "zh"] as const) {
      assert.equal(formatFixed2(v, lang), v.toFixed(2));
      assert.equal(formatPercent(v, lang), `${v.toFixed(2)}%`);
    }
  }
});

test("quantities and rates: same digits, each language's punctuation", () => {
  for (const v of [0, 1, 1.5, 12.345, 1000, 1234567.891, -3.2]) {
    const pl = formatFixed2(v, "pl");
    assert.equal(Number(pl.replaceAll(NBSP, "").replace(",", ".")), Number(v.toFixed(2)), pl);
    assert.equal(formatPercent(v, "pl"), `${pl}%`);
    const tr = formatFixed2(v, "tr");
    assert.equal(Number(tr.replaceAll(".", "").replace(",", ".")), Number(v.toFixed(2)), tr);
    assert.equal(formatPercent(v, "tr"), `%${tr}`);
  }
});

test("dates: the same calendar day in every language", () => {
  assert.equal(formatDate("2026-09-29", "fa"), "2026/09/29");
  assert.equal(formatDate("2026-09-29", "pl"), "29.09.2026");
  assert.equal(formatDate("2026-02-01", "tr"), "01.02.2026");
  assert.equal(formatDate("2026-09-05", "zh"), "2026年9月5日");
  assert.equal(formatDate("05/09/2026", "zh"), "2026年9月5日"); // day-first, as the app writes it
  assert.equal(formatDate("31/02/2026", "pl"), "31/02/2026"); // impossible: shown as written
  assert.equal(formatDate(null, "fa"), "—");
});

test("every second-wave language has every label, non-empty, and the estimate's own words", () => {
  for (const [code, set, est] of [
    ["fa", FA_LABELS, FA_ESTIMATE_LABELS], ["pl", PL_LABELS, PL_ESTIMATE_LABELS],
    ["tr", TR_LABELS, TR_ESTIMATE_LABELS], ["zh", ZH_LABELS, ZH_ESTIMATE_LABELS],
  ] as const) {
    const words = set as Record<string, string>;
    for (const k of Object.keys(LABELS)) {
      assert.ok(typeof words[k] === "string" && words[k].trim().length > 0, `${code}.${k}`);
      assert.ok(!words[k].includes("#"), `${code}.${k}: no English "#"`);
    }
    for (const k of Object.keys(ESTIMATE_LABELS) as (keyof typeof ESTIMATE_LABELS)[]) {
      if (ESTIMATE_LABELS[k] === LABELS[k]) continue;
      assert.ok(est[k]?.trim(), `${code} estimate.${k}`);
    }
    for (const k of ["footerGenerated", "footerScan"] as const) assert.ok(set[k].includes("Invotick"), `${code}.${k} names Invotick`);
    assert.deepEqual(LABEL_TRANSLATIONS[code], { ...set }, `the generated table's ${code} row IS the curated set`);
    assert.deepEqual(ESTIMATE_LABEL_TRANSLATIONS[code], { ...est });
  }
  // The share page's picker lists Chinese as "zh-CN": the same hand-written words.
  assert.deepEqual(LABEL_TRANSLATIONS["zh-CN"], { ...ZH_LABELS });
  assert.deepEqual(ESTIMATE_LABEL_TRANSLATIONS["zh-CN"], { ...ZH_ESTIMATE_LABELS });
  assert.equal(PL_ESTIMATE_LABELS.invoice, "Wycena");
  assert.equal(TR_ESTIMATE_LABELS.invoice, "Fiyat Teklifi");
  assert.equal(FA_ESTIMATE_LABELS.invoice, "پیش‌فاکتور");
  assert.equal(ZH_ESTIMATE_LABELS.invoice, "报价单");
});
