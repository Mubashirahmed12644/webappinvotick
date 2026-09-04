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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Days in `month` (1-12) of `year`, Gregorian leap rule included. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * An invoice date as the calendar triple it actually is — never as an instant.
 *
 * `new Date(string)` was the original implementation and it is wrong twice over:
 *
 *  1. **It guesses the field order.** For any non-ISO string V8 falls back to a legacy parser that
 *     reads `MM/DD/YYYY`. The Android app writes `dd/MM/yyyy` (`toDateString.kt`), so an invoice
 *     issued on **5 September 2026** arrived as `"05/09/2026"` and was rendered **"May 9, 2026"** —
 *     reported from a real device on 2026-09-05. Nothing swapped the fields; the writer said
 *     day-first and the reader assumed month-first. A date past the 12th (`"13/09/2026"`) is instead
 *     rejected outright, so the same bug shows as a wrong date for half the month and a raw string
 *     for the rest — which is why it survived this long.
 *  2. **It drags a timezone into a date that has none.** `new Date("2026-09-05")` is UTC midnight,
 *     and `toLocaleDateString` then renders it in the *device's* zone — one day earlier for every
 *     UTC-negative user. That is the same defect as the app-side one recorded in
 *     `memory/invoice-date-shifts-a-day.md`, arriving from the other direction.
 *
 * An invoice date is a legal and accounting fact: it decides due dates, ageing, and which period a
 * receipt falls in. It must survive the trip with no zone consulted and no order inferred, so this
 * parses to (y, m, d) integers and formats from those. No `Date` object is constructed at all.
 *
 * Two input shapes are accepted, and the ambiguity between them is resolved by *shape*, never by
 * locale:
 *   - **ISO first** — `YYYY-MM-DD` (optionally with a time part, which is discarded). A 4-digit
 *     leading group is unambiguous. This is what the backend, the web app and `InvoiceRenderData`
 *     use, and it is what the app *should* send.
 *   - **Day-first** — `d/M/yy`, `d/M/yyyy`, `d-M-yy`, `d-M-yyyy`. This is what the Android app
 *     actually sends today, and shared snapshots are frozen (hard invariant 4), so links minted
 *     before the app is fixed carry `dd/MM/yyyy` for ever. The renderer has to keep reading them.
 *
 * Anything else — including a real but impossible date like `31/02/2026` — is returned untouched.
 * Showing the raw string is honest; inventing a date on an invoice is not.
 */
function parseCalendarDate(raw: string): [number, number, number] | null {
  const s = raw.trim();

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  const dmy = iso ? null : /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s);

  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    [d, m] = [Number(dmy[1]), Number(dmy[2])];
    // A 2-digit year is this century. The app writes `year % 100` (`formatDateShort`), and an
    // invoice dated 19xx is not a thing this product has to render.
    y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return [y, m, d];
}

export function formatDate(date?: string | null): string {
  if (!date) return "—";
  const parsed = parseCalendarDate(date);
  if (!parsed) return date;
  const [y, m, d] = parsed;
  // Same text `toLocaleDateString("en-US", { month: "short", … })` produced for a correct date, so
  // nothing that already rendered right changes — but built from the components, so no locale and
  // no timezone can reinterpret it. Matches the app's native `formatDateLong` exactly, which is
  // what the parity harness diffs against.
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}
