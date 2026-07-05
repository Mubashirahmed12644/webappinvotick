import Link from "next/link";
import type { Article } from "@/lib/content";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">Invotick</Link>
        <Link href="/" className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:brightness-110">
          Free invoice generator
        </Link>
      </nav>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">{children}</main>
      <footer className="border-t border-[var(--color-outline-variant)] py-6 text-center text-xs text-[var(--color-on-surface-variant)]">
        © {new Date().getFullYear()} Invotick
      </footer>
    </div>
  );
}

// Single article (/blog/[slug], /templates/[slug]).
export function ArticleView({ article, kind, kindLabel }: { article: Article; kind: string; kindLabel: string }) {
  return (
    <Shell>
      <nav className="text-xs text-[var(--color-on-surface-variant)]">
        <Link href="/" className="hover:underline">Home</Link> ›{" "}
        <Link href={`/${kind}`} className="hover:underline">{kindLabel}</Link>
      </nav>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-4xl">{article.title}</h1>
      <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
        {new Date(article.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div
        className="mt-6 space-y-4 text-[var(--color-on-surface)] [&_a]:text-[var(--color-primary)] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />
    </Shell>
  );
}

// Index listing (/blog, /templates).
export function ArticleIndex({ heading, intro, kind, items }: { heading: string; intro: string; kind: string; items: Article[] }) {
  return (
    <Shell>
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-on-background)] sm:text-4xl">{heading}</h1>
      <p className="mt-3 text-[var(--color-on-surface-variant)]">{intro}</p>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--color-on-surface-variant)]">New articles are coming soon.</p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--color-outline-variant)]">
          {items.map((a) => (
            <li key={a.slug} className="py-4">
              <Link href={`/${kind}/${a.slug}`} className="block">
                <h2 className="text-lg font-bold text-[var(--color-on-surface)] hover:text-[var(--color-primary)]">{a.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">{a.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
