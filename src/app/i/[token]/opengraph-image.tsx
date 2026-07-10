import { ImageResponse } from "next/og";
import { getSharedInvoice } from "@/lib/shared-invoice";

// Per-invoice social-share card (Open Graph + Twitter). 1200x630.
export const alt = "Shared invoice — Invotick";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The OG image font only has Latin glyphs, so non-Latin currency symbols (₨, ₹…)
// render as a tofu box (☒). Normalise ANY currency the app sends — a symbol OR a
// code — to an ASCII-safe label so the card can never show a tofu.
function ogCurrency(raw?: string | null): { text: string; pad: boolean } {
  const c = (raw || "").trim();
  if (!c) return { text: "", pad: false };
  const MAP: Record<string, string> = {
    "₨": "Rs", PKR: "Rs", RS: "Rs",
    "₹": "INR", INR: "INR",
    "$": "$", USD: "$", AUD: "$", CAD: "$", NZD: "$", SGD: "$",
    "£": "£", GBP: "£",
    "€": "€", EUR: "€",
    AED: "AED", SAR: "SAR",
  };
  let out = MAP[c] ?? MAP[c.toUpperCase()];
  if (!out) out = c.replace(/[^\x20-\x7E]/g, "").trim(); // strip anything that could tofu
  const pad = !(out.length === 1 && "$£€".includes(out));
  return { text: out, pad };
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedInvoice(token);

  const business = shared?.businessName?.trim() || "A business";
  const number = shared?.invoiceNumber?.trim();
  const cur = ogCurrency(shared?.currency);
  const amount =
    shared?.totalAmount != null
      ? (() => {
          const n = shared.totalAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return cur.text ? (cur.pad ? `${cur.text} ${n}` : `${cur.text}${n}`) : n;
        })()
      : null;

  // Responsive sizing: shrink long business names / big amounts so they always fit
  // on the card and stay aligned, while short ones get the biggest, boldest size.
  const bl = business.length;
  const businessSize = bl <= 12 ? 104 : bl <= 18 ? 86 : bl <= 26 ? 66 : bl <= 36 ? 52 : 44;
  const al = (amount ?? "").length;
  const amountSize = al <= 10 ? 70 : al <= 14 ? 58 : al <= 18 ? 48 : 40;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 68px",
          background: "linear-gradient(135deg, #1355D8 0%, #0a3a94 55%, #072a6e 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Soft decorative circles for depth */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -120,
            left: -120,
            width: 360,
            height: 360,
            borderRadius: 999,
            background: "rgba(255,255,255,0.05)",
          }}
        />

        {/* Top row: brand + invoice number badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "#ffffff",
                color: "#1355D8",
                fontSize: 30,
                fontWeight: 800,
                marginRight: 16,
              }}
            >
              I
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>Invotick</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              background: "rgba(255,255,255,0.16)",
              padding: "10px 24px",
              borderRadius: 999,
            }}
          >
            {number ? `Invoice #${number}` : "Invoice"}
          </div>
        </div>

        {/* Hook: business name + a highlighted total chip */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 3,
              opacity: 0.78,
            }}
          >
            INVOICE FROM
          </div>
          <div style={{ display: "flex", fontSize: businessSize, fontWeight: 800, lineHeight: 1.04, marginTop: 12 }}>
            {business}
          </div>
          {amount && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                background: "rgba(255,255,255,0.14)",
                borderRadius: 20,
                padding: "18px 32px",
                marginTop: 32,
              }}
            >
              <div style={{ display: "flex", fontSize: 36, opacity: 0.88, marginRight: 20 }}>Total</div>
              <div style={{ display: "flex", fontSize: amountSize, fontWeight: 800 }}>{amount}</div>
            </div>
          )}
        </div>

        {/* Full-width CTA bar — biggest, brightest, click-me element */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            color: "#1355D8",
            borderRadius: 24,
            padding: "24px 24px 24px 40px",
            fontSize: 42,
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex" }}>View &amp; download the invoice (PDF)</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 62,
              height: 62,
              borderRadius: 999,
              background: "#1355D8",
              color: "#ffffff",
              fontSize: 40,
            }}
          >
            →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // The card is derived from immutable snapshot fields — cache it hard at the
      // edge so, after the first generation, every social crawl is instant.
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800",
      },
    },
  );
}
