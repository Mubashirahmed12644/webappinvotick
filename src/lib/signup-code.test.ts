import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digitsOnly,
  emailKey,
  helpIsDue,
  secondsLeft,
  secondsSince,
  RESEND_COOLDOWN_SECONDS,
} from "./signup-code.ts";

test("only digits are kept, in typing order", () => {
  assert.equal(digitsOnly("482917"), "482917");
  assert.equal(digitsOnly("4a8b2c"), "482");
  assert.equal(digitsOnly(""), "");
});

test("a pasted code with spaces or dashes works", () => {
  assert.equal(digitsOnly("482 917"), "482917");
  assert.equal(digitsOnly(" 482-917\n"), "482917");
});

test("a code longer than six digits is cut at six", () => {
  assert.equal(digitsOnly("48291755"), "482917");
});

test("Arabic-Indic, Persian and full-width digits become ASCII", () => {
  assert.equal(digitsOnly("٤٨٢٩١٧"), "482917");
  assert.equal(digitsOnly("۴۸۲۹۱۷"), "482917");
  assert.equal(digitsOnly("４８２９１７"), "482917");
});

test("the remembered key ignores case and spaces", () => {
  assert.equal(emailKey("  Ahmad.Raza@Gmail.com "), "ahmad.raza@gmail.com");
});

test("the resend wait counts down from sixty and stops at zero", () => {
  assert.equal(secondsLeft(1000, 1000, RESEND_COOLDOWN_SECONDS), 60);
  assert.equal(secondsLeft(1000, 1000 + 12_500, RESEND_COOLDOWN_SECONDS), 48);
  assert.equal(secondsLeft(1000, 1000 + 60_000, RESEND_COOLDOWN_SECONDS), 0);
  assert.equal(secondsLeft(1000, 1000 + 600_000, RESEND_COOLDOWN_SECONDS), 0);
  assert.equal(secondsLeft(5000, 1000, RESEND_COOLDOWN_SECONDS), 60); // clock went backwards
});

test("seconds since never goes negative", () => {
  assert.equal(secondsSince(5000, 1000), 0);
  assert.equal(secondsSince(1000, 31_999), 30);
});

test("the help is due at thirty seconds, and never when a digit was typed", () => {
  assert.equal(helpIsDue(29, false), false);
  assert.equal(helpIsDue(30, false), true);
  assert.equal(helpIsDue(45, true), false);
});
