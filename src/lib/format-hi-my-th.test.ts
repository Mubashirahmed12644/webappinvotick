// Hindi, Burmese and Thai documents (wave 2 of decision 0187) write the SAME figures as the English one, character for
// character: India, Myanmar and Thailand all write `1,234.50` with Western digits in business. Only the words and the
// date change. If a figure ever differed from the English text, a client would be shown a different amount.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatFixed2, formatMoney, formatPercent } from "./format.ts";
import { LABELS, ESTIMATE_LABELS } from "./invoice-labels.ts";
import { HI_ESTIMATE_LABELS, HI_LABELS } from "./invoice-labels-hi.ts";
import { MY_ESTIMATE_LABELS, MY_LABELS } from "./invoice-labels-my.ts";
import { TH_ESTIMATE_LABELS, TH_LABELS } from "./invoice-labels-th.ts";
import { ESTIMATE_LABEL_TRANSLATIONS, LABEL_TRANSLATIONS } from "./invoice-labels-i18n.ts";

const NBSP = String.fromCharCode(0xa0);
const LANGS = ["hi", "my", "th"] as const;
const CURRENCIES = ["INR", "MMK", "THB", "USD", "EUR", "PKR", "LAK", "Rs", "K", "฿"];
const VALUES = [0, 0.004, 0.005, 1, 1.5, 12.345, 999.995, 1000, 1234.5, 1234567.891, -5, -1234.56];

test("Hindi, Burmese and Thai figures are the English figures, character for character", () => {
  for (const lang of LANGS) {
    for (const cur of CURRENCIES) {
      for (const v of VALUES) assert.equal(formatMoney(v, cur, lang), formatMoney(v, cur), `${lang} ${cur} ${v}`);
    }
    for (const v of [0, 1, 1.5, 12.345, 1000, -3.2]) {
      assert.equal(formatFixed2(v, lang), v.toFixed(2), `${lang} qty ${v}`);
      assert.equal(formatPercent(v, lang), `${v.toFixed(2)}%`, `${lang} rate ${v}`);
    }
  }
});

test("dates: the same calendar day, day first", () => {
  assert.equal(formatDate("2026-09-29", "hi"), "29/09/2026");
  assert.equal(formatDate("2026-01-05", "my"), "05/01/2026");
  assert.equal(formatDate("2026-09-29", "th"), `29${NBSP}ก.ย.${NBSP}2026`);
  assert.equal(formatDate("2026-05-01", "th"), `1${NBSP}พ.ค.${NBSP}2026`);
  assert.equal(formatDate("05/09/2026", "hi"), "05/09/2026"); // day-first, as the app writes it
  assert.equal(formatDate("31/02/2026", "th"), "31/02/2026"); // impossible: shown as written
  assert.equal(formatDate(null, "my"), "—");
});

test("every label exists, non-empty, and the generated table's rows ARE the curated sets", () => {
  for (const [code, set, est] of [["hi", HI_LABELS, HI_ESTIMATE_LABELS], ["my", MY_LABELS, MY_ESTIMATE_LABELS], ["th", TH_LABELS, TH_ESTIMATE_LABELS]] as const) {
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
  assert.equal(HI_ESTIMATE_LABELS.invoice, "कोटेशन");
  assert.equal(TH_ESTIMATE_LABELS.invoice, "ใบเสนอราคา");
  assert.equal(MY_ESTIMATE_LABELS.invoice, "ဈေးနှုန်းတင်ပြလွှာ");
});

test("Burmese is Unicode, never Zawgyi, and spells ဈေး the modern way", () => {
  const text = Object.values(MY_LABELS).join(" ") + Object.values(MY_ESTIMATE_LABELS).join(" ");
  // Zawgyi reuses U+1060–U+1097 (Mon/Shan letters in Unicode) for its stacked forms; no Burmese word needs them.
  assert.ok(!/[ၠ-႗]/.test(text), "Zawgyi code points");
  assert.ok(!text.includes("စျေး"), "old spelling စျေး");
});
