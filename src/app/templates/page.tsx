import type { Metadata } from "next";
import { TEMPLATE_PAGES } from "@/lib/content";
import { ArticleIndex } from "@/components/content/ContentPage";

export const metadata: Metadata = {
  title: "Free Invoice Templates | Invotick",
  description: "Free, professional invoice templates for every business — fill in and download a PDF in seconds with Invotick.",
  alternates: { canonical: "/templates" },
};

export default function TemplatesIndex() {
  return (
    <ArticleIndex
      heading="Free invoice templates"
      intro="Professional invoice templates for every trade — open one and download a PDF in seconds."
      kind="templates"
      items={TEMPLATE_PAGES}
    />
  );
}
