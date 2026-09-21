/**
 * Decision 0151 — a premium account's footer is the business's own, in the Invotick footer's slots.
 *
 * Run: node scripts/checks/run-own-footer-check.mjs
 * (bundles this file with the repo's own rolldown, then renders with react-dom/server — no DOM needed).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { FOOTER_CONTROL_GEOMETRY, InvoiceDocument, InvoiceFooter, footerControlLayout } from "@/components/invoice/InvoiceDocument";
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
const withRemove = renderToStaticMarkup(<InvoiceFooter qrDataUrl="/qr.jpg" control={{ kind: "remove", label: "Remove footer", scale: 0.45, onPress: () => pressed++ }} />);
const withEdit = renderToStaticMarkup(<InvoiceFooter own={own} control={{ kind: "edit", label: "Edit footer", scale: 0.45, onPress: () => pressed++ }} />);
// Icon only (the owner, 2026-09-21): the words are the accessible name and nothing else. The button's
// markup, taken on its own, must carry no visible text at all — only the aria-label.
const buttonOf = (h: string) => /<button[\s\S]*?<\/button>/.exec(h)?.[0] ?? "";
const visibleText = (h: string) => h.replace(/<[^>]*>/g, "").trim();
check("control: a free preview gets the × icon, named 'Remove footer', with no words drawn",
  withRemove.includes('data-footer-control="remove"') && buttonOf(withRemove).includes('aria-label="Remove footer"') && visibleText(buttonOf(withRemove)) === "" && buttonOf(withRemove).includes("M6 6l12 12"));
check("control: a premium preview gets the pencil icon, named 'Edit footer', with no words drawn",
  withEdit.includes('data-footer-control="edit"') && buttonOf(withEdit).includes('aria-label="Edit footer"') && visibleText(buttonOf(withEdit)) === "" && buttonOf(withEdit).includes("M16.5 3.5"));
const box = /width:([\d.]+)px;height:([\d.]+)px;padding:0/.exec(buttonOf(withRemove));
check("control: the touch target is 48 × 48dp on screen", !!box && Math.abs(parseFloat(box[1]) * 0.45 - 48) < 0.5 && Math.abs(parseFloat(box[2]) * 0.45 - 48) < 0.5);
// Neither the icon nor its touch target covers the QR or any text — not even partly (the owner,
// 2026-09-21) — nor the document above the footer, at every scale a phone or tablet uses. Band
// coordinates: origin at the band's top-right corner, x rightwards, y downwards (sheet px).
{
  const g = FOOTER_CONTROL_GEOMETRY;
  const qrTop = (g.bandHeight - g.qrTile) / 2;
  const QR = { x0: -g.qrRightPad - g.qrTile, y0: qrTop, x1: -g.qrRightPad, y1: qrTop + g.qrTile };
  // Every text line of both footers starts at or below the QR's top: the Invotick "Scan… / link" block
  // and the owner's "Contact us / two-line contact" block (14.8 + 7 + 2 × 17.3 ≈ 56.4 px, the tallest) are
  // centred in the band. The browser measurement in the 1.4.9 fix confirmed it on the rendered bundle.
  const TEXT_TOP = (g.bandHeight - 57) / 2;
  check(`geometry: the QR spans x ${QR.x0}…${QR.x1}, y ${QR.y0}…${QR.y1}; text starts at y ≥ ${TEXT_TOP}`, QR.y0 === 16.5 && TEXT_TOP >= QR.y0);
  for (const scale of [0.3, 0.38, 0.45, 0.494, 0.5, 0.62, 0.8, 1, 1.4, 2]) {
    const L = footerControlLayout(scale);
    const cx = L.cx, cy = L.cy - g.bandTop, r = L.radius;
    const box = { x0: L.boxLeft, y0: L.boxTop - g.bandTop, x1: L.boxLeft + L.touch, y1: L.boxTop - g.bandTop + L.touch };
    const distToRect = (R: { x0: number; y0: number; x1: number; y1: number }) =>
      Math.hypot(Math.max(R.x0 - cx, 0, cx - R.x1), Math.max(R.y0 - cy, 0, cy - R.y1));
    const qr = distToRect(QR);
    const above = distToRect({ x0: -1e4, y0: -1e4, x1: 0, y1: -g.bandTop });
    const edgeRoom = g.sheetEdge - cx;
    check(`control @${scale}: icon r=${r.toFixed(1)} at (${cx}, ${cy}) clears the QR (${qr.toFixed(1)}), the document (${above.toFixed(1)}) and the sheet's edge (${edgeRoom})`,
      qr > r && above > r && edgeRoom > r && cy + r <= QR.y0);
    check(`control @${scale}: the 48dp target (${box.x0.toFixed(0)}…${box.x1}, ${box.y0.toFixed(0)}…${box.y1}) ends above the QR and the text, inside the sheet`,
      Math.abs(L.touch * scale - 48) < 0.01 && box.y1 < QR.y0 && box.y1 < TEXT_TOP && box.x1 <= g.sheetEdge);
    check(`control @${scale}: the icon is inside its own target`,
      cx - r >= box.x0 && cx + r <= box.x1 && cy - r >= box.y0 && cy + r <= box.y1);
  }
}
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
