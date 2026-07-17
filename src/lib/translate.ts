/**
 * Invoice translation via Google's free (unofficial) translate endpoint. Used to localise the
 * shared HTML invoice (labels + the seller's own data) into the receiver's language.
 *
 * Batching: all strings are joined with newlines and translated in ONE request; the endpoint keeps
 * the `\n` segment boundaries, so we split the result back 1:1. Runs SERVER-SIDE only (Next.js route
 * `/api/translate`) — the endpoint has no CORS headers and we don't want to expose per-render calls
 * to the browser.
 */

export type Lang = { code: string; name: string; native: string; rtl?: boolean };

// Phase-1 languages: everything Google Analytics saw for Invotick + Chinese (mandatory). `en` is the
// canonical source (no translation). Arabic + Persian are RTL → the invoice mirrors for them.
export const LANGUAGES: Lang[] = [
  { code: "en", name: "English", native: "English" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "km", name: "Khmer", native: "ខ្មែរ" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "my", name: "Burmese", native: "မြန်မာ" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
];

export const RTL_LANGS = new Set(LANGUAGES.filter((l) => l.rtl).map((l) => l.code));

export function isRtl(code: string): boolean {
  return RTL_LANGS.has(code);
}

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/**
 * Translate a batch of strings into [target] (a Google language code). Preserves order + length:
 * `out[i]` is the translation of `in[i]`. Empty/whitespace strings pass through untouched. On any
 * failure the originals are returned (translation is best-effort — never blocks the render).
 */
export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  if (target === "en" || texts.length === 0) return texts;

  // Remember which entries actually need translating (skip blanks / pure numbers-symbols).
  const idx: number[] = [];
  const payload: string[] = [];
  texts.forEach((t, i) => {
    const s = (t ?? "").toString();
    if (s.trim() && /\p{L}/u.test(s)) {
      idx.push(i);
      // Newlines are our segment separator — flatten any inside a value so counts stay 1:1.
      payload.push(s.replace(/\s*\n\s*/g, " ").trim());
    }
  });
  if (payload.length === 0) return texts;

  try {
    const translated = await translateLines(payload, target);
    if (translated.length !== payload.length) return texts; // segmentation drift → keep originals
    const out = [...texts];
    idx.forEach((originalIndex, k) => {
      out[originalIndex] = translated[k];
    });
    return out;
  } catch {
    return texts;
  }
}

// One request for up to CHUNK lines (URL-length safe); joins with \n, splits the reply back.
const CHUNK = 80;

async function translateLines(lines: string[], target: string): Promise<string[]> {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    const q = chunk.join("\n");
    const url = `${ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`translate ${res.status}`);
    const data = (await res.json()) as [Array<[string, string]>];
    const joined = (data[0] || []).map((seg) => seg[0] ?? "").join("");
    // Each source line ended in \n, which the endpoint preserves → split back to lines.
    const parts = joined.split("\n");
    // Drop a trailing empty produced by the final \n.
    if (parts.length > chunk.length && parts[parts.length - 1] === "") parts.pop();
    if (parts.length !== chunk.length) throw new Error(`segment drift ${parts.length}/${chunk.length}`);
    result.push(...parts.map((p) => p.trim()));
  }
  return result;
}
