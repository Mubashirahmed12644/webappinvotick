import { ImageResponse } from "next/og";
import { getSharedInvoice } from "@/lib/shared-invoice";

// Per-invoice social-share card (Open Graph + Twitter). 1200x630.
export const alt = "Shared invoice — Invotick";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedInvoice(token);

  const business = shared?.businessName?.trim() || "A business";
  const number = shared?.invoiceNumber?.trim();
  // Only Latin symbols render reliably in the OG image font — everything else
  // shows the ISO code (e.g. "PKR 555.00") so we never get a tofu box.
  const SAFE_SYMBOLS: Record<string, string> = {
    USD: "$", AUD: "$", CAD: "$", NZD: "$", GBP: "£", EUR: "€",
  };
  const code = (shared?.currency || "").toUpperCase();
  const sym = SAFE_SYMBOLS[code];
  const amount =
    shared?.totalAmount != null
      ? (() => {
          const n = shared.totalAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return sym ? `${sym}${n}` : code ? `${code} ${n}` : n;
        })()
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 70px",
          background: "linear-gradient(135deg, #0D4DC0 0%, #0a3a94 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top row: brand + invoice number badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 800 }}>Invotick</div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              background: "rgba(255,255,255,0.16)",
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {number ? `Invoice #${number}` : "Invoice"}
          </div>
        </div>

        {/* Hook: big business name + total — the eye-grabbers */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 32, opacity: 0.82 }}>Invoice from</div>
          <div style={{ display: "flex", fontSize: 94, fontWeight: 800, lineHeight: 1.02, marginTop: 6 }}>
            {business}
          </div>
          {amount && (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 26 }}>
              <div style={{ display: "flex", fontSize: 34, opacity: 0.8, marginRight: 16, paddingBottom: 8 }}>
                Total
              </div>
              <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>{amount}</div>
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
            color: "#0D4DC0",
            borderRadius: 22,
            padding: "26px 40px",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex" }}>View &amp; download the invoice (PDF)</div>
          <div style={{ display: "flex", fontSize: 46 }}>→</div>
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
