"use client";

import { useState } from "react";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { LANGUAGES } from "@/lib/translate";
import { translateInvoice, type TranslatedInvoice } from "@/lib/translate-invoice";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * Shared-invoice viewer with a language picker. The invoice ships in its original language; picking a
 * language translates the labels AND the seller's text (via /api/translate) and re-renders the same
 * A4 frame — mirrored for RTL languages (Arabic/Farsi).
 */
export function SharedInvoiceViewer({ data, qrDataUrl }: { data: InvoiceRenderData; qrDataUrl?: string | null }) {
  const [lang, setLang] = useState("en");
  const [view, setView] = useState<TranslatedInvoice>({ data, labels: undefined as never, dir: "ltr" });
  const [loading, setLoading] = useState(false);

  async function pick(code: string) {
    setLang(code);
    if (code === "en") {
      setView({ data, labels: undefined as never, dir: "ltr" });
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
            {LANGUAGES.map((l) => (
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
