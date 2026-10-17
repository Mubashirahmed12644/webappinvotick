import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestEmailFix } from "./emailTypo.ts";

/**
 * The 60-row table of kaam/research/otp-wrong-email-spec.md section 1.3, in the spec's order. The app
 * encodes the same rows in EmailTypoSuggestionTest.kt; the two must never drift apart.
 * Row 53 uses an escape for the Cyrillic "a", so an editor cannot silently turn it into a Latin one.
 */
const ROWS: Array<[number, string, string | null]> = [
  [1, "ahmad.raza@gmial.com", "ahmad.raza@gmail.com"],
  [2, "ahmad.raza@gmail.con", "ahmad.raza@gmail.com"],
  [3, "sana@gamil.com", "sana@gmail.com"],
  [4, "sana@gmail.co", "sana@gmail.com"],
  [5, "sana@gmail.cmo", "sana@gmail.com"],
  [6, "sana@gmail.comm", "sana@gmail.com"],
  [7, "sana@gmial.con", "sana@gmail.com"],
  [8, "sana@gnail.com", "sana@gmail.com"],
  [9, "sana@gmai.com", "sana@gmail.com"],
  [10, "sana@gmaill.com", "sana@gmail.com"],
  [11, "bilal@hotmial.com", "bilal@hotmail.com"],
  [12, "bilal@hotmail.con", "bilal@hotmail.com"],
  [13, "bilal@hotmial.con", "bilal@hotmail.com"],
  [14, "bilal@hormail.com", "bilal@hotmail.com"],
  [15, "bilal@hotmai.co", "bilal@hotmail.com"],
  [16, "zara@yaho.com", "zara@yahoo.com"],
  [17, "zara@yahooo.com", "zara@yahoo.com"],
  [18, "zara@yahoo.con", "zara@yahoo.com"],
  [19, "omar@outlok.com", "omar@outlook.com"],
  [20, "omar@outlook.con", "omar@outlook.com"],
  [21, "omar@outllok.com", "omar@outlook.com"],
  [22, "lina@icloud.con", "lina@icloud.com"],
  [23, "lina@iclod.com", "lina@icloud.com"],
  [24, "lina@icluod.com", "lina@icloud.com"],
  [25, "tom@live.con", "tom@live.com"],
  [26, "tom@aol.con", "tom@aol.com"],
  [27, "eva@protonmial.com", "eva@protonmail.com"],
  [28, "eva@protn.me", "eva@proton.me"],
  [29, "Ahmed.Raza@GMIAL.COM", "Ahmed.Raza@gmail.com"], // local case kept
  [30, "ahmed+invoices@gmial.com", "ahmed+invoices@gmail.com"], // plus-tag kept
  [31, "  ahmed@gmial.com  ", "ahmed@gmail.com"], // spaces at both ends
  [32, "ahmed@gmail.com", null], // already right
  [33, "ahmed@GMAIL.COM", null], // already right (case only)
  [34, "ahmed@protonmail.com", null], // a provider
  [35, "ahmed@proton.me", null], // a provider
  [36, "ahmed@gmail.com.pk", null], // three labels
  [37, "info@giftat.com.pk", null], // company domain, three labels
  [38, "accounts@acme-traders.com", null], // company domain, far from every provider
  [39, "ahmed@yahoo.co.uk", null], // real regional domain, three labels
  [40, "ahmed@hotmail.fr", null], // ending too far from com
  [41, "ahmed@outlook.de", null], // same
  [42, "ahmed@yandex.ru", null], // same
  [43, "ahmed@mail.com", null], // KNOWN_REAL (would otherwise become gmail)
  [44, "ahmed@email.com", null], // KNOWN_REAL
  [45, "ahmed@cloud.com", null], // KNOWN_REAL (would otherwise become icloud)
  [46, "ahmed@life.com", null], // live is 4 letters: only its ending may be fixed
  [47, "ahmed@aoll.com", null], // aol is 3 letters: same (accepted miss)
  [48, "ahmed@hmail.com", null], // tie between gmail and ymail
  [49, "ahmed@zoho.com", null], // real, far from yahoo
  [50, "ahmed@gmx.de", null], // real, not near any provider
  [51, "ahmed@googlemail.com", null], // real, far from gmail
  [52, "ahmed@gmail.net", null], // ending 3 steps from com (accepted miss)
  [53, "ahmed@gmаil.com", null], // Cyrillic a: non-ASCII
  [54, "ahmed@xn--gmil-6na.com", null], // punycode / IDN
  [55, "ahmed@gmail.com.", null], // trailing dot = empty third label
  [56, "ahmed@gmail", null], // one label
  [57, "ahmed.gmail.com", null], // no @
  [58, "@gmial.com", null], // empty local part
  [59, "a@b@gmial.com", null], // two @
  [60, "", null], // nothing typed
];

test("the table has the sixty rows of the spec, numbered 1 to 60 in order", () => {
  assert.equal(ROWS.length, 60);
  ROWS.forEach(([n], i) => assert.equal(n, i + 1));
  assert.equal(ROWS.filter(([, , out]) => out !== null).length, 31);
  assert.equal(ROWS.filter(([, , out]) => out === null).length, 29);
});

test("row 53 really holds a Cyrillic letter, not a Latin a", () => {
  const typed = ROWS[52][1];
  assert.ok(/[^\x00-\x7f]/.test(typed));
});

test("the sixty rows of the spec table hold", () => {
  for (const [n, typed, expected] of ROWS) {
    assert.equal(suggestEmailFix(typed), expected, `row ${n}: ${JSON.stringify(typed)}`);
  }
});

test("the local part is returned byte for byte", () => {
  assert.equal(suggestEmailFix("A.b+C_d@gmial.con"), "A.b+C_d@gmail.com");
});

test("a suggestion is never suggested again: the corrected address returns null", () => {
  for (const [, typed, expected] of ROWS) {
    if (expected !== null) assert.equal(suggestEmailFix(expected), null, expected);
    void typed;
  }
});

test("it never throws on odd input", () => {
  for (const s of ["@", "@@", " ", "a@", "@a", "a@.", "a@.com", "a@com.", "\n", "a@b.c.d"]) {
    assert.doesNotThrow(() => suggestEmailFix(s));
  }
  assert.doesNotThrow(() => suggestEmailFix(undefined as unknown as string));
});
