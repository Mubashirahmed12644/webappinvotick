/**
 * Pre-translate the 31 invoice labels into every supported language, ONCE, into a committed file.
 *
 * The labels are fixed — "Invoice", "Due Date", "Subtotal" and so on never change per document — yet
 * every translation request was sending all 31 of them again. For a typical invoice that is 31 of
 * roughly 40 strings: the overwhelming majority of the traffic through a rate-limited endpoint, spent
 * re-translating the same words for every user, every time.
 *
 * Doing it here instead makes them free forever, and reviewable: the output is a normal source file
 * a human can read and correct, which a runtime cache never is.
 *
 * Run against a local dev server (so the batching and the endpoint are the same ones production uses):
 *   node scripts/generate-label-translations.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";

// Read the label keys/values straight out of the source so this cannot drift from LABELS.
const src = readFileSync("src/lib/invoice-labels.ts", "utf8");
const block = src.match(/export const LABELS[^{]*\{([\s\S]*?)\n\};/);
if (!block) throw new Error("Could not find LABELS in src/lib/invoice-labels.ts");
const entries = [...block[1].matchAll(/^\s*(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/gm)].map((m) => [m[1], m[2]]);
if (!entries.length) throw new Error("Parsed zero labels");

// Some labels are abbreviations on screen and must NOT be sent to a translator as such — "Disc"
// came back as "optical disc" across 18 languages, sitting over the discount column of an invoice.
// LABEL_TRANSLATION_SOURCE gives the unambiguous phrase to translate instead; the rendered label
// stays short because only the TRANSLATION is taken from the longer wording.
const srcBlock = src.match(/export const LABEL_TRANSLATION_SOURCE[^{]*\{([\s\S]*?)\n\};/);
const SOURCE = Object.fromEntries(
  [...(srcBlock?.[1] ?? "").matchAll(/^\s*(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/gm)].map((m) => [m[1], m[2]]),
);
const toTranslate = entries.map(([k, v]) => SOURCE[k] ?? v);
console.log(`${Object.keys(SOURCE).length} labels sent with an unambiguous wording:`,
  Object.entries(SOURCE).map(([k, v]) => `${k}="${v}"`).join(", "));

// The five strings an ESTIMATE overrides. Without these a translated estimate says INVOICE in every
// language — the document tells the client they have been billed for something they were quoted.
const estBlock = src.match(/export const ESTIMATE_LABELS[^{]*\{([\s\S]*?)\n\};/);
const estEntries = [...(estBlock?.[1] ?? "").matchAll(/^\s*(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/gm)]
  .map((m) => [m[1], m[2]]);
console.log(`${estEntries.length} estimate overrides:`, estEntries.map(([k]) => k).join(", "));

// Human-verified corrections. Merged OVER the machine output, and the reason they live in their own
// file is that THIS script overwrites its output whole — a correction made in the generated file
// survives exactly until the next run. 271 of them came out of a per-language review; losing those
// to a regeneration would be losing the only part of this table anybody actually checked.
const overridesSrc = readFileSync("src/lib/invoice-labels-overrides.ts", "utf8");
const OVERRIDES = {};
for (const m of overridesSrc.matchAll(/"([\w-]+)":\s*\{([\s\S]*?)\n  \}/g)) {
  OVERRIDES[m[1]] = Object.fromEntries(
    [...m[2].matchAll(/^\s*(\w+):\s*"((?:[^"\\]|\\.)*)"/gm)].map((e) => [e[1], e[2]]),
  );
}
console.log(`${Object.keys(OVERRIDES).length} languages carry human corrections`);

const langBlock = readFileSync("src/lib/translate.ts", "utf8").match(/export const LANGUAGES[^[]*\[([\s\S]*?)\n\];/);
const codes = [...langBlock[1].matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]).filter((c) => c !== "en");

console.log(`${entries.length} labels × ${codes.length} languages`);

const out = {};
const estOut = {};
for (const code of codes) {
  const res = await fetch(`${ORIGIN}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: toTranslate, target: code }),
  });
  const json = await res.json();
  const texts = json?.texts;
  if (!Array.isArray(texts) || texts.length !== entries.length) {
    console.warn(`  ${code}: FAILED (${texts?.length ?? "no"} of ${entries.length}) — skipped`);
    continue;
  }
  // A language is only written if EVERY label came back. A partial set would leave some labels in
  // English and some translated on the same document, which reads as a rendering bug.
  out[code] = Object.fromEntries(entries.map(([k], i) => [k, texts[i] || entries[i][1]]));

  // The brand name is a proper noun and must survive verbatim. Translation mangled it in nine
  // languages — "Invotic" with the k eaten in zh-CN, th, nl and ne, "Invotik" in ms, and
  // transliterated into local script in hi, bn, gu and am. A company's name is not a word to
  // translate; it is how people find the app in a store.
  for (const k of Object.keys(out[code])) {
    // Any Latin-script near-miss becomes the real thing. The transliterations into Devanagari,
    // Bengali, Gujarati and Ethiopic are not reachable by a Latin pattern and are corrected by hand
    // in the overrides file instead.
    out[code][k] = out[code][k].replace(/\bInvot[a-zA-Z]{0,4}\b/g, "Invotick");
  }

  // Human corrections win over everything above.
  Object.assign(out[code], OVERRIDES[code] ?? {});

  // Second, much smaller batch for the estimate's own wording.
  const estRes = await fetch(`${ORIGIN}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: estEntries.map(([, v]) => v), target: code }),
  });
  const estTexts = (await estRes.json())?.texts;
  if (Array.isArray(estTexts) && estTexts.length === estEntries.length) {
    estOut[code] = Object.fromEntries(estEntries.map(([k], i) => [k, estTexts[i] || estEntries[i][1]]));
  } else {
    console.warn(`  ${code}: estimate overrides FAILED — that language will say "invoice" on estimates`);
  }
  console.log(`  ${code}: ok (${texts[0]} / ${estOut[code]?.invoice ?? "—"})`);
  await new Promise((r) => setTimeout(r, 400)); // be a good citizen of a free endpoint
}

const file = `// GENERATED by scripts/generate-label-translations.mjs — do not edit by hand.
//
// The 31 invoice labels, pre-translated into every supported language. They are fixed strings, so
// translating them per request meant re-sending the same 31 words through a rate-limited endpoint
// for every user and every document — the bulk of the traffic, spent on text that never changes.
//
// Corrections are welcome and belong in the generator's OUTPUT, not in a runtime patch: regenerate,
// then edit here if a machine translation is wrong. A human fix committed next to the machine's is
// exactly what a runtime cache cannot give you.
import type { InvoiceLabels } from "./invoice-labels";

export const LABEL_TRANSLATIONS: Record<string, Partial<InvoiceLabels>> = ${JSON.stringify(out, null, 2)};

// Only the strings an ESTIMATE says differently. Merged OVER the invoice table when the document is
// an estimate — otherwise a translated estimate is headed "Invoice" in every language, which tells
// a client they have been billed for something they were only quoted.
export const ESTIMATE_LABEL_TRANSLATIONS: Record<string, Partial<InvoiceLabels>> = ${JSON.stringify(estOut, null, 2)};
`;
writeFileSync("src/lib/invoice-labels-i18n.ts", file);
console.log(`\nWrote src/lib/invoice-labels-i18n.ts — ${Object.keys(out).length} languages`);

// The SAME table, emitted for the app, because the app translates on-device now and needs the
// labels without a round trip. Generated from this one run so the two cannot drift: a label the web
// renders and a label the app renders must be the same word, or the sender is previewing something
// the receiver will not see.
const APP = process.env.APP_REPO ?? "/Users/ahmedmubashir/Documents/invoice-kmp-app";
const kt = `package invotick.invoicemaker.core.common.model

// GENERATED by Webinvotick/scripts/generate-label-translations.mjs — do not edit by hand.
//
// The invoice labels, pre-translated. The app renders them without asking anyone, which is the
// point: they are fixed strings, and sending them to a translation service per document was the
// bulk of the traffic through a rate-limited endpoint.
//
// Emitted from the SAME run that writes the web's table, so the two cannot drift apart. If they
// did, the sender would preview a wording the receiver never sees.
val INVOICE_LABEL_TRANSLATIONS: Map<String, Map<String, String>> = mapOf(
${Object.entries(out).map(([code, labels]) =>
  `    "${code}" to mapOf(\n` +
  Object.entries(labels).map(([k, v]) => `        "${k}" to ${JSON.stringify(v)},`).join("\n") +
  `\n    ),`
).join("\n")}
)

/** Only what an ESTIMATE says differently — merged over the map above when documentType is ESTIMATE. */
val ESTIMATE_LABEL_TRANSLATIONS: Map<String, Map<String, String>> = mapOf(
${Object.entries(estOut).map(([code, labels]) =>
  `    "${code}" to mapOf(\n` +
  Object.entries(labels).map(([k, v]) => `        "${k}" to ${JSON.stringify(v)},`).join("\n") +
  `\n    ),`
).join("\n")}
)
`;
try {
  writeFileSync(`${APP}/core/common/src/commonMain/kotlin/invotick/invoicemaker/core/common/model/InvoiceLabelTranslations.kt`, kt);
  console.log(`Wrote the app's copy into ${APP}`);
} catch (e) {
  console.warn(`Could not write the app copy (${e.message}) — regenerate with APP_REPO set.`);
}
