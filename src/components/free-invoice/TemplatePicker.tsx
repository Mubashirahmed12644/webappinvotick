"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { TEMPLATES, type InvoiceTemplate } from "@/lib/free-invoice/templates";

// Lazy-loaded (see FreeInvoiceTool's dynamic import) so neither this JS nor the
// header images weigh on the landing page's first load. Thumbnails use
// loading="lazy" as a second guard.
export function TemplatePicker({ selectedId, currentColor, onSelect }: { selectedId: string; currentColor: string; onSelect: (t: InvoiceTemplate) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
      {TEMPLATES.map((t) => {
        const active = t.id === selectedId;
        // "Simple" is a solid band — mirror the invoice's current colour so it
        // matches whatever "Surprise me" (or a picked template) set.
        const swatch = t.id === "simple" ? currentColor : t.color;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            aria-pressed={active}
            className={cn(
              "overflow-hidden rounded-[var(--radius-sm)] border text-left transition",
              active
                ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                : "border-[var(--color-outline-variant)] hover:border-[var(--color-primary)]",
            )}
          >
            {/* Fixed-height container reserves the aspect ratio (no CLS); next/image
                serves WebP/AVIF and lazy-loads, keeping the landing light. */}
            <div className="relative flex h-10 w-full items-center justify-center overflow-hidden" style={{ backgroundColor: swatch }}>
              {t.headerImage ? (
                <Image
                  src={t.headerImage}
                  alt={`${t.name} invoice template`}
                  fill
                  sizes="(max-width: 1280px) 33vw, 220px"
                  className="object-cover"
                />
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">Solid</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <span className="truncate text-xs font-semibold text-[var(--color-on-surface)]">{t.name}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: swatch }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
