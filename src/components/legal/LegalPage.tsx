import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export type LegalSection = { id: string; heading: string; body: ReactNode };

/**
 * One layout for the public legal pages (/privacy-policy, /terms).
 *
 * Both are linked from the app stores and from inside the apps, so most readers arrive on a phone:
 * one narrow column, a contents list that jumps to each heading, and nothing that needs a session.
 *
 * These two pages are the only privacy policy and terms Google Play and the App Store link to, so
 * they are a trust surface: the app's own icon and brand colours (globals.css, mirrored from the
 * Android theme), a readable measure of about 70 characters, and a contents card that works with a
 * thumb. Every string on the page comes from the page files — this file adds layout, never words.
 */

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-3.5 py-2.5 text-sm font-bold transition-colors ${FOCUS} ${
        active
          ? "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
          : "text-[var(--color-primary)] hover:bg-[var(--color-primary-container)]/50"
      }`}
    >
      {label}
    </Link>
  );
}

/** A chain link that appears on hover/focus and points at this section's own anchor. */
function AnchorMark({ id, heading }: { id: string; heading: string }) {
  return (
    <a
      href={`#${id}`}
      aria-label={`Link to section: ${heading}`}
      className={`ml-2 hidden h-8 w-8 shrink-0 translate-y-0.5 items-center justify-center rounded-lg sm:inline-flex text-[var(--color-outline)] opacity-0 transition-opacity hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-primary)] focus-visible:opacity-100 group-hover:opacity-100 ${FOCUS}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
      </svg>
    </a>
  );
}

export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
  current,
}: {
  title: string;
  effectiveDate: string;
  intro: ReactNode;
  sections: LegalSection[];
  /** Which of the two legal pages this is, so its tab in the brand bar reads as the current one. */
  current?: "privacy" | "terms";
}) {
  return (
    <div id="top" className="min-h-screen bg-[var(--color-background)]">
      {/* Brand bar — the app's own icon, so a reader arriving from a store listing recognises it. */}
      <header className="no-print sticky top-0 z-30 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className={`inline-flex min-h-11 items-center gap-2.5 rounded-xl pr-2 ${FOCUS}`}
          >
            <Image
              src="/invotick-icon.png"
              alt="Invotick app icon"
              width={80}
              height={80}
              priority
              className="h-9 w-9 rounded-[10px] shadow-sm ring-1 ring-black/5"
            />
            <span className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">
              Invotick
            </span>
          </Link>
          <nav aria-label="Legal pages" className="flex items-center gap-1">
            <NavTab href="/privacy-policy" label="Privacy" active={current === "privacy"} />
            <NavTab href="/terms" label="Terms" active={current === "terms"} />
          </nav>
        </div>
      </header>

      <div className="relative">
        {/* A soft brand wash behind the title, so the page opens on something other than grey. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[var(--color-primary-container)]/70 via-[var(--color-primary-container)]/20 to-transparent"
        />

        <main className="relative mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight text-[var(--color-on-background)] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4">
            <span className="inline-flex items-center rounded-full bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-on-primary-container)] shadow-sm ring-1 ring-[var(--color-outline-variant)]">
              Effective date: {effectiveDate}
            </span>
          </p>

          <div className="mt-6 max-w-[58ch] space-y-3 text-base leading-7 text-[var(--color-on-surface)] [&_a]:font-semibold [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2">
            {intro}
          </div>

          {/* On this page — two columns once there is room, one thumb-sized row each on a phone. */}
          <nav
            aria-label="On this page"
            className="mt-10 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              On this page
            </p>
            <ol className="mt-3 columns-1 gap-x-10 sm:columns-2">
              {sections.map((s) => (
                <li
                  key={s.id}
                  className="ml-7 list-decimal break-inside-avoid marker:text-xs marker:font-bold marker:tabular-nums marker:text-[var(--color-outline)]"
                >
                  <a
                    href={`#${s.id}`}
                    className={`flex min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-primary-container)]/45 hover:text-[var(--color-primary)] ${FOCUS}`}
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* The document itself: one sheet, sections divided by hairlines. */}
          <article className="print-area mt-8 overflow-hidden rounded-3xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] shadow-sm">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={`scroll-mt-20 px-5 py-8 sm:px-8 sm:py-10 ${
                  i > 0 ? "border-t border-[var(--color-outline-variant)]" : ""
                }`}
              >
                <h2 className="group flex items-start text-xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-2xl">
                  {/* The number is the same text as before ("1." + space + heading) — the full
                      stop is only hidden from the eye, never from a screen reader or the text. */}
                  <span className="mr-3 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-sm font-extrabold tabular-nums text-[var(--color-on-primary-container)]">
                    {i + 1}
                    <span className="sr-only">.</span>
                  </span>{" "}
                  <span>{s.heading}</span>
                  <AnchorMark id={s.id} heading={s.heading} />
                </h2>
                {/* The measure sits on the text itself, not on the block, so a table is free to
                    use the full width of the sheet while prose stays at ~70 characters. */}
                <div className="legal-body mt-4 space-y-4 text-base leading-7 text-[var(--color-on-surface)] [&>h3]:max-w-[58ch] [&>ol]:max-w-[58ch] [&>p]:max-w-[58ch] [&>ul]:max-w-[58ch] [&_a]:font-semibold [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-[var(--color-primary)] [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-[var(--color-on-background)] [&_li]:mt-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-[var(--color-on-background)] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-[var(--color-primary)]">
                  {s.body}
                </div>
              </section>
            ))}
          </article>

          <footer className="mt-12 text-sm text-[var(--color-on-surface-variant)]">
            <nav
              aria-label="Legal"
              className="-mx-2 flex flex-wrap items-center gap-x-1 font-semibold text-[var(--color-outline)]"
            >
              <Link
                href="/privacy-policy"
                className={`inline-flex min-h-11 items-center rounded-lg px-2 text-[var(--color-primary)] underline underline-offset-2 hover:bg-[var(--color-primary-container)]/45 `}
              >
                Privacy Policy
              </Link>
              {" · "}
              <Link
                href="/terms"
                className={`inline-flex min-h-11 items-center rounded-lg px-2 text-[var(--color-primary)] underline underline-offset-2 hover:bg-[var(--color-primary-container)]/45 `}
              >
                Terms of Use
              </Link>
              {" · "}
              <Link
                href="/"
                className={`inline-flex min-h-11 items-center rounded-lg px-2 text-[var(--color-primary)] underline underline-offset-2 hover:bg-[var(--color-primary-container)]/45 `}
              >
                Invotick home
              </Link>
            </nav>
            <p className="mt-3 border-t border-[var(--color-outline-variant)] pt-5">
              © 2026 Flixotech LLC · Invotick
            </p>
          </footer>
        </main>
      </div>

      {/* Back to the top — a page this long is otherwise a long swipe back to the contents. */}
      <a
        href="#top"
        aria-label="Back to top"
        className={`no-print fixed bottom-5 right-5 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface)]/95 text-[var(--color-primary)] shadow-lg backdrop-blur transition-colors hover:bg-[var(--color-primary-container)] ${FOCUS}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </a>
    </div>
  );
}

/** A table that scrolls sideways inside its own box on a phone, never the page. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-outline-variant)] shadow-sm">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead className="bg-[var(--color-surface-variant)]">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`border-t border-[var(--color-outline-variant)] align-top ${
                i % 2 === 1 ? "bg-[var(--color-background)]" : ""
              }`}
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 leading-6 ${
                    j === 0 ? "font-bold text-[var(--color-on-background)]" : "text-[var(--color-on-surface)]"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
