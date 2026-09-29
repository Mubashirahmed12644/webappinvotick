// Wave 2 (2026-09-29): a document written in German, Swedish, Dutch or Indonesian writes the SAME figures as the
// English one, re-punctuated: German `1.234,50 €`, Swedish `1 234,50 kr`, Dutch `€ 1.234,50`, Indonesian `Rp1.234,50`.
// Every assertion reads the text back to a number and compares it with the English text's number: if the two ever
// read differently, a client is shown a different amount.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatFixed2, formatMoney, formatPercent, symbolFirst } from "./format.ts";
import { LABELS, ESTIMATE_LABELS } from "./invoice-labels.ts";
import { DE_ESTIMATE_LABELS, DE_LABELS } from "./invoice-labels-de.ts";
import { ID_ESTIMATE_LABELS, ID_LABELS } from "./invoice-labels-id.ts";
import { NL_ESTIMATE_LABELS, NL_LABELS } from "./invoice-labels-nl.ts";
import { SV_ESTIMATE_LABELS, SV_LABELS } from "./invoice-labels-sv.ts";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n.ts";

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);

function englishValue(s: string): number {
  const neg = s.includes("-");
  const figures = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? ["NaN"];
  return (neg ? -1 : 1) * Number(figures[figures.length - 1].replaceAll(",", ""));
}

/** The one figure in [s], grouped by [group] with a decimal comma. More than one figure is a failure. */
function localValue(s: string, group: string): number {
  const g = group === "." ? "\\." : group;
  const runs = s.match(new RegExp(`\\d{1,3}(?:${g}\\d{3})*(?:,\\d+)?`, "g")) ?? [];
  assert.equal(runs.length, 1, `one figure in ${JSON.stringify(s)}`);
  const [int, frac = "0"] = runs[0].split(",");
  return (s.includes("-") ? -1 : 1) * Number(`${int.split(group).join("")}.${frac}`);
}

const VALUES = [
  0, 0.004, 0.005, -0.005, 0.01, 0.1, 1, 1.005, 2.175, 2.185, 9.995, 10, 12.3, 99.99, 100, 999.995,
  1000, 1234.5, 1234.567, 12345.678, 99999.999, 100000, 1234567.89, 987654321.126, 1e9 + 0.5,
  -0.01, -1, -2.175, -1234.5, -999999.995, 58123.45, 3965.74, 14.5 * 0.15, 0.1 + 0.2,
];
// The currencies these phones invoice in (EUR, SEK, SRD, IDR, USD for Timor-Leste), three- and zero-decimal ones, the
// app's own symbols and raw symbols the app passes.
const CURRENCIES = ["EUR", "SEK", "SRD", "IDR", "USD", "CHF", "GBP", "KWD", "JPY", "PKR", "€", "kr", "Rp", "Rs.", "د.إ"];
const GROUP = { de: ".", sv: NBSP, nl: ".", id: "." } as const;

test("every German, Swedish, Dutch and Indonesian amount reads back as exactly the English amount", () => {
  for (const cur of CURRENCIES) {
    for (const v of [...VALUES, ...VALUES.map(String)]) {
      const en = formatMoney(v, cur);
      for (const lang of ["de", "sv", "nl", "id"] as const) {
        const shown = formatMoney(v, cur, lang);
        assert.equal(localValue(shown, GROUP[lang]), englishValue(en), `${lang} ${cur} ${v}: en ${JSON.stringify(en)} ${lang} ${JSON.stringify(shown)}`);
        assert.ok(!shown.includes(NNBSP), `${lang}: no French narrow space in ${JSON.stringify(shown)}`);
      }
    }
  }
});

test("the shapes: German and Swedish put the symbol after, Dutch and Indonesian keep it in front", () => {
  assert.equal(formatMoney(1234.5, "EUR", "de"), `1.234,50${NBSP}€`);
  assert.equal(formatMoney(-5, "EUR", "de"), `-5,00${NBSP}€`);
  assert.equal(formatMoney(1234567.891, "USD", "de"), `1.234.567,89${NBSP}$`);
  assert.equal(formatMoney(1234.5, "kr", "sv"), `1${NBSP}234,50${NBSP}kr`);
  assert.equal(formatMoney(1234.5, "EUR", "nl"), `€${NBSP}1.234,50`);
  assert.equal(formatMoney(-5, "EUR", "nl"), `€${NBSP}-5,00`); // the app's own "€-5.00", sign kept in place
  assert.equal(formatMoney(1234.5, "Rp", "id"), "Rp1.234,50");
  assert.equal(formatMoney(1500000, "Rp", "id"), "Rp1.500.000,00");
  assert.equal(symbolFirst("-$5.00", NBSP), `-$${NBSP}5,00`);
  assert.equal(symbolFirst("INV-0042", NBSP), "INV-0042", "an identifier is never re-punctuated");
  assert.equal(symbolFirst("12 of 1,234.50", ""), "12 of 1,234.50", "two figures: left exactly as the English");
});

test("quantities and rates", () => {
  for (const v of [0, 1, 1.5, 12.345, 1000, 1234567.891, -3.2]) {
    for (const lang of ["de", "sv", "nl", "id"] as const) {
      const q = formatFixed2(v, lang);
      assert.equal(localValue(q, GROUP[lang]), Number(v.toFixed(2)), `${lang} ${q}`);
    }
  }
  assert.equal(formatPercent(19, "de"), `19,00${NBSP}%`);
  assert.equal(formatPercent(25, "sv"), `25,00${NBSP}%`);
  assert.equal(formatPercent(21, "nl"), "21,00%");
  assert.equal(formatPercent(11, "id"), "11,00%");
});

test("dates: the same calendar day, each country's own way", () => {
  assert.equal(formatDate("2026-09-29", "de"), "29.09.2026");
  assert.equal(formatDate("05/09/2026", "de"), "05.09.2026"); // day-first, as the app writes it
  assert.equal(formatDate("2026-09-29", "sv"), "2026-09-29");
  assert.equal(formatDate("2026-03-01", "nl"), `1${NBSP}mrt.${NBSP}2026`);
  assert.equal(formatDate("2026-08-17", "id"), `17${NBSP}Agu${NBSP}2026`);
  assert.equal(formatDate("31/02/2026", "de"), "31/02/2026"); // impossible: shown as written
  assert.equal(formatDate(null, "sv"), "—");
});

test("every wave 2 language has every label, and the table's rows are the curated sets", () => {
  const sets = [["de", DE_LABELS, DE_ESTIMATE_LABELS], ["id", ID_LABELS, ID_ESTIMATE_LABELS], ["nl", NL_LABELS, NL_ESTIMATE_LABELS], ["sv", SV_LABELS, SV_ESTIMATE_LABELS]] as const;
  for (const [code, set, est] of sets) {
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
  assert.equal(DE_ESTIMATE_LABELS.invoice, "Angebot");
  assert.equal(NL_ESTIMATE_LABELS.invoice, "Offerte");
  assert.equal(SV_ESTIMATE_LABELS.invoice, "Offert");
  assert.equal(DE_LABELS.colTax, "MwSt.");
});
