import { FAQ_ITEMS } from "./faq-data";

// Server component — semantic <details> accordion, no client JS, crawlable text.
export function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <h2 id="faq-heading" className="text-center text-2xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-3xl">
        Frequently asked questions
      </h2>
      <div className="mt-6 divide-y divide-[var(--color-outline-variant)] rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 sm:px-6">
        {FAQ_ITEMS.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[var(--color-on-surface)]">
              {f.q}
              <svg className="h-5 w-5 shrink-0 text-[var(--color-on-surface-variant)] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
