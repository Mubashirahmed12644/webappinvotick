"use client";

import type { Ref } from "react";

/**
 * "Did you mean ahmad.raza@gmail.com?" under the e-mail field.
 *
 * A real button: one tap puts the corrected address in the field. Ignoring it is simply carrying on,
 * so it has no close mark. The address is an identifier, so it is left-to-right isolated and wraps
 * rather than being cut with an ellipsis, and the corrected domain is bold so the difference is the
 * first thing seen. The wrapper is a polite live region, so a screen reader hears the chip arrive.
 */
export function EmailSuggestionChip({
  suggestion,
  announcement,
  onAccept,
  buttonRef,
}: {
  suggestion: string | null;
  /** Spoken (not drawn) after the chip was used: "Email changed to ...". */
  announcement: string;
  onAccept: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const at = suggestion ? suggestion.indexOf("@") : -1;
  return (
    <div aria-live="polite">
      {suggestion && at > 0 && (
        <button
          ref={buttonRef}
          type="button"
          onClick={onAccept}
          aria-label={`Use ${suggestion} as your email`}
          className="mt-2 flex min-h-11 w-full items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--color-secondary-container)] px-3 py-2.5 text-start text-sm text-[var(--color-on-secondary-container)] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          >
            <path d="M4 7h11a5 5 0 0 1 0 10H9" />
            <path d="M8 3 4 7l4 4" />
          </svg>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Did you mean{" "}
            <bdi dir="ltr">
              {suggestion.slice(0, at + 1)}
              <b>{suggestion.slice(at + 1)}</b>
            </bdi>
            ?
          </span>
        </button>
      )}
      {!suggestion && announcement && <span className="sr-only">{announcement}</span>}
    </div>
  );
}
