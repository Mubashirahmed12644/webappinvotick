// Content source for /blog and /templates pages. Add entries here — the routes,
// SEO metadata, sitemap and static generation pick them up automatically.
// `body` is owner-authored HTML (rendered inside a prose container).
export interface Article {
  slug: string;
  title: string; // used as <h1> and <title>
  description: string; // meta description (150-160 chars)
  date: string; // YYYY-MM-DD (lastModified / published)
  body: string; // HTML content
}

// Blog posts — e.g. "how to write an invoice", "invoice payment terms".
export const BLOG_POSTS: Article[] = [];

// Template landing pages — e.g. "consulting invoice template".
export const TEMPLATE_PAGES: Article[] = [];

export function getArticle(list: Article[], slug: string): Article | undefined {
  return list.find((a) => a.slug === slug);
}
