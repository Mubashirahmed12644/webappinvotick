import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-on-surface)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3.5 text-sm",
          "text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent",
          error ? "border-[var(--color-error)]" : "border-[var(--color-outline-variant)]",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs font-medium text-[var(--color-error)]">{error}</span>}
    </div>
  );
}
