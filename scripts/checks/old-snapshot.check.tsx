/**
 * A link shared by a live app (1.4.5 – 1.4.8) still renders on the share page.
 *
 * Run: node scripts/checks/run-old-snapshot-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 *
 * A shared link's snapshot is frozen at share time (AGENTS.md §4 invariant 4), so the page keeps
 * receiving the field set those builds wrote, for ever: money already rounded to two decimals, dates as
 * dd/MM/yyyy, no footer or language fields, and every null left out (SharedInvoiceRepositoryImpl's
 * Json: encodeDefaults = true, explicitNulls = false). The two fixtures below are that shape, taken
 * from InvoiceSnapshot.kt on the app's VC_96_VN_144 (1.4.5). They go through the page's
 * own path: renderDataOf's footer rule, then SharedInvoiceViewer → A4PagedFrame → InvoiceDocument.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import type { InvoiceRenderData } from "@/lib/data";
import { withOwnersFooterRule } from "@/lib/invotick-footer";

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failed++;
}

// Every field a 1.4.5 snapshot could carry, as that build wrote them.
const full = {
  id: "0f3c2a9e-1111-4222-8333-944455556666",
  documentType: "INVOICE",
  invoiceNumber: "INV-0042",
  invoiceDate: "05/09/2026",
  dueDate: "19/09/2026",
  poNumber: "PO-7",
  status: "SENT",
  currency: "PKR",
  subtotal: 1215.5,
  discountAmount: 60.78,
  taxAmount: 57.74,
  shippingCost: 25,
  total: 1237.46,
  amountPaid: 200,
  balanceDue: 1037.46,
  paymentStatus: "PARTIALLY_PAID",
  notes: "Thank you",
  paymentInstructions: "Bank: 0000",
  terms: "Net 14",
  color: "#0D4DC0",
  titleColor: null,
  toggles: { items: true, total: true, notes: true, payment: true, terms: true },
  business: { name: "Old Shop", logo: null, emailAddress: "shop@example.com", phone: "+92 300 0000000", addressLine1: "Street 1", addressLine2: null, city: "Lahore", country: "Pakistan" },
  client: { id: "c", name: "A Client", emailAddress: null, phone: null, addressLine1: "Road 2", addressLine2: null, city: "Karachi", state: null, zipcode: null, country: "Pakistan", companyName: null },
  headerImage: null,
  backgroundImage: null,
  backgroundOpacity: 1,
  signatureImage: null,
  signatureOffsetX: null,
  signatureOffsetY: null,
  signatureSize: null,
  stampImage: null,
  stampOffsetX: null,
  stampOffsetY: null,
  stampSize: null,
  paymentStampImage: null,
  items: [
    { sn: 1, name: "Flat off", description: null, quantity: 2, unitPrice: 400, discountValue: 50, discountType: "FLAT", taxRate: 5, amount: 735 },
    { sn: 2, name: "Percent off", description: "per cent", quantity: 1, unitPrice: 14.5, discountValue: 15, discountType: "PERCENTAGE", taxRate: 0, amount: 12.33 },
    { sn: 3, name: "Stored FIXED", description: null, quantity: 1.5, unitPrice: 333.33, discountValue: 10, discountType: "FIXED", taxRate: 0, amount: 485 },
  ],
} as unknown as InvoiceRenderData;

// A bare link as the app sent it: defaults written, every null left out (explicitNulls = false).
const sparse = {
  id: "0f3c2a9e-2222-4222-8333-944455556666",
  documentType: "INVOICE",
  invoiceNumber: "INV-0043",
  invoiceDate: "31/12/2026",
  status: "SENT",
  currency: "USD",
  subtotal: 10,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: 10,
  color: "#0D4DC0",
  toggles: {},
  business: { name: "Sparse Shop" },
  client: { id: "c", name: "Someone" },
  backgroundOpacity: 1,
  items: [{ sn: 1, name: "Thing", quantity: 1, unitPrice: 10, discountValue: 0, discountType: "PERCENTAGE", taxRate: 0, amount: 10 }],
} as unknown as InvoiceRenderData;

for (const [label, snap] of [["1.4.5 snapshot, every field", full], ["1.4.5 snapshot, nulls left out", sparse]] as const) {
  // A server before 0147 sends no showInvotickFooter; a later one sends it.
  for (const show of [undefined, true, false]) {
    let html = "";
    let error = "";
    try {
      html = renderToStaticMarkup(<SharedInvoiceViewer data={withOwnersFooterRule(snap, show)} qrDataUrl="/qr_code.jpg" />);
    } catch (e) {
      error = String(e);
    }
    const tag = `${label}, showInvotickFooter=${show}`;
    check(`${tag}: renders without error`, !error && html.length > 0, error);
    check(`${tag}: no NaN / undefined / Invalid Date in the page`, !/NaN|undefined|Invalid Date/.test(html.replace(/<[^>]*>/g, " ")));
    check(`${tag}: the invoice number is on the page`, html.includes(snap.invoiceNumber));
    check(`${tag}: footer follows the owner's rule`, html.includes("gw.invotick.com") === (show !== false));
  }
}

const fullHtml = renderToStaticMarkup(<SharedInvoiceViewer data={withOwnersFooterRule(full, undefined)} />);
check("dd/MM/yyyy is read day-first: 05/09/2026 is 5 September", /Sep[^<]{0,6}5|5[^<]{0,3}Sep/.test(fullHtml));
check("the frozen 2-decimal total is shown as it was sent", fullHtml.includes("1,237.46"));
check("a stored FIXED line discount shows as money, not %", !fullHtml.includes("10.00%"));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
