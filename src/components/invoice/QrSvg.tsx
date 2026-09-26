import { create as createQr } from "qrcode";

/**
 * A QR code drawn as one SVG path, from the text it encodes (decision 0151).
 *
 * The business's own footer carries only the QR's TARGET (a WhatsApp or website link), never an
 * image: every surface draws the code itself, so the snapshot stays small (invariant 7) and the offline
 * bundle, the online render and the share page produce it from the same text. SVG rather than a canvas
 * data URL so it renders on the server (share page), in node (the checks) and in the WebView alike.
 *
 * Error correction M and a one-module quiet zone, as the Invotick QR tile it replaces.
 * Text the encoder cannot take (too long) draws nothing: an empty tile, never a broken page.
 */
export function QrSvg({ text, size }: { text: string; size: number }) {
  let path = "";
  let n = 0;
  try {
    const qr = createQr(text, { errorCorrectionLevel: "M" });
    n = qr.modules.size;
    const cells = qr.modules.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (cells[y * n + x]) path += `M${x + 1} ${y + 1}h1v1h-1z`;
      }
    }
  } catch {
    return null;
  }
  const box = n + 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR"
      style={{ display: "block" }}
    >
      <rect width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
