/**
 * What the free web tool's invoice — and so its downloaded PDF — actually carries.
 *
 * Decision 0170 (the owner, 2026-09-25: *"jhoot ko kisi bhi mamly main nahi hona chahye … har jagha
 * sach ho"*). The landing page promised "no watermark" while this tool rendered the full Invotick
 * band, and the app's paywall sells the absence of that same band as "Clean PDF". Two screens, two
 * answers, one of them false.
 *
 * The PDF is a bitmap capture of this very DOM (`src/lib/free-invoice/pdf.ts`), so whatever this
 * check finds in the markup is what the visitor downloads. If the footer is ever taken off the free
 * tool, this check goes red and the landing copy is the thing to change with it — never the other
 * way round.
 *
 * Run: node scripts/checks/run-free-tool-footer-check.mjs
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { toRenderData } from "@/lib/free-invoice/adapter";
import { randomSample } from "@/lib/free-invoice/samples";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const html = renderToStaticMarkup(<InvoiceDocument data={toRenderData(randomSample())} />);

check('the free tool prints "Invoice generated using Invotick"', html.includes("Invoice generated using Invotick"));
check("the free tool prints the gw.invotick.com link", html.includes("gw.invotick.com"));
check('the free tool prints the "Scan to download" QR line', html.includes("Scan to download"));

// The claim the landing page is allowed to make, stated as code: the tool is free and needs no
// account. Nothing here asserts "no watermark", because that is the sentence 0170 removed.
check("the free tool's render data never claims premium", toRenderData(randomSample()).hideInvotickFooter !== true);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
