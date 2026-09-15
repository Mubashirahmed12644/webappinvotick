import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The share card for a legal page: the page's own name, large, under the Invotick mark.
// Pasting the policy link used to preview as the homepage's "Free Invoice Generator" card,
// which reads as the wrong link. Rendered at build time (no request data), so it costs nothing
// per view and stores nothing.
export const LEGAL_OG_SIZE = { width: 1200, height: 630 };

export async function renderLegalOg(title: string, subtitle: string) {
  const icon = await readFile(join(process.cwd(), "src/app/icon.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0D4DC0 0%, #0a3a94 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={iconSrc} width={84} height={84} alt="" style={{ borderRadius: 20, background: "#ffffff" }} />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>Invotick</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 36, opacity: 0.92, marginTop: 24, maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.9 }}>www.invotick.com</div>
      </div>
    ),
    { ...LEGAL_OG_SIZE },
  );
}
