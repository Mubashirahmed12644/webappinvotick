import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

// Each status is a container/on-container pair, so the fill and the text on it always come from the
// same tonal palette and cannot be mismatched.
//
// PAID used to be `secondary-container`. That worked only by coincidence — the theme's secondary
// happened to be green — and it broke the moment secondary was derived properly and turned
// blue-grey. "Paid" is a MEANING, not an accent, and it now reads from the success tokens, which
// exist for exactly this and are mirrored from the app's InvotickExtendedColors.
const styles: Record<InvoiceStatus, string> = {
  PAID: "bg-[var(--color-success-container)] text-[var(--color-on-success-container)]",
  SENT: "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]",
  DRAFT: "bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]",
  OVERDUE: "bg-[var(--color-error-container)] text-[var(--color-on-error-container)]",
  CANCELLED: "bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)]",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
