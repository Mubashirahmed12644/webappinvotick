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
    return `${code} ${value.toFixed(2)}`;
  }
}

// rgba() from a #RRGGBB hex, for theme tints (e.g. table row background).
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(13,77,192,${alpha})`;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

// Returns black or white depending on which contrasts better with the given
// hex — so text on a themed band stays readable (light cyan -> dark text).
export function contrastText(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#1c1b1f" : "#ffffff";
}

export function formatDate(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
