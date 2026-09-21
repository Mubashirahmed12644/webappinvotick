/**
 * Decision 0151 — a premium account's footer is the business's own, in the Invotick footer's slots.
 *
 * Run: node scripts/checks/run-own-footer-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceDocument, InvoiceFooter } from "@/components/invoice/InvoiceDocument";
import type { InvoiceRenderData } from "@/lib/data";
import { footerMode, withOwnersFooterRule, type OwnFooter } from "@/lib/invotick-footer";

const LOGO = "data:image/png;base64,TE9HTw==";
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
  business: { name: "Premium Testing", logo: LOGO } as InvoiceRenderData["business"],
  client: null,
  backgroundOpacity: 0,
  items: [],
};

const own: OwnFooter = {
  showLogo: true,
  initials: "PT",
  message: "Thank you for your business!",
  businessLine: "Premium Testing · 12 Mall Road, Lahore",
  contactLine: "0300-1234567 · info@premiumtesting.com",
  qrText: "https://wa.me/923001234567",
};

const INVOTICK = "gw.invotick.com";
let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
const html = (d: InvoiceRenderData) => renderToStaticMarkup(<A4PagedFrame data={d} />);
const doc = (d: InvoiceRenderData) => renderToStaticMarkup(<InvoiceDocument data={d} />);

const free = { ...base, ownFooter: own };
const premium = { ...base, hideInvotickFooter: true, ownFooter: own };

// The switch.
check("mode: a free document keeps the Invotick footer, even when it carries its own", footerMode(free) === "invotick");
check("mode: a premium document with its own footer draws that", footerMode(premium) === "own");
check("mode: a premium 1.4.8 snapshot (no own footer) has none, as 0147", footerMode({ ...base, hideInvotickFooter: true }) === "none");
check("mode: a premium owner who removed it has none", footerMode({ ...premium, ownFooter: { ...own, removed: true } }) === "none");

const freeHtml = html(free);
check("free: the Invotick footer is drawn", freeHtml.includes(INVOTICK) && freeHtml.includes("Scan to download Invotick"));
check("free: none of the business's own footer is drawn", !freeHtml.includes("Thank you for your business!") && !freeHtml.includes("Contact us"));

const premiumHtml = html(premium);
check("premium: no Invotick item anywhere", !premiumHtml.includes(INVOTICK) && !premiumHtml.includes("Invotick"));
check("premium: message in the 'generated using' slot", premiumHtml.includes("Thank you for your business!"));
check("premium: name + address in the tagline slot", premiumHtml.includes("Premium Testing · 12 Mall Road, Lahore"));
check("premium: 'Contact us' in the 'Scan to download' slot", premiumHtml.includes("Contact us"));
check("premium: phone · email in the link slot", premiumHtml.includes("0300-1234567 · info@premiumtesting.com"));
check("premium: the business's QR is drawn", premiumHtml.includes('aria-label="QR"') && premiumHtml.includes("<svg"));
check("premium: the business logo is on the tile", premiumHtml.includes(LOGO));
check("premium: InvoiceDocument (single sheet) draws it too", doc(premium).includes("Contact us"));

// Fallbacks.
const noLogo = html({ ...premium, business: { name: "Premium Testing" } as InvoiceRenderData["business"] });
check("no logo: the initials go on the same tile", noLogo.includes(">PT<"));
const logoOff = html({ ...premium, ownFooter: { ...own, showLogo: false } });
check("logo hidden: neither logo nor initials", !logoOff.includes(LOGO) && !logoOff.includes(">PT<"));
const noQr = html({ ...premium, ownFooter: { ...own, qrText: null } });
check("no QR target: the QR slot stays empty", !noQr.includes('aria-label="QR"') && noQr.includes("Contact us"));
const noContact = html({ ...premium, ownFooter: { ...own, contactLine: null } });
check("no contact line: no lonely 'Contact us'", !noContact.includes("Contact us"));
const noMessage = html({ ...premium, ownFooter: { ...own, message: null } });
check("message off: the slot is empty, the name line stays", !noMessage.includes("Thank you") && noMessage.includes("Premium Testing · 12 Mall Road"));

// Removed.
const removed = html({ ...premium, ownFooter: { ...own, removed: true } });
check("removed: no band at all", !removed.includes("Contact us") && !removed.includes(INVOTICK) && !removed.includes("Thank you"));

// The share page's owner rule: a link sent while free follows the owner who is premium now.
const oldLink = withOwnersFooterRule(free, false);
check("share page: a free-era link of a premium owner shows the owner's own footer", html(oldLink).includes("Contact us") && !html(oldLink).includes(INVOTICK));

// The Remove / Edit button: only when the app's preview asks for it.
let pressed = 0;
const withRemove = renderToStaticMarkup(<InvoiceFooter qrDataUrl="/qr.jpg" control={{ kind: "remove", label: "Remove", scale: 0.45, onPress: () => pressed++ }} />);
check("control: a free preview gets 'Remove' with the round ×", withRemove.includes('data-footer-control="remove"') && withRemove.includes("Remove") && withRemove.includes("×"));
const withEdit = renderToStaticMarkup(<InvoiceFooter own={own} control={{ kind: "edit", label: "Edit", scale: 0.45, onPress: () => pressed++ }} />);
check("control: a premium preview gets 'Edit'", withEdit.includes('data-footer-control="edit"') && withEdit.includes("Edit"));
const hit = /min-width:([\d.]+)px;min-height:([\d.]+)px/.exec(withRemove);
check("control: the touch target is 48dp on screen", !!hit && Math.abs(parseFloat(hit[1]) * 0.45 - 48) < 0.5 && Math.abs(parseFloat(hit[2]) * 0.45 - 48) < 0.5);
check("control: never on a page nobody asked it for (share page, print)", !html(free).includes("data-footer-control") && !html(premium).includes("data-footer-control"));
// The free footer is pixel-identical to 1.4.8's: this is its markup, captured from InvoiceFooter as it was
// on web main at 3cb90e5 (the 0147 commit). Any change to the free footer must fail here first.
const FREE_FOOTER_148 =
  "<link rel=\"preload\" as=\"image\" href=\"/system-assets/invotick-logo.png\"/><link rel=\"preload\" as=\"image\" href=\"/qr.jpg\"/><div><div style=\"border-top:1px solid #E0E0E0\"></div><div class=\"mb-1 flex items-center justify-between\" style=\"background-color:#F5F5F5;height:95px;margin-top:11px;padding-left:19px;padding-right:19px\"><div class=\"flex items-center\" style=\"gap:19px\"><div style=\"width:62px;height:62px;border-radius:9.299999999999999px;background:#fff;overflow:hidden;flex:none\"><img src=\"/system-assets/invotick-logo.png\" alt=\"Invotick\" style=\"width:62px;height:62px;object-fit:contain\"/></div><div><p style=\"font-size:12.7px;font-weight:700;color:#212121;line-height:1.2\">Invoice generated using Invotick</p><p style=\"font-size:8.7px;color:#666666;line-height:1.2;margin-top:2px\">Create professional invoices in seconds</p></div></div><div class=\"flex items-center\" style=\"gap:12px\"><div style=\"text-align:end\"><p style=\"font-size:11.4px;color:#666666;line-height:1.3\">Scan to download Invotick</p><div style=\"height:1px;margin:3px 0;background:linear-gradient(to right, transparent, #DDDDDD 20%, #DDDDDD 80%, transparent)\"></div><p style=\"font-size:13.3px;font-weight:700;color:#0D4DC0;line-height:1.3\">https://gw.invotick.com/r/2/RefCode</p></div><div style=\"width:62px;height:62px;border-radius:9.299999999999999px;background:#fff;overflow:hidden;flex:none\"><img src=\"/qr.jpg\" alt=\"QR\" style=\"width:62px;height:62px;object-fit:contain\"/></div></div></div></div>";
check("free footer: markup identical to 1.4.8's", renderToStaticMarkup(<InvoiceFooter qrDataUrl="/qr.jpg" />) === FREE_FOOTER_148);

if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("all passed");
