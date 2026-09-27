// The offline bundle's Tailwind sources are exactly the components the renderer imports.
//
// Run: node scripts/checks/run-renderer-sources-check.mjs   (no build; reads files only)
//
// renderer/renderer.css lists its `@source` files by hand. Tailwind emits a class for every word it
// finds in them, so:
// - a listed file the renderer does not import puts web-only CSS into the app's bundle, and the
//   bundle's bytes change whenever that web file does (the whole-folder scan did this until
//   2026-09-27: 49 rules from the web form were in the app's b151ed4b bundle);
// - an imported component that is not listed renders without its classes, offline only.
// Both fail here. renderer/ itself is Vite's root and Tailwind scans it on its own, so it is exempt.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const rendererDir = join(root, "renderer");
const EXTS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

// Mirrors renderer/vite.config.ts: "@/lib/givens" is the renderer's own, then "@/" is src/.
function resolveSpec(from, spec) {
  let base;
  if (spec === "@/lib/givens") base = join(rendererDir, "givens");
  else if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // a package
  for (const e of EXTS) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  throw new Error(`cannot resolve ${spec} from ${relative(root, from)}`);
}

const graph = new Set();
function walk(file) {
  if (graph.has(file)) return;
  graph.add(file);
  if (!/\.(tsx?|m?js)$/.test(file)) return;
  const src = readFileSync(file, "utf8");
  const re = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of src.matchAll(re)) {
    const r = resolveSpec(file, m[1] || m[2] || m[3]);
    if (r) walk(r);
  }
}
walk(join(rendererDir, "main.tsx"));

const cssPath = join(rendererDir, "renderer.css");
const listed = [...readFileSync(cssPath, "utf8").matchAll(/@source\s+(not\s+)?["']([^"']+)["']/g)].map((m) => ({
  negated: Boolean(m[1]),
  path: resolve(rendererDir, m[2]),
  text: m[2],
}));

let failed = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

for (const s of listed) {
  if (s.negated) continue;
  const isFile = existsSync(s.path) && statSync(s.path).isFile();
  check(`@source "${s.text}" is one file, not a folder or glob`, isFile);
  if (isFile) check(`@source "${s.text}" is imported by the renderer`, graph.has(s.path));
}
const scanned = new Set(listed.filter((s) => !s.negated).map((s) => s.path));
for (const f of [...graph].sort()) {
  if (!f.endsWith(".tsx") || f.startsWith(rendererDir + "/")) continue;
  check(`${relative(root, f)} (imported by the renderer) is an @source`, scanned.has(f));
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
