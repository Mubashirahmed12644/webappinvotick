import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEMPLATE_PAGES, getArticle } from "@/lib/content";
import { ArticleView } from "@/components/content/ContentPage";

const SITE = "https://www.invotick.com";

export function generateStaticParams() {
  return TEMPLATE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getArticle(TEMPLATE_PAGES, slug);
  if (!page) return { title: "Not found | Invotick" };
  return {
    title: `${page.title} | Invotick`,
    description: page.description,
    alternates: { canonical: `/templates/${page.slug}` },
    openGraph: { type: "article", title: page.title, description: page.description, url: `${SITE}/templates/${page.slug}` },
  };
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getArticle(TEMPLATE_PAGES, slug);
  if (!page) notFound();
  return <ArticleView article={page} kind="templates" kindLabel="Templates" />;
}
