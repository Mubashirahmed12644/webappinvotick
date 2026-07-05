import { ImageResponse } from "next/og";

// Social-share preview image (Open Graph + Twitter). 1200x630.
export const alt = "Invotick — Free Invoice Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0D4DC0 0%, #0a3a94 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, opacity: 0.95 }}>
          Invotick
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 28 }}>
          Free Invoice Generator
        </div>
        <div style={{ display: "flex", fontSize: 36, opacity: 0.92, marginTop: 28, maxWidth: 900 }}>
          Create a professional invoice online and download a PDF in seconds — no sign-up.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 44, fontSize: 26, opacity: 0.9 }}>
          <div style={{ display: "flex", background: "#ffffff", color: "#0D4DC0", padding: "10px 22px", borderRadius: 999, fontWeight: 700 }}>
            100% free
          </div>
          <div style={{ display: "flex" }}>www.invotick.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
