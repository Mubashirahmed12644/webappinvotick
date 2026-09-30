// A few currencies whose narrow symbol we want to match the mobile app exactly.
// The rupee is "Rs", two letters, never the one character U+20A8 (owner's decision, 2026-09-29): iOS's font drew that
// character as a squeezed "Rs", so one amount looked different on each device. A snapshot from an app before 1.5.0
// still sends the old character as its currency; it is read as "Rs" too, so an old share link matches a new one.
const SYMBOLS: Record<string, string> = { PKR: "Rs", "\u20A8": "Rs", INR: "₹", USD: "$", GBP: "£", EUR: "€" };

/**
 * [n] to two decimals, half away from zero, on the decimal it is — the app's toUIString2Decimals.
 *
 * Every figure of an invoice is calculated at four decimals and rounded to two only here, where it is
 * shown (owner, 2026-09-27). toLocaleString rounds the binary Number instead: 2.175 is held as
 * 2.17499999…, and read "2.17" where the app reads "2.18". String(n) is the shortest text that reads
 * back as n — the decimal that was calculated — so the rounding is done on its digits. No BigInt: this
 * file goes into the app's offline renderer, which runs in whatever WebView the phone has.
 */
export function roundShown(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(Math.abs(n));
  if (text.includes("e")) return Number(n.toFixed(2));
  const [int, frac = ""] = text.split(".");
  if (frac.length <= 2) return n;
  let digits = (int + frac.slice(0, 2)).split("").map(Number);
  if (Number(frac[2]) >= 5) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === 9) digits[i--] = 0;
    if (i < 0) digits = [1, ...digits];
    else digits[i] += 1;
  }
  const whole = digits.join("");
  const value = Number(`${whole.slice(0, -2)}.${whole.slice(-2)}`);
  return n < 0 ? -value : value;
}

/**
 * The languages a document can be written in (document-language.ts). French, Portuguese, Polish, Turkish, German,
 * Dutch, Indonesian and Swedish punctuate their figures differently; Spanish, Arabic, Persian and Chinese documents keep
 * the app's own `1,234.50` (decision 0187: the Spanish installs are mostly point-decimal countries, an Arabic or Persian
 * document isolates each figure instead — InvoiceDocument — and Chinese writes `¥1,234.50` itself). Hindi, Burmese and
 * Thai keep it too: India, Myanmar and Thailand all write `1,234.50` with Western digits in business.
 */
export type FigureLanguage =
  | "en" | "fr" | "pt" | "es" | "ar"
  | "de" | "fa" | "hi" | "id" | "my" | "nl" | "pl" | "sv" | "th" | "tr" | "zh";

