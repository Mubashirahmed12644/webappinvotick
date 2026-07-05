import Link from "next/link";

// Footer with internal links — feeds Google's crawl of /templates, /blog, /privacy.
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
              <Link href="/privacy" className="text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">Privacy Policy</Link>
            </div>
          </nav>
        </div>
        <p className="mt-8 border-t border-[var(--color-outline-variant)] pt-6 text-xs text-[var(--color-on-surface-variant)]">
          © {new Date().getFullYear()} Invotick · Free online invoice generator
        </p>
      </div>
    </footer>
  );
}
