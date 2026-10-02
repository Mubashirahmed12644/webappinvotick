/**
 * Print on the web (decision 0201): what the share page's browser route is called, what the free tool's Print is made
 * of, and what neither of them does.
 *
 * - The share page's browser route has always opened the browser's print dialog; it is now named for that, on the same
 *   button (one job, one door), and still sends the same `shared_invoice_pdf_click` with `destination=print_dialog`
 *   (read from the source: a click cannot be made here). The Android route stays "Download PDF" to the install (0017).
 * - The free tool's Print makes the PDF Download makes: one builder, two endings, and no event (the tool has no
 *   analytics route and a button does not earn one).
 *
 * Run: node scripts/checks/run-print-buttons-check.mjs
 */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PdfButton } from "@/components/shared-invoice/PdfButton";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ---- the share page
for (const platform of ["desktop", "ios"] as const) {
  const html = renderToStaticMarkup(<PdfButton platform={platform} installUrl="https://play.example/x" kind="Invoice" />);
  check(`${platform}: the button says "Print or save PDF"`, html.includes("Print or save PDF"));
  check(`${platform}: it no longer says "Download PDF"`, !html.includes("Download PDF"));
  check(`${platform}: it carries a printer glyph, hidden from a screen reader`, html.includes("<svg") && html.includes('aria-hidden="true"'));
  check(`${platform}: its spoken name says print or save`, html.includes('aria-label="Print or save this invoice as a PDF"'));
  check(`${platform}: it is a button, not a link to the store`, html.startsWith("<button") && !html.includes("play.example"));
}
const android = renderToStaticMarkup(<PdfButton platform="android" installUrl="https://play.example/x" kind="Invoice" />);
check('android: untouched — "Download PDF", a link to the install (0017)', android.includes("Download PDF") && android.includes('href="https://play.example/x"') && !android.includes("Print"));

const button = src("src/components/shared-invoice/PdfButton.tsx");
check("the browser route still reports destination=print_dialog, the same event", button.includes('trackWebEvent("shared_invoice_pdf_click", { destination: "print_dialog" })'));
check("it still opens the browser's print dialog", button.includes("window.print()"));

// ---- the free tool
const pdf = src("src/lib/free-invoice/pdf.ts");
const body = (name: string) => pdf.slice(pdf.indexOf(`export async function ${name}`));
check("Download and Print are two endings of one builder", /async function buildInvoicePdf/.test(pdf)
  && /exportInvoicePdf[\s\S]*?buildInvoicePdf\(sourceId\)[\s\S]*?pdf\.save\(/.test(body("exportInvoicePdf"))
  && /printInvoicePdf[\s\S]*?buildInvoicePdf\(sourceId\)[\s\S]*?\.print\(\)/.test(body("printInvoicePdf")));
check("there is exactly one place the PDF is drawn (one jsPDF)", (pdf.match(/new jsPDF\(/g) ?? []).length === 1);

const hook = src("src/components/free-invoice/useFreeInvoice.ts");
const printFn = hook.slice(hook.indexOf("async function printPdf"), hook.indexOf("// Client-only mount"));
check("the free tool's Print sends no event", printFn.length > 0 && !printFn.includes("trackWebEvent"));
check("and does not offer the install (it is not the value moment Download is)", !printFn.includes("setOfferOpen"));

const tool = src("src/components/free-invoice/FreeInvoiceTool.tsx");
const printAt = tool.indexOf("onClick={printPdf}");
check("Print sits after Download and before Back up, outlined (one filled button on the rail)",
  tool.indexOf("onClick={downloadPdf}") < printAt && printAt < tool.indexOf("setBackupOpen(true)")
  && /variant="outline"[^>]*onClick=\{printPdf\}/.test(tool));

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
