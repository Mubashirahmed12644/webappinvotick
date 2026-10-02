// BALANCE DUE on an invoice paid past its total (owner's decision, 2026-09-30): the negative figure in brackets,
// as the app's invoice card writes it — `Rs(1,500.00)` — never `Rs0.00` and never a minus sign. Every other balance
// is formatMoney's output, byte for byte, in every language a document can be written in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBalanceDue, formatMoney, type FigureLanguage } from "./format.ts";

const LANGS: FigureLanguage[] = ["en", "fr", "pt", "es", "ar", "de", "fa", "hi", "id", "my", "nl", "pl", "sv", "th", "tr", "zh"];
const CURRENCIES = ["Rs", "PKR", "USD", "EUR", "INR", "JPY", "KWD", "SAR", "د.إ", "€", "$"];

test("the owner's example: total Rs658.00, paid Rs2,158.00 → BALANCE DUE Rs(1,500.00)", () => {
  assert.equal(formatBalanceDue(658 - 2158, "Rs"), "Rs(1,500.00)");
  assert.equal(formatBalanceDue(-1500, "PKR"), "Rs(1,500.00)");
  assert.equal(formatBalanceDue(-1500, "USD"), "$(1,500.00)");
});

test("a balance that is owed, or zero, is formatMoney's own output in every language", () => {
  for (const lang of LANGS) {
    for (const cur of CURRENCIES) {
      for (const v of [0, 0.004, 0.01, 12.5, 1500, 2965.74, 1234567.891, "1500.00", "0"]) {
        assert.equal(formatBalanceDue(v, cur, lang), formatMoney(v, cur, lang), `${lang} ${cur} ${v}`);
      }
    }
  }
});

test("a negative that rounds to zero on the page is shown as the zero it rounds to, not as brackets", () => {
  assert.equal(formatBalanceDue(-0.004, "Rs"), formatMoney(-0.004, "Rs"));
  assert.ok(!formatBalanceDue(-0.004, "Rs").includes("("));
});

test("an advance: the same figure as the positive amount, in brackets, symbol where the language puts it", () => {
  for (const lang of LANGS) {
    for (const cur of CURRENCIES) {
      for (const v of [0.01, 1500, 2965.745, 1234567.891]) {
        const positive = formatMoney(v, cur, lang);
        const shown = formatBalanceDue(-v, cur, lang);
        assert.ok(!shown.includes("-"), `${lang} ${cur} ${v}: no minus sign in ${shown}`);
        assert.equal(shown.replace("(", "").replace(")", ""), positive, `${lang} ${cur} ${v}: same figure as ${positive}`);
        const open = shown.indexOf("(");
        const close = shown.indexOf(")");
        assert.ok(open >= 0 && close > open, `${lang} ${cur} ${v}: brackets in ${shown}`);
        assert.match(shown[open + 1], /\d/, `${lang} ${cur}: bracket opens on the figure`);
        assert.match(shown[close - 1], /\d/, `${lang} ${cur}: bracket closes on the figure`);
      }
    }
  }
});

test("the symbol stays outside the brackets, on its own side", () => {
  const NBSP = " ";
  const NNBSP = " ";
  assert.equal(formatBalanceDue(-1500, "EUR", "fr"), `(1${NNBSP}500,00)${NBSP}€`);
  assert.equal(formatBalanceDue(-1500, "EUR", "nl"), `€${NBSP}(1.500,00)`);
  assert.equal(formatBalanceDue(-1500, "JPY"), "¥(1,500)");
  assert.equal(formatBalanceDue(-1500, "Rs", "ar"), "Rs(1,500.00)");
});
