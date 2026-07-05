import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getArticle } from "@/lib/content";
import { ArticleView } from "@/components/content/ContentPage";

const SITE = "https://www.invotick.com";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getArticle(BLOG_POSTS, slug);
  if (!post) return { title: "Not found | Invotick" };
  return {
    title: `${post.title} | Invotick`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, url: `${SITE}/blog/${post.slug}` },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getArticle(BLOG_POSTS, slug);
  if (!post) notFound();
  return <ArticleView article={post} kind="blog" kindLabel="Blog" />;
}
