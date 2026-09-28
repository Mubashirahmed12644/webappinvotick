// Which seeded header photos are light around the logo tile (decision 0181, improvement A).
//
//   node scripts/measure-header-surround.mjs
//
// Lays each header out the way InvoiceDocument does — object-fit: cover into the 794 × 165 band, anchored
// at centre 30 % — and reads the 8 px around the 112 px logo tile (32 px from the left, centred). A header
// is light when the median CIELAB L* there is at least 65. The answer is written into the code as a list
// of header ids (LIGHT_HEADER_IDS here, SeededLook.LIGHT_HEADER_IDS in the app), so nothing is measured
// when an invoice is drawn and the app and the web cannot disagree.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/system-assets/", import.meta.url));
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lstar = (y) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (y * 24389) / 27);
const W = 794, H = 165, TILE = 112, LEFT = 32, BAND = 8, THRESHOLD = 65;

for (let n = 1; n <= 9; n++) {
  const file = `${dir}header_${n}.png`;
  const meta = await sharp(file).metadata();
  const s = Math.max(W / meta.width, H / meta.height);
  const sw = Math.round(meta.width * s), sh = Math.round(meta.height * s);
  const { data } = await sharp(file)
    .resize(sw, sh)
    .extract({ left: Math.round((sw - W) * 0.5), top: Math.round((sh - H) * 0.3), width: W, height: H })
    .flatten({ background: "#ffffff" }) // a transparent header shows the white sheet behind it
    .raw()
    .toBuffer({ resolveWithObject: true });
  const x0 = LEFT, x1 = LEFT + TILE, y0 = Math.round((H - TILE) / 2), y1 = y0 + TILE;
  const ring = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < x1 + BAND; x++) {
      const d = Math.max(x0 - x, x - (x1 - 1), y0 - y, y - (y1 - 1));
      if (d < 1 || d > BAND) continue;
      const i = (y * W + x) * 3;
      ring.push(lstar(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2])));
    }
  ring.sort((a, b) => a - b);
  const median = ring[Math.floor(ring.length / 2)];
  console.log(`header_${n}  median L* ${median.toFixed(1)}  ${median >= THRESHOLD ? "LIGHT" : ""}`);
}
