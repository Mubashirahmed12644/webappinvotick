// A few currencies whose narrow symbol we want to match the mobile app exactly.
const SYMBOLS: Record<string, string> = { PKR: "₨", INR: "₹", USD: "$", GBP: "£", EUR: "€" };

export function formatMoney(amount: number | string, currency = "USD"): string {
  const value = (typeof amount === "string" ? parseFloat(amount) : amount) || 0;
  const code = (currency || "USD").toUpperCase();
  const sym = SYMBOLS[code];
  if (sym) {
    return sym + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).format(value);
  } catch {
    // `currency` here is a raw symbol (e.g. "Rs") the app passes, not an ISO code — prepend it with
    // NO space to match the native render ("Rs584.00", not "Rs 584.00").
    return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// rgba() from a #RRGGBB hex, for theme tints (e.g. table row background).
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(13,77,192,${alpha})`;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

const INK = "#1c1b1f";
const PAPER = "#ffffff";

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

/**
 * WCAG relative luminance — the gamma-corrected one.
 *
 * This is the canonical definition for BOTH repos. There used to be three:
 *   - here, `0.2126r + 0.7152g + 0.0722b` on raw sRGB with no gamma step, threshold 0.6
 *   - the app renderer, Compose's `Color.luminance()` (correct), threshold 0.5
 *   - the app's colour picker, `0.299r + 0.587g + 0.114b` (Rec.601), threshold 0.65
 *
 * Three formulas and three thresholds over one decision — what colour the title goes on the
 * seller's chosen accent — means the same invoice could be rendered with white text by the web and
 * black text by the app. That is hard invariant 1 broken by arithmetic rather than by markup, and
 * it is the kind of difference a parity harness reports as a mystery.
 */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    // The step the old version skipped. Without it a mid-tone reads far brighter than it is.
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Ink or paper on the given background — whichever actually contrasts more.
 *
 * No threshold constant. A threshold is a guess at where the crossover is; computing both ratios
 * puts it exactly where the maths does (relative luminance 0.1791), for every colour, including the
 * ones nobody tested because a seller picked them.
 */
export function contrastText(hex: string): string {
  const bg = relativeLuminance(hex);
  return ratio(relativeLuminance(INK), bg) >= ratio(relativeLuminance(PAPER), bg) ? INK : PAPER;
}

/** The colour `hex` becomes when laid over white at `alpha` — what the eye actually receives. */
export function blendOnWhite(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return PAPER;
  const out = rgb.map((v) => Math.round(alpha * v + (1 - alpha) * 255));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * An accent-coloured text that is still legible on a tint of itself.
 *
 * The TOTAL row wants the seller's accent as text on a 16% wash of that same accent — a deliberately
 * quiet rung below BALANCE DUE. Written literally that is `color` on `rgba(color, .16)`, which for
 * the default blue is 3.1:1 and for a light accent (a seller picking cyan or lime) collapses toward
 * 1:1. The row is a money figure on an invoice; it cannot be the thing that fades out.
 *
 * So the hue is kept and the lightness is walked down until the pair clears AA. The row still reads
 * as "accent on accent" — it just does so at a contrast that survives whatever the seller picked.
 */
export function onTint(hex: string, alpha: number, min = 4.5): string {
  const rgb = parseHex(hex);
  if (!rgb) return INK;
  const bgLum = relativeLuminance(blendOnWhite(hex, alpha));
  let [r, g, b] = rgb;
  for (let i = 0; i < 24; i++) {
    const candidate = "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    if (ratio(relativeLuminance(candidate), bgLum) >= min) return candidate;
    [r, g, b] = [r * 0.88, g * 0.88, b * 0.88];
  }
  return INK;
}

export function formatDate(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
