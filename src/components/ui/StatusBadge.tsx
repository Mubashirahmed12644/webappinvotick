import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const styles: Record<InvoiceStatus, string> = {
  PAID: "bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]",
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
