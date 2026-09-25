/**
 * The logo the tool makes out of a business name — the web's answer to the app's
 * `BusinessLogoCanvas` (decision 0165).
 *
 * ## Why this is a feature and not a placeholder
 *
 * The Android app has always drawn a mark from the typed business name and saved it as the
 * business's logo when the user picked no photo
 * (`CreateBusinessScreen.kt:229-243` — the bitmap is generated *before* the save intent runs). It
 * does it silently, so nobody knows it happened. On the guided flow it is shown the moment a name
 * exists, with the three answers a person actually has: keep it, choose a different one, or go
 * without.
 *
 * ## The rules it follows
 *
 * - **Only ever the person's own text.** The initials come from what they typed and nothing else;
 *   there is no dictionary, no guess and no fallback name. An empty name produces no mark at all,
 *   rather than a mark for a business we invented.
 * - **Code points, not UTF-16 units.** `"مُحَمَّد"`, `"नमस्ते"` and an emoji in a shop name are each
 *   more than one `charAt`, and slicing a string by index there produces half a character that
 *   renders as `�`. `Array.from` iterates code points, which is the closest a string gets to
 *   "letters" without a locale-aware segmenter we would then have to ship.
 * - **It is an image, not a font trick.** The PDF is produced by rasterising the paper
 *   (`html2canvas-pro`), and the invoice's logo slot is an `<img>`. A mark drawn as HTML would be
 *   the one thing on the page that looked different in the download, so it is drawn to a canvas and
 *   handed over as the same kind of data URL a chosen photo produces — which is also why keeping it
 *   makes `has_logo=true` on `free_invoice_completed` honestly true.
 */

/** Rendered size of the generated mark, in device pixels. */
const MARK_PX = 256;

/**
 * Up to two initials from a business name, or an empty string when there is nothing to take.
 *
 * Two words give one letter each ("Northgate Coffee" → `NC`); one word gives its first letter only
 * ("Amberleaf" → `A`). Taking two letters from a single word was rejected: `AM` reads as an
 * abbreviation of something, and a wrong abbreviation of the person's own business is worse than
 * one clean letter.
 */
export function initialsFor(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // Skip separators a name may start with — "& Co", "- Traders" — so the mark is never a symbol.
    .filter((w) => Array.from(w).some((c) => /[\p{L}\p{N}]/u.test(c)));

  if (words.length === 0) return "";

  const firstLetter = (word: string) =>
    Array.from(word).find((c) => /[\p{L}\p{N}]/u.test(c)) ?? "";

  if (words.length === 1) return firstLetter(words[0]).toLocaleUpperCase();
  return (firstLetter(words[0]) + firstLetter(words[1])).toLocaleUpperCase();
}

/**
 * Draw the mark and hand it back as a PNG data URL, or null when there is nothing to draw.
 *
 * Null rather than a blank square, on purpose: a caller that gets null must not set a logo, and an
 * empty white tile on an invoice would look like an image that failed to load (G3).
 */
/**
 * The eight designs the onboarding cycles through.
 *
 * Eight, because the person presses "try another" and must not come back round to the same mark
 * before they have decided — and because a design that only differs in hue is not another design.
 * Each is a different *shape* decision: a filled tile, a circle, an outline, a split, a stacked
 * badge, a tinted tile with dark ink, a monogram over a rule, and a corner cut.
 *
 * **The initials are the person's own typed name in every one of them.** Invoice Fly's generated
 * logo rendered its user's "Touchpedia" as "Touchpenty" on the mark that prints on the first
 * invoice; a wrong name on an invoice is a trust cost (G3), and the only way to be unable to make
 * that mistake is never to send the name anywhere to be guessed at. Nothing here leaves the phone.
 */
export const LOGO_DESIGNS = [
  "tile",
  "circle",
  "outline",
  "split",
  "badge",
  "tinted",
  "monogram",
  "notch",
] as const;

export type LogoDesign = (typeof LOGO_DESIGNS)[number];

export interface MarkOptions {
  /** Which of the eight. Out-of-range wraps, so a caller may simply increment for ever. */
  design?: LogoDesign | number;
  /** The trade's glyph, drawn with the initials where the design has room for it. */
  symbol?: string | null;
}

function designAt(design: MarkOptions["design"]): LogoDesign {
  if (typeof design === "number") {
    const n = ((design % LOGO_DESIGNS.length) + LOGO_DESIGNS.length) % LOGO_DESIGNS.length;
    return LOGO_DESIGNS[n];
  }
  return design ?? "tile";
}

/** A slightly darker companion to the brand colour, for the designs built from two tones. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount))),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Draw an emoji glyph, and say whether it actually drew.
 *
 * A platform with no colour emoji font paints nothing — or worse, a `.notdef` box — and a small
 * empty square on an invoice reads as an image that failed to load (G3). Measuring the glyph first
 * is the only way to tell from script, so a symbol that measures nothing is simply left out and the
 * design falls back to initials alone, which was always a complete mark on its own.
 */
