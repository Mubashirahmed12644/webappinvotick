/**
 * Apply the human-verified corrections to the generated label tables, without calling the network.
 *
 * `generate-label-translations.mjs` fetches 24 languages and is the right tool when the LABEL SET
 * changes. This one is for when only the corrections change: it reads the tables that are already
 * committed, merges `invoice-labels-overrides.ts` over them, repairs the brand name, and rewrites
 * both the web table and the app's Kotlin copy from the same data.
 *
 * ## The guard at the bottom is the point
 *
 * An earlier attempt at this ran as a one-liner, its regex escaping was mangled by the shell, the
 * parse silently returned `{}` — and it wrote two empty tables over 1,776 committed translations.
 * Git had them, so nothing was lost. Nothing about the failure was visible until afterwards, which
 * is the part worth engineering against: this refuses to write anything if the parse produced less
 * than it read.
 *
 *   node scripts/apply-label-overrides.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const WEB_TABLE = "src/lib/invoice-labels-i18n.ts";
const OVERRIDES = "src/lib/invoice-labels-overrides.ts";
const APP_TABLE =
  "/Users/ahmedmubashir/Documents/invoice-kmp-app/core/common/src/commonMain/kotlin/" +
  "invotick/invoicemaker/core/common/model/InvoiceLabelTranslations.kt";

/** The generated file writes JSON-shaped objects, so they can be parsed as JSON. */
function readGenerated(src, name) {
  const start = src.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(src.slice(open, i + 1));
    }
  }
  throw new Error(`${name}: unbalanced braces`);
}

/** The overrides file is TypeScript — unquoted keys — so it is parsed, not JSON.parse'd. */
function readOverrides(src) {
  const start = src.indexOf("LABEL_TRANSLATION_OVERRIDES");
  const open = src.indexOf("{", start);
  const out = {};
  let i = open + 1;
  while (i < src.length) {
    const lang = /\s*"([\w-]+)":\s*\{/y;
    lang.lastIndex = i;
    const m = lang.exec(src);
    if (!m) break;
    let j = lang.lastIndex, depth = 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const body = src.slice(lang.lastIndex, j - 1);
    out[m[1]] = Object.fromEntries(
      [...body.matchAll(/^\s*(\w+):\s*"((?:[^"\\]|\\.)*)"/gm)].map((e) => [e[1], e[2]]),
    );
    i = j;
    const comma = /\s*,\s*/y;
    comma.lastIndex = i;
    if (comma.exec(src)) i = comma.lastIndex;
  }
  return out;
}

const genSrc = readFileSync(WEB_TABLE, "utf8");
const table = readGenerated(genSrc, "LABEL_TRANSLATIONS");
const estimate = readGenerated(genSrc, "ESTIMATE_LABEL_TRANSLATIONS");
const overrides = readOverrides(readFileSync(OVERRIDES, "utf8"));

const before = Object.values(table).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`read ${Object.keys(table).length} languages / ${before} strings`);
console.log(`overrides for ${Object.keys(overrides).length} languages`);

// The brand name is a proper noun. Translation ate the k in zh-CN, th, nl and ne, and produced
// "Invotik" in ms. A company's name is not a word to translate; it is how people find the app.
// The transliterations into Devanagari, Bengali, Gujarati and Ethiopic are out of a Latin
// pattern's reach and are fixed by hand in the overrides instead.
const BRAND = /\bInvot[a-zA-Z]{0,4}\b/g;
let brandFixed = 0;
let applied = 0;
for (const code of Object.keys(table)) {
  for (const k of Object.keys(table[code])) {
    const fixed = table[code][k].replace(BRAND, "Invotick");
    if (fixed !== table[code][k]) {
      table[code][k] = fixed;
      brandFixed++;
    }
  }
  const ov = overrides[code];
  if (ov) {
    Object.assign(table[code], ov);
    applied += Object.keys(ov).length;
  }
}

const after = Object.values(table).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`brand name repaired in ${brandFixed} strings`);
console.log(`corrections applied: ${applied}`);

// ── Refuse to write a table smaller than the one that was read ──────────────────────────────
if (after < before || Object.keys(table).length < 20 || after < 700) {
  console.error(
    `REFUSING TO WRITE: parsed ${Object.keys(table).length} languages / ${after} strings, ` +
      `read ${before}. Something did not parse.`,
  );
  process.exit(1);
}
if (applied === 0) {
  console.error("REFUSING TO WRITE: zero corrections applied — the overrides did not parse.");
  process.exit(1);
}

const head = genSrc.slice(0, genSrc.indexOf("export const LABEL_TRANSLATIONS"));
writeFileSync(
  WEB_TABLE,
  head +
    `export const LABEL_TRANSLATIONS: Record<string, Partial<InvoiceLabels>> = ${JSON.stringify(table, null, 2)};\n\n` +
    `// Only the strings an ESTIMATE says differently. Merged OVER the invoice table when the document\n` +
    `// is an estimate — otherwise a translated estimate is headed "Invoice" in every language, which\n` +
    `// tells a client they have been billed for something they were only quoted.\n` +
    `export const ESTIMATE_LABEL_TRANSLATIONS: Record<string, Partial<InvoiceLabels>> = ${JSON.stringify(estimate, null, 2)};\n`,
);
console.log(`wrote ${WEB_TABLE}`);

const ktMap = (obj) =>
  Object.entries(obj)
    .map(
      ([code, labels]) =>
        `    "${code}" to mapOf(\n` +
        Object.entries(labels)
          .map(([k, v]) => `        "${k}" to ${JSON.stringify(v)},`)
          .join("\n") +
        `\n    ),`,
    )
    .join("\n");

writeFileSync(
  APP_TABLE,
  `package invotick.invoicemaker.core.common.model

// GENERATED — do not edit by hand. Corrections belong in
// Webinvotick/src/lib/invoice-labels-overrides.ts, because this file is overwritten whole.
//
// The invoice labels, pre-translated. The app renders them without asking anyone, which is the
// point: they are fixed strings, and sending them to a translation service per document was the
// bulk of the traffic through a rate-limited endpoint.
//
// Emitted from the SAME data as the web table, so the two cannot drift apart. If they did, the
// sender would preview a wording the receiver never sees.
//
// The values below carry ${applied} human corrections from a per-language review of every label in an
// invoice context — see the overrides file for what was wrong and why.
val INVOICE_LABEL_TRANSLATIONS: Map<String, Map<String, String>> = mapOf(
${ktMap(table)}
)

/** Only what an ESTIMATE says differently — merged over the map above when documentType is ESTIMATE. */
val ESTIMATE_LABEL_TRANSLATIONS: Map<String, Map<String, String>> = mapOf(
${ktMap(estimate)}
)
`,
);
console.log(`wrote ${APP_TABLE}`);
