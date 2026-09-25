import Link from "next/link";
import { StoreBadges } from "./StoreBadges";
import { FooterYear } from "./FooterYear";

/**
 * Footer with internal links — feeds Google's crawl of /templates, /blog, /privacy-policy, /terms.
 *
 * **The store badges live here**, which is where Invoice Fly's own page puts theirs: App Store and
 * Google Play at the very bottom, after Pricing / Blog / Help Center and just above the copyright,
 * with no store button above the fold at all. The landing's job is to get a stranger into an
 * invoice; a button above the fold that leads to a store is a way out of that. The badges
 * themselves are unchanged — including the device-aware ordering decision 0164 made.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <span className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">Invotick</span>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              Free online invoice generator — create and download professional invoices in seconds.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-12">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Product</p>
              <Link href="/" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Invoice generator</Link>
              <Link href="/templates" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Templates</Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Resources</p>
              <Link href="/blog" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Blog</Link>
              <Link href="/privacy-policy" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Privacy Policy</Link>
              <Link href="/terms" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Terms of Use</Link>
            </div>
          </nav>
        </div>
        {/* Where the app is offered — at the bottom, after everything this page came to do. */}
        <div className="mt-8 border-t border-[var(--color-outline-variant)] pt-6">
          <StoreBadges />
        </div>

        <p className="mt-8 border-t border-[var(--color-outline-variant)] pt-6 text-xs text-[var(--color-on-surface-variant)]">
          © <FooterYear /> Invotick · Free online invoice generator
        </p>
      </div>
    </footer>
  );
}
