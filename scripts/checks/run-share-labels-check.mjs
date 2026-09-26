// Bundles share-labels.check.tsx (the "@/" alias, TSX) with the repo's rolldown and runs it in node.
import { build } from "rolldown";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
// Inside node_modules so the bundle resolves react from the repo; never committed.
const out = join(root, "node_modules/.cache/share-labels-check.mjs");
await build({
  input: join(root, "scripts/checks/share-labels.check.tsx"),
  resolve: { alias: { "@": join(root, "src") } },
  external: [/^react($|\/)/, /^react-dom($|\/)/, /^react-zoom-pan-pinch/],
  moduleTypes: { ".jpg": "dataurl", ".png": "dataurl", ".css": "empty" },
  transform: { jsx: "react-jsx" },
  platform: "node",
  // translateInvoice loads the label table with a dynamic import; one file keeps the runner simple.
  output: { file: out, format: "esm", codeSplitting: false },
  logLevel: "warn",
});
await import(pathToFileURL(out).href);
