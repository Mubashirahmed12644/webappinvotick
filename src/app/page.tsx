import type { Metadata } from "next";
import Link from "next/link";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { FreeInvoicePageView } from "@/components/free-invoice/FreeInvoicePageView";
import { Faq } from "@/components/landing/Faq";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { FAQ_ITEMS } from "@/components/landing/faq-data";

const SITE = "https://www.invotick.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Free Invoice Generator — Create & Download Invoices Online | Invotick",
  // ~152 chars, targets: free invoice generator / create invoice / download PDF invoice
  description:
    "Free invoice generator — create a professional invoice online and download a PDF invoice in seconds. Add your logo, items and tax. No sign-up needed.",
  keywords: [
    "free invoice generator",
    "free invoice maker",
    "invoice generator online",
    "create invoice free",
    "invoice template",
    "download invoice pdf",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Invotick",
    title: "Free Invoice Generator — Create & Download Invoices Online",
    description:
      "Create a professional invoice in seconds and download it as a PDF. Free, no sign-up to start.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Invoice Generator | Invotick",
    description: "Create and download professional invoices for free — no sign-up to start.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Invotick Free Invoice Generator",
      url: SITE + "/",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description:
        "Free online invoice generator to create professional invoices and download them as PDF — no sign-up required.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Invotick", url: SITE + "/" },
    },
    {
      "@type": "Organization",
      name: "Invotick",
      url: SITE + "/",
      logo: SITE + "/invotick-icon.png",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Structured data for rich results (WebApplication + Organization) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Public top bar */}
      {/* `flex-wrap`, and both links `whitespace-nowrap`. At a 1.5× font scale the row does not fit,
          and without this it broke the way `LAYOUT_RULES.md` describes — "Sign in" split across two
          lines inside its own button. Wrapping the ROW puts the links on a second line whole; only
          the container gives way. */}
      <nav className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-4 sm:px-6">
        <span className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">
          Invotick
        </span>
        {/*
          Two plain text links, and neither is a button.

          "Create account" was an outlined button in the most valuable corner of a page that
          promises "no sign-up", so the first thing an arriving stranger was offered was the one
          thing the page says they do not need. One filled element per screen is the owner's rule,
          and on this page that element is "Create invoice" — everything else gives way to it.

          It is demoted rather than removed: somebody who already has an account arrives here too,
          and taking their way in would be a worse trade than a quiet link.
        */}
        <div className="flex items-center gap-1">
          <Link href="/login" className="whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]">
            Sign in
          </Link>
          <Link href="/signup" className="whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-on-surface)]">
            Create account
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {/*
          The first step of the free-tool funnel (decision 0163). Renders nothing, and lives HERE —
          at the page, not inside the tool — so that `free_invoice_page_view` keeps meaning exactly
          what it has always meant: somebody landed on this page. The tool is now behind a button,
          and moving this line inside it would turn the funnel's own denominator into a count of the
          people who pressed the button.
        */}
        <FreeInvoicePageView />

        <LandingExperience />

        {/* Honest privacy line */}
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-[var(--color-on-surface-variant)]">
          Your invoices are saved only in this browser — nothing is sent to our servers until you sign in
          to back them up. By using this tool you agree to our{" "}
          <Link href="/terms" className="font-semibold text-[var(--color-primary)] underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="font-semibold text-[var(--color-primary)] underline">
            Privacy Policy
          </Link>
          .
        </p>

        <Faq />
      </main>

      <SiteFooter />
    </div>
  );
}
