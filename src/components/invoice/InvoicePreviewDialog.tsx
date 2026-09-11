"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { A4PagedFrame } from "./A4PagedFrame";
import { PLACEHOLDER_BUSINESS_NAME } from "@/lib/invoice-preview";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * The invoice form's Preview. Drawn by the same A4PagedFrame as the share link and the app's Online
 * tab, so it shows the invoice as it will look. It only shows: nothing in here saves, and it opens
 * before a business is chosen (the owner, 2026-09-11 — a preview may come before the business, an
 * invoice may not).
 *
 * Mounted only after a click, so `document` exists for the portal. The portal also keeps the dialog
 * outside the <form> in the DOM, so no button in here can submit it.
 */
export function InvoicePreviewDialog({
  data,
  businessMissing,
  problems = [],
  saveLabel,
  onClose,
}: {
  data: InvoiceRenderData;
  businessMissing: boolean;
  /** What stands between the form and Save. The preview draws only the items that can be sent. */
  problems?: string[];
  saveLabel: string;
  onClose: () => void;
}) {
  // Escape closes; focus goes back to whatever opened the preview (its button).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-preview-title"
      className="fixed inset-0 z-50 flex bg-black/60 p-2 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-outline-variant)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="invoice-preview-title" className="font-bold text-[var(--color-on-surface)]">Preview</h2>
            <p className="text-xs text-[var(--color-on-surface-variant)]">Nothing is saved until you press {saveLabel}.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
        {businessMissing && (
          <p className="shrink-0 bg-[var(--color-secondary-container)] px-4 py-2 text-sm text-[var(--color-on-secondary-container)]">
            No business chosen yet, so &ldquo;{PLACEHOLDER_BUSINESS_NAME}&rdquo; stands in for it. The invoice can be
            created once you choose one.
          </p>
        )}
        {problems.length > 0 && (
          <div className="shrink-0 bg-[var(--color-error-container)] px-4 py-2 text-sm text-[var(--color-on-error-container)]">
            <p className="font-semibold">To fix before saving:</p>
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {/* A4PagedFrame fills its positioned parent. */}
        <div className="relative min-h-0 flex-1">
          <A4PagedFrame data={data} qrDataUrl="/qr_code.jpg" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