export function formatMoney(amount: number | string, currency = "USD", lang: FigureLanguage = "en"): string {
  if (lang === "fr") return formatMoneyFr(amount, currency);
  if (lang === "pt" || lang === "pl") return formatMoneyFr(amount, currency, NBSP);
  if (lang === "tr") return formatMoneyFr(amount, currency, ".");
  // Wave 2: German `1.234,50 €` and Swedish `1 234,50 kr` put the symbol after, as French does; Dutch `€ 1.234,50`
  // and Indonesian `Rp1.234,50` keep it where the English line has it.
  if (lang === "de") return formatMoneyFr(amount, currency, ".");
  if (lang === "sv") return formatMoneyFr(amount, currency, NBSP);
  if (lang === "nl") return symbolFirst(formatMoney(amount, currency), NBSP);
  if (lang === "id") return symbolFirst(formatMoney(amount, currency), "");
  const value = roundShown((typeof amount === "string" ? parseFloat(amount) : amount) || 0);
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

/**
 * BALANCE DUE as the document shows it (owner's decision, 2026-09-30).
 *
 * A client may pay more than an invoice's total — an advance. The balance is then negative, and it is shown the
 * way the app's invoice card already shows it: the figure in brackets, the symbol where that language puts it —
 * `Rs(1,500.00)`, `$(1,500.00)`, `(1 500,00) €`. The amount is formatMoney's own, digit for digit; only the
 * brackets are added around the figure, never a minus sign and never a different number. The app's snapshot used
 * to send 0 here; a balance that is zero or positive is formatMoney's output, byte for byte.
 */
export function formatBalanceDue(amount: number | string, currency = "USD", lang: FigureLanguage = "en"): string {
  const shownValue = roundShown((typeof amount === "string" ? parseFloat(amount) : amount) || 0);
  if (!(shownValue < 0)) return formatMoney(amount, currency, lang);
  const shown = formatMoney(-shownValue, currency, lang);
  // The figure is everything from its first digit to its last; the symbol and its gap stay outside.
  let first = -1;
  let last = -1;
  for (let i = 0; i < shown.length; i++) {
    if (shown[i] >= "0" && shown[i] <= "9") {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return formatMoney(amount, currency, lang);
  return `${shown.slice(0, first)}(${shown.slice(first, last + 1)})${shown.slice(last + 1)}`;
}

// ─── French documents (decision 0185)───────────────────────────────────────────────────────────
//
// A document written in French shows its figures the French way: `1 234,50 €` — a narrow no-break space
// (U+202F) between thousands, a decimal comma, and the symbol AFTER the amount behind a no-break space
// (U+00A0). The figure itself is never computed here: every French string is the English one's digits,
// re-punctuated. The same rounding (roundShown), the same number of decimals (Intl's own for an ISO
// code — 0 for JPY, 3 for KWD — exactly as the English line), the same symbol. Only the punctuation and
// the symbol's side change, so an amount cannot read differently in the two languages.

const NNBSP = "\u202F";
const NBSP = "\u00A0";

/**
 * "1,234.50" / "-1234.5" (English digits) → "1 234,50" / "-1 234,5". Grouping is re-done, so either input works.
 * [group] is the thousands separator: French's narrow no-break space, or Portugal's no-break space (decision 0187).
 */
export function frenchDigits(english: string, group: string = NNBSP): string {
  const m = /^(-?)([\d,]+)(?:\.(\d+))?$/.exec(english.trim());
  if (!m) return english;
  const [, sign, intPart, frac] = m;
  const int = intPart.replace(/,/g, "");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${sign}${grouped}${frac !== undefined ? `,${frac}` : ""}`;
}

/**
 * The English line with its figure re-punctuated in place (dot thousands, decimal comma) and its symbol left in front:
 * `€1,234.50` → `€ 1.234,50` (Dutch, [gap] = no-break space) or `Rp1.234,50` (Indonesian, no gap). A sign stays where
 * the English put it (`-$5.00` → `-$ 5,00`, `$-5.00` → `$ -5,00`). Only a string with exactly one figure is rewritten:
 * guessing at an amount is worse than an English comma. The app's twin is `SymbolFirstFigures` (Kotlin).
 */
export function symbolFirst(english: string, gap: string): string {
  // An exec loop, not matchAll: this file runs in the app's offline renderer, in whatever WebView the phone has.
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g;
  const runs: RegExpExecArray[] = [];
  for (let m = re.exec(english); m; m = re.exec(english)) runs.push(m);
  if (runs.length !== 1) return english;
  const run = runs[0];
  if (run[1].length > 1 && run[1].startsWith("0")) return english; // "0042" is an identifier, never an amount
  const at = run.index;
  const head = english.slice(0, at);
  const tail = english.slice(at + run[0].length);
  const lead = head.startsWith("-") ? "-" : "";
  const trail = head.length > lead.length && head.endsWith("-") ? "-" : "";
  const symbol = head.slice(lead.length, head.length - trail.length);
  const sep = symbol && !/\s$/.test(symbol) ? gap : "";
  return `${lead}${symbol}${sep}${trail}${frenchDigits(run[0], ".")}${tail}`;
}

/** Portuguese figures (decision 0187): the French shape with Portugal's no-break space between thousands. */
export function portugueseDigits(english: string): string {
  return frenchDigits(english, NBSP);
}

/** Turkish figures: a full stop between thousands and a decimal comma — `1.234,50`. */
export function turkishDigits(english: string): string {
  return frenchDigits(english, ".");
}

function formatMoneyFr(amount: number | string, currency: string, group: string = NNBSP): string {
  const digits = (english: string) => frenchDigits(english, group);
  const value = roundShown((typeof amount === "string" ? parseFloat(amount) : amount) || 0);
  const code = (currency || "USD").toUpperCase();
  const two = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = SYMBOLS[code];
  if (sym) return `${digits(two(value))}${NBSP}${sym}`;
  try {
    // The English line's own parts: its symbol, its sign, its digits and its decimals.
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(value);
    const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
    const sign = parts.some((p) => p.type === "minusSign") ? "-" : "";
    const int = parts.filter((p) => p.type === "integer").map((p) => p.value).join("");
    const fraction = parts.filter((p) => p.type === "fraction").map((p) => p.value).join("");
    return `${digits(`${sign}${int}${fraction ? `.${fraction}` : ""}`)}${NBSP}${symbol}`;
  } catch {
    // A raw symbol the app passes ("Rs", "€"), not an ISO code: after the amount, as a French reader expects.
    return `${digits(two(value))}${NBSP}${currency}`;
  }
}

/** A plain figure to two decimals — the item table's quantity. English keeps its `toFixed(2)`. */
export function formatFixed2(n: number, lang: FigureLanguage = "en"): string {
  if (lang === "fr") return frenchDigits(n.toFixed(2));
  if (lang === "pt" || lang === "pl" || lang === "sv") return portugueseDigits(n.toFixed(2));
  if (lang === "tr") return turkishDigits(n.toFixed(2));
  if (lang === "de" || lang === "nl" || lang === "id") return frenchDigits(n.toFixed(2), ".");
  return n.toFixed(2);
}

/** A rate to two decimals — "20.00%" / "20,00 %" (French) / "20,00%" (Portuguese, Polish) / "%20,00" (Turkish). */
export function formatPercent(n: number, lang: FigureLanguage = "en"): string {
  if (lang === "fr") return `${frenchDigits(n.toFixed(2))}${NNBSP}%`;
  if (lang === "pt" || lang === "pl") return `${portugueseDigits(n.toFixed(2))}%`;
  if (lang === "tr") return `%${turkishDigits(n.toFixed(2))}`;
  // German and Swedish put a space before "%" (DIN 5008, Språkrådet); Dutch and Indonesian do not.
  if (lang === "de") return `${frenchDigits(n.toFixed(2), ".")}${NBSP}%`;
  if (lang === "sv") return `${portugueseDigits(n.toFixed(2))}${NBSP}%`;
  if (lang === "nl" || lang === "id") return `${frenchDigits(n.toFixed(2), ".")}%`;
  return `${n.toFixed(2)}%`;
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

/** French short months, as French typography abbreviates them (the English line spells the month too). */
const MONTHS_SHORT_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Portuguese (European, as Angola and Mozambique write it) and Latin American Spanish short months (decision 0187). */
const MONTHS_SHORT_PT = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MONTHS_SHORT_ES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
/** Dutch and Indonesian short months (wave 2). German writes `29.09.2026` and Swedish `2026-09-29`: no month word. */
const MONTHS_SHORT_NL = ["jan.", "feb.", "mrt.", "apr.", "mei", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
const MONTHS_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** Thai short months (CLDR), with the Gregorian year the app stores — not the Buddhist Era. */
const MONTHS_SHORT_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatDate(date?: string | null, lang: FigureLanguage = "en"): string {
  if (!date) return "—";
  const parsed = parseCalendarDate(date);
  if (!parsed) return date;
  const [y, m, d] = parsed;
  // "29 sept. 2026": day, month, year, the French order. Same calendar triple as the English line.
  if (lang === "fr") return `${d}${NBSP}${MONTHS_SHORT_FR[m - 1]}${NBSP}${y}`;
  if (lang === "pt") return `${d}${NBSP}${MONTHS_SHORT_PT[m - 1]}${NBSP}${y}`;
  if (lang === "es") return `${d}${NBSP}${MONTHS_SHORT_ES[m - 1]}${NBSP}${y}`;
  // Arabic: day first, all digits — no month word to argue over between Cairo (سبتمبر), Damascus (أيلول) and Rabat
  // (شتنبر), and it reads the same on the client's side of any border. The document isolates it (InvoiceDocument).
  if (lang === "ar") return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  // Polish and Turkish invoices print the date as digits with full stops: "29.09.2026".
  if (lang === "pl" || lang === "tr") return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  // Persian writes a date year first: "2026/09/29", the Gregorian day the invoice was dated (isolated, like Arabic).
  if (lang === "fa") return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  // Chinese: "2026年9月29日".
  if (lang === "zh") return `${y}年${m}月${d}日`;
  // Hindi and Burmese: numeric day-first too, as Indian and Myanmar bills write it. Thai: "29 ก.ย. 2026".
  if (lang === "hi" || lang === "my") return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  if (lang === "th") return `${d}${NBSP}${MONTHS_SHORT_TH[m - 1]}${NBSP}${y}`;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  if (lang === "de") return `${dd}.${mm}.${y}`;
  if (lang === "sv") return `${y}-${mm}-${dd}`;
  if (lang === "nl") return `${d}${NBSP}${MONTHS_SHORT_NL[m - 1]}${NBSP}${y}`;
  if (lang === "id") return `${d}${NBSP}${MONTHS_SHORT_ID[m - 1]}${NBSP}${y}`;
  // Same text `toLocaleDateString("en-US", { month: "short", … })` produced for a correct date, so
  // nothing that already rendered right changes — but built from the components, so no locale and
  // no timezone can reinterpret it. Matches the app's native `formatDateLong` exactly, which is
  // what the parity harness diffs against.
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}
