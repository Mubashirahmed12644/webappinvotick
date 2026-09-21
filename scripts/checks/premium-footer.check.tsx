/**
 * Decision 0147 — a premium account's document carries no Invotick footer; a free one does.
 *
 * Run: node scripts/checks/run-premium-footer-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import type { InvoiceRenderData } from "@/lib/data";
import { withOwnersFooterRule } from "@/lib/invotick-footer";

const base: InvoiceRenderData = {
  id: "inv-1",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-09-21",
  status: "UNPAID" as InvoiceRenderData["status"],
  currency: "USD",
  subtotal: 10,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: 10,
  color: "#0D4DC0",
  toggles: {},
  business: { name: "Shop" } as InvoiceRenderData["business"],
  client: null,
  backgroundOpacity: 0,
  items: [],
};

const FOOTER = "gw.invotick.com";
let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const free = base;
const premium = { ...base, hideInvotickFooter: true };

check("free document: InvoiceDocument draws the footer", renderToStaticMarkup(<InvoiceDocument data={free} />).includes(FOOTER));
check("premium document: InvoiceDocument draws no footer", !renderToStaticMarkup(<InvoiceDocument data={premium} />).includes(FOOTER));
check("free document: every A4 page carries the footer", renderToStaticMarkup(<A4PagedFrame data={free} />).includes(FOOTER));
check("premium document: no A4 page carries the footer", !renderToStaticMarkup(<A4PagedFrame data={premium} />).includes(FOOTER));

const oldLinkOfPayer = withOwnersFooterRule(free, false);
check("share page: a premium owner's old link renders without the footer", !renderToStaticMarkup(<A4PagedFrame data={oldLinkOfPayer} />).includes(FOOTER));
check("share page: a free owner's link keeps the footer", renderToStaticMarkup(<A4PagedFrame data={withOwnersFooterRule(free, true)} />).includes(FOOTER));
check("share page: a server before 0147 (no answer) changes nothing", renderToStaticMarkup(<A4PagedFrame data={withOwnersFooterRule(free, undefined)} />).includes(FOOTER));
check("share page: the server never puts a footer back on a premium snapshot", withOwnersFooterRule(premium, true).hideInvotickFooter === true);

if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("all passed");
