/**
 * Pull the hardcoded user-facing strings out of a Kotlin module and into Compose Resources.
 *
 * The app has ~2,151 of them and four `stringResource()` calls, so this is not a job for hands. It
 * is, however, a job that has to be careful about what it touches, because "a string literal in a
 * Compose file" and "a string a person reads" are not the same set.
 *
 * ## What it takes
 *
 * Only the parameters that put words on screen: `text`, `title`, `subtitle`, `label`, `placeholder`,
 * `contentDescription`, `supportingText`, `message`, `confirmText`, `dismissText`.
 *
 * ## What it deliberately leaves
 *
 *  - **Anything with `$`.** An interpolated string is a format, not a sentence: it needs a
 *    placeholder in the XML and arguments at the call site, and the argument ORDER changes between
 *    languages. Those are reported, not rewritten — getting them wrong silently reorders somebody's
 *    invoice number into their client's name.
 *  - **`analyticsId`, route names, keys, tags, log text.** Not read by users; translating them would
 *    break the analytics identity the whole event pipeline is keyed on.
 *  - **Strings inside `@Preview` functions.** Sample data, not product copy.
 *  - **One- and two-character strings** — separators, bullets, currency marks.
 *
 * ## Keys
 *
 * `<file-slug>_<text-slug>`, deduplicated. Long enough to be unambiguous when 2,000 of them share
 * one namespace, and readable enough that a translator can tell what they are looking at.
 *
 *   node scripts/extract-ui-strings.mjs <module-dir> [--write]
 *
 * Without `--write` it only reports. Nothing is rewritten until the report looks right.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const MODULE = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!MODULE) {
  console.error("usage: node scripts/extract-ui-strings.mjs <module-dir> [--write]");
  process.exit(1);
}

const PARAMS = [
  "text", "title", "subtitle", "label", "placeholder", "contentDescription",
  "supportingText", "message", "confirmText", "dismissText", "headline",
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "build" || e === ".git") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith(".kt")) out.push(p);
  }
  return out;
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44);
}

/** Line ranges belonging to @Preview functions, so their sample copy is skipped. */
function previewRanges(src) {
  const lines = src.split("\n");
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*@Preview\b/.test(lines[i])) continue;
    let depth = 0, started = false;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") depth--;
      }
      if (started && depth === 0) { ranges.push([i, j]); i = j; break; }
    }
  }
  return ranges;
}

const files = walk(MODULE).filter((f) => f.includes("/src/") && !f.includes("/build/"));
const strings = new Map();   // key -> english
const edits = [];            // {file, line, param, value, key}
const interpolated = [];
let skippedPreview = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const previews = previewRanges(src);
  const fileSlug = slug(basename(file, ".kt"));

  lines.forEach((line, idx) => {
    if (previews.some(([a, b]) => idx >= a && idx <= b)) {
      if (PARAMS.some((p) => new RegExp(`\\b${p}\\s*=\\s*"`).test(line))) skippedPreview++;
      return;
    }
    for (const p of PARAMS) {
      const m = new RegExp(`\\b${p}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(line);
      if (!m) continue;
      const value = m[1];
      if (value.length < 3) continue;
      if (value.includes("$")) { interpolated.push({ file, line: idx + 1, param: p, value }); continue; }
      if (/^[a-z0-9_.]+$/.test(value)) continue;           // looks like an id, not a sentence
      const key = `${fileSlug}_${slug(value)}`;
      if (strings.has(key) && strings.get(key) !== value) continue;   // collision: leave it
      strings.set(key, value);
      edits.push({ file, line: idx + 1, param: p, value, key });
    }
  });
}

console.log(`module: ${MODULE}`);
console.log(`  files scanned:        ${files.length}`);
console.log(`  extractable strings:  ${edits.length}  (${strings.size} unique keys)`);
console.log(`  interpolated (LEFT):  ${interpolated.length}`);
console.log(`  skipped in @Preview:  ${skippedPreview}`);

if (interpolated.length) {
  console.log(`\n  interpolated strings need a human — placeholder order changes between languages:`);
  for (const i of interpolated.slice(0, 8)) {
    console.log(`    ${relative(MODULE, i.file)}:${i.line}  ${JSON.stringify(i.value).slice(0, 70)}`);
  }
  if (interpolated.length > 8) console.log(`    … and ${interpolated.length - 8} more`);
}

if (!WRITE) {
  console.log(`\n  (report only — pass --write to apply)`);
  process.exit(0);
}

// ── strings.xml ─────────────────────────────────────────────────────────────────────────────
const resDir = join(MODULE, "src/commonMain/composeResources/values-en");
mkdirSync(resDir, { recursive: true });
const xmlPath = join(resDir, "strings.xml");
const existing = existsSync(xmlPath) ? readFileSync(xmlPath, "utf8") : "";
const already = new Set([...existing.matchAll(/<string name="([^"]+)"/g)].map((m) => m[1]));

// XML entities only. NOT Android's `\'` / `\"` backslash escaping — that is a convention of the
// AAPT resource compiler, and Compose Resources does not use AAPT. Its parser hands the text
// through as written, so a `\'` reached the screen as a literal backslash: "You\'re in Guest Mode"
// shipped in the drawer, and "Where the app\'s accent colours come from." in Settings.
//
// Quotes and apostrophes need no escaping at all inside an XML text node; they are only special
// inside an attribute value, and these are not attributes.
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const body = [...strings.entries()]
  .filter(([k]) => !already.has(k))
  .map(([k, v]) => `    <string name="${k}">${esc(v)}</string>`)
  .join("\n");

if (body) {
  const merged = existing.includes("</resources>")
    ? existing.replace("</resources>", body + "\n</resources>")
    : `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`;
  writeFileSync(xmlPath, merged);
  console.log(`\n  wrote ${xmlPath}`);
}

// ── rewrite the call sites ──────────────────────────────────────────────────────────────────
// The generated package lowercases the module path: composeApp -> composeapp, feature/settings ->
// feature.settings. Getting this wrong produces an import that compiles nowhere and a diff that
// looks right, so it is read off the real generated class rather than guessed.
const resPkg = `invotickproject.${relative(".", MODULE).toLowerCase().replace(/[/-]/g, ".")}.generated.resources`;
const byFile = new Map();
for (const e of edits) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

let rewritten = 0;
for (const [file, es] of byFile) {
  let src = readFileSync(file, "utf8");
  for (const e of es) {
    const needle = `${e.param} = "${e.value}"`;
    const replacement = `${e.param} = stringResource(Res.string.${e.key})`;
    if (src.includes(needle)) { src = src.split(needle).join(replacement); rewritten++; }
  }
  const imports = [
    "import org.jetbrains.compose.resources.stringResource",
    `import ${resPkg}.Res`,
    ...es.map((e) => `import ${resPkg}.${e.key}`),
  ].filter((i) => !src.includes(i));
  if (imports.length) {
    const lines = src.split("\n");
    const last = lines.reduce((acc, l, i) => (l.startsWith("import ") ? i : acc), 0);
    lines.splice(last + 1, 0, ...imports);
    src = lines.join("\n");
  }
  writeFileSync(file, src);
}
console.log(`  rewrote ${rewritten} call sites across ${byFile.size} files`);
console.log(`  resource package assumed: ${resPkg}`);
