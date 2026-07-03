import { cn } from "@/lib/cn";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
        <path
          d="M10 8.5h9a3.5 3.5 0 0 1 0 7h-4.5m0 0H10m4.5 0L21 23.5M12.5 8.5v15"
          stroke="var(--color-on-primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <span className="text-xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
          Invotick
        </span>
      )}
    </span>
  );
}