function drawSymbol(ctx: CanvasRenderingContext2D, symbol: string, px: number, x: number, y: number): boolean {
  ctx.font = `${Math.round(px)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const w = ctx.measureText(symbol).width;
  if (!w || w < px * 0.2) return false;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x, y);
  return true;
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  // `roundRect` is missing on older Safari and Firefox. A square mark is a rounded mark with the
  // wrong corners; no mark at all would be the person losing their logo because of their browser.
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

/**
 * Draw the mark and hand it back as a PNG data URL, or null when there is nothing to draw.
 *
 * Null rather than a blank square, on purpose: a caller that gets null must not set a logo, and an
 * empty white tile on an invoice would look like an image that failed to load (G3).
 */
export function logoMarkDataUrl(name: string, background: string, options: MarkOptions = {}): string | null {
  const initials = initialsFor(name);
  if (!initials) return null;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = MARK_PX;
  canvas.height = MARK_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const design = designAt(options.design);
  const symbol = options.symbol || null;
  const S = MARK_PX;
  const brand = background;
  const dark = shade(brand, -0.35);
  const light = shade(brand, 0.82);

  // One letter can be drawn bigger than two without either ever reaching the edge.
  const initialsPx = (scale = 1) => Math.round(S * (initials.length > 1 ? 0.42 : 0.55) * scale);
  const setInk = (colour: string, px: number) => {
    ctx.fillStyle = colour;
    ctx.font = `700 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  };
  // `+2%` nudges the optical centre: a cap-height glyph sits high in its own box.
  const NUDGE = S * 0.02;

  switch (design) {
    case "circle": {
      ctx.fillStyle = brand;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.fill();
      setInk("#ffffff", initialsPx());
      ctx.fillText(initials, S / 2, S / 2 + NUDGE);
      break;
    }
    case "outline": {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = brand;
      ctx.lineWidth = S * 0.055;
      roundedPath(ctx, S * 0.07, S * 0.07, S * 0.86, S * 0.86, S * 0.2);
      ctx.stroke();
      setInk(brand, initialsPx(0.88));
      ctx.fillText(initials, S / 2, S / 2 + NUDGE);
      break;
    }
    case "split": {
      roundedPath(ctx, 0, 0, S, S, S * 0.22);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = brand;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(S, 0);
      ctx.lineTo(S, S);
      ctx.lineTo(0, S);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      setInk("#ffffff", initialsPx());
      ctx.fillText(initials, S / 2, S / 2 + NUDGE);
      break;
    }
    case "badge": {
      roundedPath(ctx, 0, 0, S, S, S * 0.22);
      ctx.fillStyle = brand;
      ctx.fill();
      let drew = false;
      if (symbol) {
        ctx.fillStyle = "#ffffff";
        drew = drawSymbol(ctx, symbol, S * 0.3, S / 2, S * 0.35);
      }
      setInk("#ffffff", drew ? initialsPx(0.62) : initialsPx());
      ctx.fillText(initials, S / 2, drew ? S * 0.68 : S / 2 + NUDGE);
      break;
    }
    case "tinted": {
      roundedPath(ctx, 0, 0, S, S, S * 0.22);
      ctx.fillStyle = light;
      ctx.fill();
      setInk(dark, initialsPx());
      ctx.fillText(initials, S / 2, S / 2 + NUDGE);
      break;
    }
    case "monogram": {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, S, S);
      setInk(brand, initialsPx(1.05));
      ctx.fillText(initials, S / 2, S * 0.44);
      ctx.fillStyle = brand;
      ctx.fillRect(S * 0.28, S * 0.7, S * 0.44, S * 0.045);
      break;
    }
    case "notch": {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(S * 0.28, 0);
      ctx.lineTo(S, 0);
      ctx.lineTo(S, S * 0.72);
      ctx.lineTo(S * 0.72, S);
      ctx.lineTo(0, S);
      ctx.lineTo(0, S * 0.28);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = brand;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
      setInk("#ffffff", initialsPx());
      ctx.fillText(initials, S / 2, S / 2 + NUDGE);
      break;
    }
    case "tile":
    default: {
      roundedPath(ctx, 0, 0, S, S, S * 0.22);
      ctx.fillStyle = brand;
      ctx.fill();
      let drew = false;
      if (symbol) {
        ctx.fillStyle = "#ffffff";
        drew = drawSymbol(ctx, symbol, S * 0.26, S * 0.5, S * 0.74);
      }
      setInk("#ffffff", drew ? initialsPx(0.85) : initialsPx());
      ctx.fillText(initials, S / 2, drew ? S * 0.4 : S / 2 + NUDGE);
      break;
    }
  }

  try {
    return canvas.toDataURL("image/png");
  } catch {
    // A tainted canvas cannot happen here (nothing external is drawn), but a browser that refuses
    // `toDataURL` must cost the person their logo and nothing more.
    return null;
  }
}
