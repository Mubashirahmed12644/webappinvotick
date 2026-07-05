// Server component — semantic, single <h1>, no client JS. This is the SEO
// surface that ranks for "free invoice generator" / "free invoice maker".
export function LandingHero() {
  return (
    <header className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-container)] px-3 py-1 text-xs font-bold text-[var(--color-on-primary-container)]">
        100% free · No sign-up to start
      </span>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-5xl">
        Free Invoice Generator
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--color-on-surface-variant)] sm:text-lg">
        Create a professional invoice in seconds and download it as a PDF — no account, no watermark hassle.
        Fill in the details on the left and watch your invoice build in real time on the right.
      </p>
    </header>
  );
}
