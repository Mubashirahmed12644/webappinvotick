import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-on-secondary)] hover:brightness-110 active:brightness-95",
  outline:
    "border border-[var(--color-outline)] text-[var(--color-on-surface)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-variant)]",
  ghost:
    "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]",
  danger:
    "bg-[var(--color-error)] text-[var(--color-on-error)] hover:brightness-110 active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold",
        "transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
