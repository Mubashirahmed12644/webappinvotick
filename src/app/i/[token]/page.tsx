import type { Metadata } from "next";
import Link from "next/link";
import { getSharedInvoice, installUrlForToken } from "@/lib/shared-invoice";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";

const SITE = "https://www.invotick.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedInvoice(token);
  if (!shared) {
    return { title: "Invoice not available | Invotick", robots: { index: false, follow: false } };
  }
  const who = shared.businessName?.trim();
  const number = shared.invoiceNumber?.trim();
  const title = [number ? `Invoice ${number}` : "Invoice", who ? `from ${who}` : null]
    .filter(Boolean)
    .join(" ");
  const description = "View this invoice and download it as a PDF. Made with Invotick.";
  // OG image = the blob-backed route: rendered once, then served as a static,
  // globally-cached PNG so every crawl (any region) is instant.
  const ogImage = { url: `${SITE}/api/og/${token}`, width: 1200, height: 630 };
  return {
    title: `${title} | Invotick`,
    description,
    // Private by design — share links must not be indexed/searchable.
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE}/i/${token}` },
    openGraph: { type: "website", title, description, url: `${SITE}/i/${token}`, images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage.url] },
  };
}

export default async function SharedInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedInvoice(token);

  if (!shared) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Invoice not available</h1>
        <p className="mt-3 text-neutral-600">
          This invoice link is no longer available — it may have been revoked or expired.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-[#0D4DC0] px-6 py-3 font-medium text-white"
        >
          Create your own invoice — free
        </Link>
      </main>
    );
  }

  const installUrl = installUrlForToken(token);
  const businessName = shared.businessName?.trim() || "a business";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#0D4DC0]">Invoice</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          {shared.invoiceNumber ? `Invoice ${shared.invoiceNumber}` : "Invoice"} from {businessName}
        </h1>
      </header>

      {/* The exact rendered invoice (same document component as the free tool + app PDF). */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <InvoiceDocument data={shared.snapshot} />
      </div>

      {/* Install CTA — the growth loop. Big, above the fold on mobile after the invoice. */}
      <section className="mt-8 rounded-2xl border border-[#0D4DC0]/20 bg-[#0D4DC0]/5 p-6 text-center">
        <h2 className="text-lg font-semibold text-neutral-900">Get this invoice as a PDF</h2>
        <p className="mt-2 text-neutral-600">
          Install Invotick (free) to save this invoice as a PDF and make your own in seconds.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={installUrl}
            className="w-full rounded-full bg-[#0D4DC0] px-6 py-3 font-medium text-white sm:w-auto"
          >
            Install Invotick — free
          </a>
          <Link
            href="/"
            className="w-full rounded-full border border-neutral-300 px-6 py-3 font-medium text-neutral-800 sm:w-auto"
          >
            Create an invoice online
          </Link>
        </div>
      </section>
    </main>
  );
}
