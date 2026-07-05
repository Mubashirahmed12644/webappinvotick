import type { MetadataRoute } from "next";
import { BLOG_POSTS, TEMPLATE_PAGES } from "@/lib/content";

const SITE = "https://www.invotick.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/templates`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
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
