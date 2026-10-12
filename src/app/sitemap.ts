import type { MetadataRoute } from "next";
import { BLOG_POSTS, TEMPLATE_PAGES } from "@/lib/content";

const SITE = "https://www.invotick.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only pages a signed-out visitor can actually open (see PUBLIC_PREFIXES in src/proxy.ts).
  // /templates and /blog redirect to /login, so they are not listed (test row WEB-STATIC-01).
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/privacy-policy`, lastModified: new Date("2026-09-15"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: new Date("2026-09-15"), changeFrequency: "yearly", priority: 0.3 },
  ];
  const blog = BLOG_POSTS.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  const templates = TEMPLATE_PAGES.map((p) => ({
    url: `${SITE}/templates/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...staticPages, ...templates, ...blog];
}
