/**
 * A right-to-left page's stamps start over its totals box, which is on the left (decision 0187).
 *
 * Run: node scripts/checks/run-rtl-stamp-check.mjs
 *
 * The automatic PAID stamp, and a company stamp or signature with no saved place, are designed against the
 * left-to-right page, where the totals box is on the right. Right to left they start at the mirror of that spot,
 * `x → 1 − x − size`, as the app's native PDF draws them (DraggableStampModule.paymentStampStart, DraggableModule).
 * A stamp the user placed stays where they put it, in either direction. Left to right, every number is the literal
 * the page drew before this check existed, so the English output does not move by a byte (the English golden
 * pins the rest).
 *
 * These are the server-rendered (first-paint, OG card) positions; in a browser the company stamp and the signature
 * are then measured from the page, which already mirrored.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import type { InvoiceRenderData } from "@/lib/data";
import { FIXTURES } from "./french-invoice.fixtures";

const SHEET_W = 794;
const SHEET_H = 1123;

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

const withStamps = (extra: Partial<InvoiceRenderData> = {}): InvoiceRenderData => ({
  ...FIXTURES.discountAndTax,
  stampImage: "/uploads/stamp.png",
  signatureImage: "/uploads/signature.png",
  paymentStampImage: "/uploads/paid.png",
  ...extra,
}) as InvoiceRenderData;

/** The `left` and `top` the page gives the image with [alt], as React writes them (numbers, in px). */
function place(html: string, alt: string): { left: string; top: string } | null {
  const m = html.match(new RegExp(`<img[^>]*alt="${alt}"[^>]*style="([^"]*)"`));
  if (!m) return null;
  const left = m[1].match(/(?:^|;)left:([^;]+)px/)?.[1];
  const top = m[1].match(/(?:^|;)top:([^;]+)px/)?.[1];
  return left != null && top != null ? { left, top } : null;
}
const px = (n: number) => String(n);
const near = (a: string | undefined, b: number) => a != null && Math.abs(Number(a) - b) < 1e-9;

const ltr = renderToStaticMarkup(<A4PagedFrame data={withStamps()} qrDataUrl="/qr.jpg" />);
const rtl = renderToStaticMarkup(<A4PagedFrame data={withStamps({ language: "ar" } as Partial<InvoiceRenderData>)} qrDataUrl="/qr.jpg" />);
check("the Arabic page is right to left", rtl.includes('dir="rtl"'));
check("the English page is left to right", ltr.includes('dir="ltr"') && !ltr.includes('dir="rtl"'));

// ── The automatic PAID stamp ──────────────────────────────────────────────────────────────────────────────────
const paidL = place(ltr, "Payment stamp");
const paidR = place(rtl, "Payment stamp");
check("left to right, the PAID stamp is where it always was: 0.68 × 794", paidL?.left === px(0.68 * SHEET_W), `${paidL?.left}`);
check("left to right, its top is 0.521 × 1123", paidL?.top === px(0.521 * SHEET_H), `${paidL?.top}`);
check("right to left, the PAID stamp starts over the totals on the left: (1 − 0.68 − 0.189) × 794", near(paidR?.left, (1 - 0.68 - 0.189) * SHEET_W), `${paidR?.left}`);
check("right to left, the PAID stamp's top is unchanged", paidR?.top === paidL?.top, `${paidR?.top}`);
const paidSize = `width:${px(0.189 * SHEET_W)}px;height:${px(0.189 * SHEET_W)}px`;
const paidStyle = (html: string) => html.match(/<img[^>]*alt="Payment stamp"[^>]*style="([^"]*)"/)?.[1] ?? "";
check("the PAID stamp is 0.189 × 794 wide and high either way", paidStyle(ltr).includes(paidSize) && paidStyle(rtl).includes(paidSize), paidStyle(ltr));

// ── A company stamp and a signature with no saved place ─────────────────────────────────────────────────────────
const stampL = place(ltr, "Stamp");
const stampR = place(rtl, "Stamp");
check("left to right, an unplaced stamp starts at 0.682 × 794", stampL?.left === px(0.682 * SHEET_W), `${stampL?.left}`);
check("right to left, an unplaced stamp starts at the mirror: (1 − 0.682 − 0.189) × 794", near(stampR?.left, (1 - 0.682 - 0.189) * SHEET_W), `${stampR?.left}`);
check("right to left, the unplaced stamp's top is unchanged", stampR?.top === stampL?.top);
const sigL = place(ltr, "Signature");
const sigR = place(rtl, "Signature");
check("left to right, an unplaced signature starts at 0.572 × 794", sigL?.left === px(0.572 * SHEET_W), `${sigL?.left}`);
check("right to left, an unplaced signature starts at the mirror: (1 − 0.572 − 0.189) × 794", near(sigR?.left, (1 - 0.572 - 0.189) * SHEET_W), `${sigR?.left}`);

// The mirror uses the overlay's own size, not the default one.
const smallR = place(renderToStaticMarkup(<A4PagedFrame data={withStamps({ language: "ar", stampSize: 0.12 } as Partial<InvoiceRenderData>)} qrDataUrl="/qr.jpg" />), "Stamp");
check("right to left, a smaller unplaced stamp mirrors by its own width: (1 − 0.682 − 0.12) × 794", near(smallR?.left, (1 - 0.682 - 0.12) * SHEET_W), `${smallR?.left}`);

// ── A place the user gave is kept ────────────────────────────────────────────────────────────────────────────
const placed = { stampOffsetX: 0.31, stampOffsetY: 0.42, signatureOffsetX: 0.05, signatureOffsetY: 0.8 } as Partial<InvoiceRenderData>;
for (const [name, lang] of [["English", undefined], ["Arabic", "ar"]] as const) {
  const html = renderToStaticMarkup(<A4PagedFrame data={withStamps({ ...placed, language: lang } as Partial<InvoiceRenderData>)} qrDataUrl="/qr.jpg" />);
  const s = place(html, "Stamp");
  const g = place(html, "Signature");
  check(`${name}: a placed stamp stays where the user put it`, s?.left === px(0.31 * SHEET_W) && s?.top === px(0.42 * SHEET_H), JSON.stringify(s));
  check(`${name}: a placed signature stays where the user put it`, g?.left === px(0.05 * SHEET_W) && g?.top === px(0.8 * SHEET_H), JSON.stringify(g));
}

// ── Persian mirrors too: the rule is the direction, not one language ─────────────────────────────────────────
const fa = place(renderToStaticMarkup(<A4PagedFrame data={withStamps({ language: "fa" } as Partial<InvoiceRenderData>)} qrDataUrl="/qr.jpg" />), "Payment stamp");
check("a Persian page's PAID stamp starts on the left too", near(fa?.left, (1 - 0.68 - 0.189) * SHEET_W), `${fa?.left}`);
// And a translation's direction, passed by the caller, is the one that counts.
const translated = place(renderToStaticMarkup(<A4PagedFrame data={withStamps()} qrDataUrl="/qr.jpg" dir="rtl" />), "Payment stamp");
check("an English document read in Arabic (dir passed) mirrors its PAID stamp", near(translated?.left, (1 - 0.68 - 0.189) * SHEET_W), `${translated?.left}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
