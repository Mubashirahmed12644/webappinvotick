"use client";

import { useState } from "react";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { LANGUAGES } from "@/lib/translate";
import { translateInvoice, type TranslatedInvoice } from "@/lib/translate-invoice";
import type { InvoiceRenderData } from "@/lib/data";
import { documentDir, documentLanguage } from "@/lib/document-language";

/** Names, in their own language, of the written languages the reader's list does not carry. */
const WRITTEN_NATIVE: Record<string, string> = { tr: "Türkçe", pl: "Polski" };

/**
 * Shared-invoice viewer with a language picker. The invoice ships in its original language; picking a
 * language takes the labels from our committed table — the same words the app shows the sender — and
 * sends only the invoice's free text (item descriptions, notes, payment instructions, terms) to
 * /api/translate, then re-renders the same A4 frame, mirrored for RTL languages (Arabic/Farsi).
 * Decision 0174.
 */
export function SharedInvoiceViewer({ data, qrDataUrl }: { data: InvoiceRenderData; qrDataUrl?: string | null }) {
  // The picker starts on the language the document is written in (decision 0185): a French invoice opens
  // on "Français", and picking it again is the original, not a translation.
  const original = documentLanguage(data.language);
  // The picker's own code for it: Chinese is listed as "zh-CN". A written language the list does not carry (Turkish,
  // Polish) gets its own entry, so the picker never claims the document is in a language it is not; an English
  // document's list is untouched.
  const originalCode = LANGUAGES.find((l) => l.code === original)?.code
    ?? LANGUAGES.find((l) => l.code !== "en" && documentLanguage(l.code) === original)?.code
    ?? original;
  const options = LANGUAGES.some((l) => l.code === originalCode)
    ? LANGUAGES
    : [...LANGUAGES, { code: originalCode, name: originalCode, native: WRITTEN_NATIVE[originalCode] ?? originalCode }];
  const [lang, setLang] = useState<string>(originalCode);
  // The original reads the way it was written: an Arabic document right to left (decision 0187).
  const [view, setView] = useState<TranslatedInvoice>({ data, labels: undefined as never, dir: documentDir(data.language) });
  const [loading, setLoading] = useState(false);

  async function pick(code: string) {
    setLang(code);
    if (code === originalCode) {
      setView({ data, labels: undefined as never, dir: documentDir(data.language) });
      return;
    }
    setLoading(true);
    try {
      setView(await translateInvoice(data, code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative h-full">
      {/* Language picker — floats over the top-right of the invoice. */}
      <div className="absolute right-2 top-2 z-30">
        <label className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white/95 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur">
          <span aria-hidden>🌐</span>
          <select
            value={lang}
            onChange={(e) => pick(e.target.value)}
            disabled={loading}
            className="max-w-[9rem] cursor-pointer bg-transparent pr-1 outline-none disabled:opacity-60"
            aria-label="Invoice language"
          >
            {options.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[#0D4DC0]" />
        </div>
      )}

      <A4PagedFrame data={view.data} labels={view.labels} dir={view.dir} qrDataUrl={qrDataUrl} zoomable />
    </div>
  );
}
