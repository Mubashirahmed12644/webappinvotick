import type { Metadata } from "next";
import Link from "next/link";
import { LandingHero } from "@/components/landing/LandingHero";
import { FreeInvoiceTool } from "@/components/free-invoice/FreeInvoiceTool";

const SITE = "https://www.invotick.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Free Invoice Generator — Create & Download Invoices Online | Invotick",
  description:
    "Make professional invoices for free with Invotick's online invoice generator. Add your logo, line items and tax, then download a PDF instantly — no sign-up required.",
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Public top bar */}
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">
          Invotick
        </span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:brightness-110">
            Create account
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <LandingHero />

        <section aria-label="Invoice generator" className="mt-10 sm:mt-12">
          <FreeInvoiceTool />
        </section>

        {/* Honest privacy line */}
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-[var(--color-on-surface-variant)]">
          Your invoices are saved only in this browser — nothing is sent to our servers until you sign in
          to back them up. By using this tool you agree to our{" "}
          <Link href="/privacy" className="font-semibold text-[var(--color-primary)] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </main>

      <footer className="border-t border-[var(--color-outline-variant)] py-6 text-center text-xs text-[var(--color-on-surface-variant)]">
        © {new Date().getFullYear()} Invotick · Free online invoice generator
      </footer>
    </div>
  );
}
