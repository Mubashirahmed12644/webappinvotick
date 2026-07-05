// Currency defaulting for the free tool. First visit → guess from the user's
// country (timezone/locale, 100% client-side — no network, keeps the page
// static & SEO-light). Once the user picks a currency we remember it and that
// choice wins on every later visit.
import { CURRENCIES } from "./types";

const PREF_KEY = "invotick-free:currency";
const SUPPORTED = new Set<string>(CURRENCIES);

// Specific IANA timezones → one of our supported currencies.
const TZ_CURRENCY: Record<string, string> = {
  "Asia/Karachi": "PKR",
  "Asia/Kolkata": "INR",
  "Asia/Calcutta": "INR",
  "Asia/Dubai": "AED",
  "Europe/London": "GBP",
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",
  "Australia/Brisbane": "AUD",
  "Australia/Perth": "AUD",
  "Australia/Adelaide": "AUD",
  "Australia/Hobart": "AUD",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "America/Edmonton": "CAD",
  "America/Winnipeg": "CAD",
  "America/Halifax": "CAD",
  "America/Montreal": "CAD",
  "America/Regina": "CAD",
  "America/St_Johns": "CAD",
};

// Locale region code (e.g. "en-GB" → GB) → supported currency.
const REGION_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", PK: "PKR", IN: "INR", AE: "AED", AU: "AUD", CA: "CAD",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", IE: "EUR",
  AT: "EUR", PT: "EUR", GR: "EUR", FI: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR", CY: "EUR",
};

function fromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
    // Most of continental Europe uses the euro (UK handled above).
    if (tz.startsWith("Europe/")) return "EUR";
    return null;
  } catch {
    return null;
  }
}

function fromLocale(): string | null {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const region = l?.split("-")[1]?.toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
    return null;
  } catch {
    return null;
  }
}

// Best-guess currency for a first-time visitor (falls back to USD).
export function detectCurrency(): string {
  const guess = fromTimezone() || fromLocale() || "USD";
  return SUPPORTED.has(guess) ? guess : "USD";
}

export function getPreferredCurrency(): string | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v && SUPPORTED.has(v) ? v : null;
  } catch {
    return null;
  }
}

export function setPreferredCurrency(currency: string): void {
  try {
    localStorage.setItem(PREF_KEY, currency);
  } catch {
    /* ignore */
  }
}

// The currency a new/blank invoice should open with: the user's saved choice if
// they've ever picked one, otherwise the country-based guess.
export function initialCurrency(): string {
  return getPreferredCurrency() ?? detectCurrency();
}
