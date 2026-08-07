import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getSharedInvoice } from "@/lib/shared-invoice";

export const OG_SIZE = { width: 1200, height: 630 };

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

/**
 * Render the per-invoice OG card (real invoice summary, not generic). Returns an
 * ImageResponse. Shared by the on-demand route that stores the PNG in Vercel Blob
 * so it's rendered ONCE and then served as a globally-cached static image.
 */
export async function renderOgCard(token: string): Promise<ImageResponse> {
  const shared = await getSharedInvoice(token);

  // Brand icon embedded as a data URL (no network fetch, same local + prod).
  const iconBuffer = await readFile(new URL("./og-brand-icon.png", import.meta.url));
  const brandIcon = `data:image/png;base64,${iconBuffer.toString("base64")}`;

  const business = shared?.businessName?.trim() || "A business";
  const number = shared?.invoiceNumber?.trim();
  // The card is often all the receiver reads before deciding to open the link. Calling an estimate
  // an "Invoice" here tells a client they have been billed for something they were only quoted —
  // and unlike the page, this image is what gets forwarded on.
  const isEstimate = shared?.documentType === "ESTIMATE";
  const kind = isEstimate ? "Estimate" : "Invoice";
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
        <div style={{ position: "absolute", top: -160, right: -140, width: 520, height: 520, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -120, left: -120, width: 360, height: 360, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandIcon} width={52} height={52} style={{ borderRadius: 12, marginRight: 16 }} alt="" />
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>Invotick</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, background: "rgba(255,255,255,0.16)", padding: "10px 24px", borderRadius: 999 }}>
            {number ? `${kind} #${number}` : kind}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 3, opacity: 0.78 }}>{isEstimate ? "ESTIMATE FROM" : "INVOICE FROM"}</div>
          <div style={{ display: "flex", fontSize: businessSize, fontWeight: 800, lineHeight: 1.04, marginTop: 12 }}>{business}</div>
          {amount && (
            <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "18px 32px", marginTop: 32 }}>
              <div style={{ display: "flex", fontSize: 36, opacity: 0.88, marginRight: 20 }}>Total</div>
              <div style={{ display: "flex", fontSize: amountSize, fontWeight: 800 }}>{amount}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", color: "#1355D8", borderRadius: 24, padding: "24px 24px 24px 40px", fontSize: 42, fontWeight: 800 }}>
          {/* Says what the page does, and now it is true again: the page offers the PDF (decision
              0017). The claim was removed for a while because there was no download behind it — the
              thing the link cannot do, which is a poor first impression to hand a client. */}
          <div style={{ display: "flex" }}>{isEstimate ? "View & download the estimate (PDF)" : "View & download the invoice (PDF)"}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 62, borderRadius: 999, background: "#1355D8", color: "#ffffff", fontSize: 40 }}>→</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
