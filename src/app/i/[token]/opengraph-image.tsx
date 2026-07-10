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
  const amount =
    shared?.totalAmount != null
      ? `${shared.currency ? `${shared.currency} ` : ""}${shared.totalAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
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
          padding: "80px",
          background: "linear-gradient(135deg, #0D4DC0 0%, #0a3a94 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, opacity: 0.95 }}>
          Invotick
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.9 }}>
            {number ? `Invoice ${number}` : "Invoice"} from
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 8 }}>
            {business}
          </div>
          {amount && (
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 20, opacity: 0.95 }}>
              {amount}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, opacity: 0.92 }}>
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              color: "#0D4DC0",
              padding: "10px 22px",
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            View &amp; download PDF
          </div>
          <div style={{ display: "flex" }}>www.invotick.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
