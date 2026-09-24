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
export function logoMarkDataUrl(name: string, background: string): string | null {
  const initials = initialsFor(name);
  if (!initials) return null;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = MARK_PX;
  canvas.height = MARK_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = background;
  // `roundRect` is the shape we want and is missing on older Safari and Firefox. A square mark is
  // a rounded mark with the wrong corners; no mark at all would be the person losing their logo
  // because of their browser, which is not a trade worth making.
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(0, 0, MARK_PX, MARK_PX, MARK_PX * 0.22);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, MARK_PX, MARK_PX);
  }

  // One letter can be drawn bigger than two without either ever reaching the edge.
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(MARK_PX * (initials.length > 1 ? 0.42 : 0.55))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // `+2` nudges the optical centre: a cap-height glyph sits high in its own box.
  ctx.fillText(initials, MARK_PX / 2, MARK_PX / 2 + MARK_PX * 0.02);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    // A tainted canvas cannot happen here (nothing external is drawn), but a browser that refuses
    // `toDataURL` must cost the person their logo and nothing more.
    return null;
  }
}
