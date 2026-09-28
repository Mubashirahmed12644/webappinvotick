// The logo the app draws for a business that has none of its own — its initials in a ring — drawn here
// from data, in the invoice's own colour (decision 0181).
//
// Everything in this file is arithmetic on data: the business name, the invoice colour and one fact about
// the header. Nothing is measured in a browser and no pixel is read, so the offline bundle, the share page
// and the server render the same mark from the same snapshot (invariant 1).
//
// The app has the same functions in Kotlin (GeneratedLogo.kt, M3Palette.tone, logoInitials/logoWord), and
// `generated-logo.test.ts` pins both to one table of expected values, which the app's own test also reads.
import { NUNITO_BOLD, NUNITO_EXTRA_BOLD, type FontMetrics } from "./generated-logo-metrics.ts";

// ─── Which logos are generated ─────────────────────────────────────────────────────────────────────────

/**
 * Written on the end of a generated logo's stored address: `/uploads/9f….jpg#generated-logo`.
 *
 * The fact belongs to the image, so it travels with the image's address. A fragment is the part of an
 * address no browser or HTTP client ever sends, so the file is fetched exactly as before, on every
 * build. And it clears itself: a logo the person uploads is a new file at a new address, with no mark —
 * even when an older app, which knows nothing of this, does the uploading.
 */
export const GENERATED_LOGO_MARK = "#generated-logo";

/** True for a stored logo address the app marked as its own drawing. */
export function isGeneratedLogo(logo?: string | null): boolean {
  return typeof logo === "string" && logo.endsWith(GENERATED_LOGO_MARK);
}

// ─── What the logo says (mirrors core/common Extensions.kt logoWord / logoInitials) ───────────────────

/** The first word of the name, and nothing after the space. */
export function logoWord(name?: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

const isUpper = (c: string) => c !== c.toLowerCase() && c === c.toUpperCase();
const isLower = (c: string) => c !== c.toUpperCase() && c === c.toLowerCase();

/** The two characters the logo draws, by the policy decided 2026-08-24 (see the Kotlin original). */
export function logoInitials(name?: string | null): string {
  if (!name || !name.trim()) return "--";
  const words = name.trim().split(/\s+/).filter((w) => w.trim() !== "");
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  const word = words[0] ?? "";
  if (!word) return "--";
  const pieces = word.split(/[-_./&+]+/).filter((p) => p.trim() !== "");
  if (pieces.length >= 2) return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase();
  for (let i = 1; i < word.length; i++) {
    if (isUpper(word[i]) && isLower(word[i - 1])) return `${word[0]}${word[i]}`.toUpperCase();
  }
  return (word.length >= 2 ? `${word[0]}${word[1]}` : `${word[0]}${word[0]}`).toUpperCase();
}

// ─── Tones: Material 3's tonal palette, a line-for-line port of the app's M3Palette.tone ───────────────

const M = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const MI = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];
const WP100 = [95.047, 100.0, 108.883];

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** A "#RRGGBB" as the app's Compose Color holds it: each channel a 32-bit float of n/255. */
function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [Math.fround(((n >> 16) & 255) / 255), Math.fround(((n >> 8) & 255) / 255), Math.fround((n & 255) / 255)];
}

function xyz100(hex: string): number[] {
  const [r0, g0, b0] = channels(hex);
  const r = srgbToLinear(r0) * 100, g = srgbToLinear(g0) * 100, b = srgbToLinear(b0) * 100;
  return [0, 1, 2].map((i) => M[i][0] * r + M[i][1] * g + M[i][2] * b);
}
const linRgb100 = (xyz: number[]) => [0, 1, 2].map((i) => MI[i][0] * xyz[0] + MI[i][1] * xyz[1] + MI[i][2] * xyz[2]);
const inGamut100 = (xyz: number[]) => linRgb100(xyz).every((v) => v >= -0.4 && v <= 100.4);

