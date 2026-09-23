import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  return (
    /*
      `min-w-0` on the wrapper and `w-full` on the input.

      An `<input>` carries an intrinsic minimum of about twenty characters, and in a flex or grid
      parent an item's automatic minimum is that min-content — so at a 1.5× font scale the field
      stopped shrinking and pushed the whole line-item row 106 px off the side of a 375 px phone
      (measured 2026-09-23; the page scrolled sideways rather than admitting it). These two classes
      say the field may be narrower than its own text wants to be, which is what every one of its
      parents already assumes.
    */
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-on-surface)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full min-w-0 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3.5 text-sm",
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
