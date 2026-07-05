import type { Metadata } from "next";
import { BLOG_POSTS } from "@/lib/content";
import { ArticleIndex } from "@/components/content/ContentPage";

export const metadata: Metadata = {
  title: "Invoicing Blog — Tips & Guides | Invotick",
  description: "Guides on invoicing, payment terms and getting paid faster — from the Invotick free invoice generator.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <ArticleIndex
      heading="Invoicing blog"
      intro="Practical guides on creating invoices, payment terms and getting paid faster."
      kind="blog"
      items={BLOG_POSTS}
    />
  );
}
