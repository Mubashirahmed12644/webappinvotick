/**
 * The app's generated logo is drawn in the invoice's colour, and nothing else is (decision 0181).
 *
 * Run: node scripts/checks/run-generated-logo-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 *
 * Renders InvoiceDocument itself — the component the offline bundle, the share page and the server all
 * draw — from snapshots shaped as the app sends them.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument, InvoiceFooter, ownFooterProps } from "@/components/invoice/InvoiceDocument";
import type { InvoiceRenderData } from "@/lib/data";

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failed++;
}

const BAKED = "data:image/webp;base64,UklGRg==";
const base = {
  id: "g",
  invoiceNumber: "KB2609014",
  invoiceDate: "28/09/2026",
  status: "SENT",
  currency: "PKR",
  subtotal: 74000,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: 74000,
  color: "#663E37",
  toggles: { logo: true, title: true, items: true, total: true },
  business: { name: "Karachi Builders", logo: BAKED, logoGenerated: true },
  client: { id: "c", name: "Siddiqui Developers" },
  headerImage: "data:image/webp;base64,AAAA",
  backgroundOpacity: 1,
  items: [{ sn: 1, name: "Red clay bricks", quantity: 4, unitPrice: 18500, discountValue: 0, discountType: "PERCENTAGE", taxRate: 0, amount: 74000 }],
} as unknown as InvoiceRenderData;

const html = (d: InvoiceRenderData) => renderToStaticMarkup(<InvoiceDocument data={d} hideFooter />);

// 1. A generated logo on the brick template: drawn, in brown, and the baked picture is not shown.
{
  const out = html(base);
  check("a generated logo is drawn, not shown as its picture", out.includes("data-generated-logo") && !out.includes(BAKED), out.slice(0, 400));
  check("in the invoice colour's tones: T95 tile, T35 ink, T80 outline", out.includes('fill="#FFEDEA"') && out.includes('fill="#714840"') && out.includes('stroke="#F2B9AF"'));
  check("with the business's initials and first word", out.includes(">KB</text>") && out.includes(">Karachi</text>"));
}

// 2. The colour follows Customize: same business, green invoice.
{
  const out = html({ ...base, color: "#2E7D32" });
  check("a changed invoice colour changes the logo", out.includes('fill="#C7FFBE"') && out.includes('fill="#076019"') && !out.includes('fill="#714840"'));
}

// 3. A light header: the outline takes the ink's tone.
{
  const out = html({ ...base, color: "#AD4800", headerLight: true });
  check("on a light header the outline is T35", out.includes('stroke="#903500"') && !out.includes('stroke="#FFB692"'));
}

// 4. A plain band of a light colour counts as light; a dark band does not.
{
  const light = html({ ...base, color: "#95C7D5", headerImage: null });
  check("a light colour band gives the dark outline", light.includes('stroke="#255965"') && !light.includes('stroke="#9CCEDD"'));
  const dark = html({ ...base, color: "#01224C", headerImage: null });
  check("a dark colour band keeps the light outline", dark.includes('stroke="#AEC7FA"'));
}

// 5. An uploaded logo — no flag — is shown exactly as it is, whatever the colour.
{
  const out = html({ ...base, business: { name: "GIFTAT ENGINEERING (PVT) LTD", logo: BAKED } } as InvoiceRenderData);
  check("an uploaded logo is never recoloured", out.includes(`src="${BAKED}"`) && !out.includes("data-generated-logo"));
}

// 6. A snapshot frozen before this (no field at all) keeps its picture: old links look as they did.
{
  const old = { ...base, business: { name: "Old Shop", logo: BAKED } } as InvoiceRenderData;
  delete (old as unknown as { headerLight?: unknown }).headerLight;
  const out = html(old);
  check("a snapshot from before keeps showing its baked picture", out.includes(`src="${BAKED}"`) && !out.includes("data-generated-logo"));
}

// 7. The logo toggle off: nothing at all.
{
  const out = html({ ...base, toggles: { ...base.toggles, logo: false } });
  check("the logo toggle still hides it", !out.includes("data-generated-logo") && !out.includes(BAKED));
}

// 8. The business's own footer draws the same mark in its tile.
{
  const d = { ...base, hideInvotickFooter: true, ownFooter: { showLogo: true, message: "Thanks" } } as unknown as InvoiceRenderData;
  const out = renderToStaticMarkup(<InvoiceFooter {...ownFooterProps(d)} />);
  check("the own footer's tile draws the generated logo too", out.includes("data-generated-logo") && out.includes('fill="#714840"') && !out.includes(BAKED), out.slice(0, 300));
}

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall generated-logo checks passed");