function hexFromXyz100(xyz: number[]): string {
  const lin = linRgb100(xyz);
  const ch = (v: number) => Math.min(255, Math.max(0, Math.round(linearToSrgb(v / 100) * 255)));
  return "#" + lin.map((v) => ch(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const yFromLstar = (l: number) => (l > 8 ? 100 * Math.pow((l + 16) / 116, 3) : (100 * l) / 903.2962962962963);
function lstarFromY(y: number): number {
  const t = y / 100;
  return t > 216 / 24389 ? 116 * Math.pow(t, 1 / 3) - 16 : t * 903.2962962962963;
}

const cat = (x: number[]) => [
  0.401288 * x[0] + 0.650173 * x[1] - 0.051461 * x[2],
  -0.250268 * x[0] + 1.204414 * x[1] + 0.045854 * x[2],
  -0.002079 * x[0] + 0.048952 * x[1] + 0.953127 * x[2],
];
const catInv = (r: number, g: number, b: number) => [
  1.8620678 * r - 1.0112547 * g + 0.14918678 * b,
  0.38752654 * r + 0.62144744 * g - 0.00897398 * b,
  -0.0158415 * r - 0.03412294 * g + 1.04996444 * b,
];
function adapt(v: number, fl: number): number {
  const s = v < 0 ? -1 : 1;
  const a = Math.pow((fl * Math.abs(v)) / 100, 0.42);
  return (s * 400 * a) / (a + 27.13);
}
function unadapt(v: number, fl: number): number {
  const s = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  return ((s * 100) / fl) * Math.pow((27.13 * a) / (400 - a), 1 / 0.42);
}

const VC = (() => {
  const la = ((200 / Math.PI) * (100 * Math.pow((50 + 16) / 116, 3))) / 100;
  const yb = 100 * Math.pow((50 + 16) / 116, 3);
  const n = yb / WP100[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const w = cat(WP100);
  const f = 0.8 + 2 / 10;
  const d = Math.min(1, Math.max(0, f * (1 - (1 / 3.6) * Math.exp((-la - 42) / 92))));
  const rgbD = [0, 1, 2].map((i) => (d * WP100[1]) / w[i] + 1 - d);
  const k = 1 / (5 * la + 1);
  const k4 = k * k * k * k;
  const fl = 0.2 * k4 * (5 * la) + 0.1 * (1 - k4) * (1 - k4) * Math.pow(5 * la, 1 / 3);
  const wa = [0, 1, 2].map((i) => adapt(w[i] * rgbD[i], fl));
  const aw = ((40 * wa[0] + 20 * wa[1] + wa[2]) / 20) * nbb;
  return { n, z, nbb, ncb: nbb, rgbD, fl, aw, c: 0.69, nc: 1.0 };
})();

function cam16Hc(hex: string): [number, number] {
  const rgb = cat(xyz100(hex));
  const a1 = adapt(rgb[0] * VC.rgbD[0], VC.fl);
  const a2 = adapt(rgb[1] * VC.rgbD[1], VC.fl);
  const a3 = adapt(rgb[2] * VC.rgbD[2], VC.fl);
  const a = (11 * a1 - 12 * a2 + a3) / 11;
  const b = (a1 + a2 - 2 * a3) / 9;
  const hDeg = ((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
  const u = (20 * a1 + 20 * a2 + 21 * a3) / 20;
  const p2 = (40 * a1 + 20 * a2 + a3) / 20;
  const hr = (hDeg * Math.PI) / 180;
  const et = 0.25 * (Math.cos(hr + 2) + 3.8);
  const j = 100 * Math.pow((p2 * VC.nbb) / VC.aw, VC.c * VC.z);
  const t = ((50000 / 13) * VC.nc * VC.ncb * et * Math.hypot(a, b)) / (u + 0.305);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
  return [hDeg, alpha * Math.sqrt(j / 100)];
}

function xyzFromJch(j: number, c: number, hDeg: number): number[] {
  const hr = (hDeg * Math.PI) / 180;
  const alpha = j === 0 ? 0 : c / Math.sqrt(j / 100);
  const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73), 1 / 0.9);
  const ac = VC.aw * Math.pow(j / 100, 1 / (VC.c * VC.z));
  const p1 = (50000 / 13) * (0.25 * (Math.cos(hr + 2) + 3.8)) * VC.nc * VC.ncb;
  const p2 = ac / VC.nbb;
  const gamma = (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * Math.cos(hr) + 108 * t * Math.sin(hr));
  const a = gamma * Math.cos(hr);
  const b = gamma * Math.sin(hr);
  const ra = (460 * p2 + 451 * a + 288 * b) / 1403;
  const ga = (460 * p2 - 891 * a - 261 * b) / 1403;
  const ba = (460 * p2 - 220 * a - 6300 * b) / 1403;
  return catInv(unadapt(ra, VC.fl) / VC.rgbD[0], unadapt(ga, VC.fl) / VC.rgbD[1], unadapt(ba, VC.fl) / VC.rgbD[2]);
}

/** The colour at tone `t` (CIELAB L*) on the palette seeded by `seed`, hue and chroma held in CAM16. */
export function tone(seed: string, t: number): string {
  if (t <= 0) return "#000000";
  if (t >= 100) return "#FFFFFF";
  const [hue, seedChroma] = cam16Hc(seed);
  let c = seedChroma;
  const yTarget = yFromLstar(t);
  while (c >= 0) {
    let lo = 0, hi = 100;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (xyzFromJch(mid, c, hue)[1] < yTarget) lo = mid;
      else hi = mid;
    }
    const xyz = xyzFromJch((lo + hi) / 2, c, hue);
    if (inGamut100(xyz) && Math.abs(lstarFromY(Math.max(xyz[1], 0)) - t) < 0.6) return hexFromXyz100(xyz);
    c -= 0.4;
  }
  return hexFromXyz100([(WP100[0] * yTarget) / 100, yTarget, (WP100[2] * yTarget) / 100]);
}

/** WCAG relative luminance and contrast ratio. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** CIELAB L* of a colour — its Material tone. */
export const toneOf = (hex: string) => lstarFromY(luminance(hex) * 100);

export interface LogoTones { tile: string; disc: string; ink: string; outline: string }

/**
 * Every colour of the mark, from the one invoice colour.
 *
 * Tones, not hues, decide the pairs, so the ink on the tile is 6.8:1 on any accent: T35 against T95.
 * The outline is T80 — or T35 where the header behind the tile is light, so the tile does not dissolve
 * into a white photo (decision 0181, improvement A).
 */
export function generatedLogoTones(accent: string, headerLight: boolean): LogoTones {
  const ink = tone(accent, 35);
  return { tile: tone(accent, 95), disc: tone(accent, 90), ink, outline: headerLight ? ink : tone(accent, 80) };
}

// ─── Which headers are light behind the logo ───────────────────────────────────────────────────────────

/**
 * The seeded header photos whose area around the logo tile is light (median L* ≥ 65 in the 8 px around
 * the tile, measured once by `scripts/measure-header-surround.mjs`): header_2 (100), header_6 (69.5) and
 * header_7 (86.2). The rest measure 13.7 to 58.0. The app holds the same three ids (SeededLook.kt).
 *
 * A photo the person chose themselves is not measured, and keeps the T80 outline.
 */
export const LIGHT_HEADER_IDS: readonly string[] = [
  "00000000-0000-0000-0002-000000000002",
  "00000000-0000-0000-0002-000000000006",
  "00000000-0000-0000-0002-000000000007",
];
export const isLightHeader = (headerId?: string | null) => !!headerId && LIGHT_HEADER_IDS.includes(headerId);

/** The same threshold, for a header that is a plain band of the invoice colour. */
export const LIGHT_SURROUND_TONE = 65;

// ─── Layout: the geometry of the app's drawCircularBadge, on a 600-unit square ─────────────────────────

export const LOGO_BOX = 600;
const R = LOGO_BOX * 0.4;
const C = LOGO_BOX / 2;

function emWidth(text: string, m: FontMetrics): number {
  let w = 0;
  for (const ch of text) w += m.widths[ch] ?? m.fallback;
  return w / 1000;
}

export interface LogoTextLine { text: string; size: number; baseline: number }
export interface GeneratedLogoLayout { initials: LogoTextLine; word: LogoTextLine; ring: number; ringWidth: number; disc: number }

/**
 * Where the initials and the word go, and how large: the largest size that fits the same limits the
 * app's drawing uses — the initials within 1.15 R × 0.95 R above centre, the word within 82 % of the
 * circle's own width at its height.
 */
export function generatedLogoLayout(name?: string | null): GeneratedLogoLayout {
  const initials = logoInitials(name);
  const word = logoWord(name);
  const lhI = NUNITO_EXTRA_BOLD.lineHeight / 1000;
  const wI = emWidth(initials, NUNITO_EXTRA_BOLD);
  const fI = Math.max(R * 0.08, Math.min(R * 2, (R * 1.15) / Math.max(wI, 1e-6), (R * 0.95) / lhI));
  const topI = C - (lhI * fI) / 2 - R * 0.15;

  const dy = R * 0.25;
  const chord = 2 * Math.sqrt(R * R - dy * dy);
  const lhN = NUNITO_BOLD.lineHeight / 1000;
  const wN = emWidth(word, NUNITO_BOLD);
  const fN = Math.max(R * 0.05, Math.min(fI * 0.6, (chord * 0.82) / Math.max(wN, 1e-6), (R * 0.34) / lhN));
  const topN = C + R * 0.25;

  return {
    initials: { text: initials, size: fI, baseline: topI + (NUNITO_EXTRA_BOLD.ascent / 1000) * fI },
    word: { text: word, size: fN, baseline: topN + (NUNITO_BOLD.ascent / 1000) * fN },
    ring: R,
    ringWidth: R * 0.08,
    disc: R * 0.85,
  };
}
