import Link from "next/link";
import type { ReactNode } from "react";

export type LegalSection = { id: string; heading: string; body: ReactNode };

/**
 * One layout for the public legal pages (/privacy-policy, /terms).
 *
 * Both are linked from the app stores and from inside the apps, so most readers arrive on a phone:
 * one narrow column, a contents list that jumps to each heading, and nothing that needs a session.
 */
export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">
          Invotick
        </Link>
        <div className="flex gap-4 text-sm font-semibold">
          <Link href="/privacy-policy" className="text-[var(--color-primary)]">Privacy</Link>
          <Link href="/terms" className="text-[var(--color-primary)]">Terms</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Effective date: {effectiveDate}</p>

        <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-[var(--color-on-surface)]">{intro}</div>

        <nav
          aria-label="On this page"
          className="mt-8 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">On this page</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[var(--color-primary)] underline-offset-2 hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-on-background)]">
              {i + 1}. {s.heading}
            </h2>
            <div className="legal-body mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--color-on-surface)] [&_a]:font-semibold [&_a]:text-[var(--color-primary)] [&_a]:underline [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-[var(--color-on-background)] [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}

        <footer className="mt-14 border-t border-[var(--color-outline-variant)] pt-6 text-sm text-[var(--color-on-surface-variant)]">
          <p>
            <Link href="/privacy-policy" className="font-semibold text-[var(--color-primary)] underline">Privacy Policy</Link>
            {" · "}
            <Link href="/terms" className="font-semibold text-[var(--color-primary)] underline">Terms of Use</Link>
            {" · "}
            <Link href="/" className="font-semibold text-[var(--color-primary)] underline">Invotick home</Link>
          </p>
          <p className="mt-2">© 2026 Invotick</p>
        </footer>
      </main>
    </div>
  );
}

/** A table that scrolls sideways inside its own box on a phone, never the page. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-outline-variant)]">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-[var(--color-surface-variant)]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-bold text-[var(--color-on-background)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--color-outline-variant)] align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
