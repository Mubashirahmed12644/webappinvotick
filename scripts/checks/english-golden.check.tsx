/**
 * The English document is byte-for-byte what it was before the French invoice (decision 0185).
 *
 * Run: node scripts/checks/run-english-golden-check.mjs
 * Rewrite the golden (ONLY from code whose English output is known right, e.g. gitlab/main):
 *   GOLDEN_WRITE=1 node scripts/checks/run-english-golden-check.mjs
 *
 * The golden files in golden/ were written from `gitlab/main` @ cb70278, before any French code existed.
 * Every English document — `language` absent, null, "en", or a language the document does not speak — must
 * still render exactly those bytes, through each of the three ways a document is drawn: the bare document,
 * the paged A4 frame (the app's offline bundle and /embed/render) and the share page's viewer.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import type { InvoiceRenderData } from "@/lib/data";
import { FIXTURES } from "./french-invoice.fixtures";

const GOLDEN_DIR = join(process.cwd(), "scripts/checks/golden");
const write = process.env.GOLDEN_WRITE === "1";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

const views: Record<string, (d: InvoiceRenderData) => string> = {
  document: (d) => renderToStaticMarkup(<InvoiceDocument data={d} qrDataUrl="/qr.jpg" />),
  paged: (d) => renderToStaticMarkup(<A4PagedFrame data={d} qrDataUrl="/qr.jpg" />),
  share: (d) => renderToStaticMarkup(<SharedInvoiceViewer data={d} qrDataUrl="/qr.jpg" />),
};

// What "English" can look like in a snapshot: absent (every snapshot before 0185), and the values a
// newer app or the web might write for an English document or a language the document does not speak.
const englishVariants: Record<string, (d: InvoiceRenderData) => InvoiceRenderData> = {
  absent: (d) => d,
  null: (d) => ({ ...d, language: null }) as InvoiceRenderData,
  en: (d) => ({ ...d, language: "en" }) as InvoiceRenderData,
  "en-GB": (d) => ({ ...d, language: "en-GB" }) as InvoiceRenderData,
  // "es" was here until 0187 made Spanish a written language; German is one we still do not write by hand.
  de: (d) => ({ ...d, language: "de" }) as InvoiceRenderData,
  empty: (d) => ({ ...d, language: "" }) as InvoiceRenderData,
};

function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at ${i}: golden …${JSON.stringify(a.slice(Math.max(0, i - 40), i + 40))}… now …${JSON.stringify(b.slice(Math.max(0, i - 40), i + 40))}…`;
}

for (const [fixture, data] of Object.entries(FIXTURES)) {
  for (const [view, render] of Object.entries(views)) {
    const file = join(GOLDEN_DIR, `${fixture}.${view}.html`);
    if (write) {
      writeFileSync(file, render(data));
      console.log(`wrote ${file}`);
      continue;
    }
    if (!existsSync(file)) {
      check(`${fixture}.${view}: golden exists`, false, file);
      continue;
    }
    const golden = readFileSync(file, "utf8");
    for (const [variant, make] of Object.entries(englishVariants)) {
      const html = render(make(data));
      check(`${fixture}.${view} language=${variant}: identical to the golden`, html === golden, html === golden ? "" : firstDifference(golden, html));
    }
  }
}

if (write) process.exit(0);
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
