import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSharedInvoice, installUrlForToken } from "@/lib/shared-invoice";
import { ApprovalActions } from "@/components/shared-invoice/ApprovalActions";
import { SharedInvoiceViewer } from "@/components/shared-invoice/SharedInvoiceViewer";
import { ViewBeacon } from "@/components/shared-invoice/ViewBeacon";
import { PdfButton } from "@/components/shared-invoice/PdfButton";

const SITE = "https://www.invotick.com";

type Platform = "android" | "ios" | "desktop";

async function detectPlatform(): Promise<Platform> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

// Short, stable content hash of the invoice — changes whenever the invoice changes (total, items,
// business, …) so the OG card and its blob cache key are versioned per content.
function ogVersion(shared: {
  totalAmount?: number | null;
  invoiceNumber?: string | null;
  snapshot?: unknown;
}): string {
  const basis = `${shared.totalAmount ?? ""}|${shared.invoiceNumber ?? ""}|${JSON.stringify(shared.snapshot ?? {})}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h * 33) ^ basis.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedInvoice(token);
  if (!shared) {
    return { title: "Document not available | Invotick", robots: { index: false, follow: false } };
  }
  // A share link now carries either kind of document, and the card is often the only thing the
  // receiver reads before deciding whether to open it. Calling an estimate an "Invoice" in a
  // WhatsApp preview tells the client they have been billed for something they were only quoted.
  //
  // Read AFTER the null guard, not before it.
  const isEstimate = shared.documentType === "ESTIMATE";
  const kind = isEstimate ? "Estimate" : "Invoice";
  const who = shared.businessName?.trim();
  const number = shared.invoiceNumber?.trim();
  const title = [number ? `${kind} ${number}` : kind, who ? `from ${who}` : null]
    .filter(Boolean)
    .join(" ");
  // The PDF claim is back, because the download exists again (decision 0017). It promises the
  // OUTCOME, not the mechanism: every receiver does get a PDF — in one click on iOS and desktop,
  // after installing on Android. Saying "install the app" here would front-load the cost before the
  // document has even been seen, and this text is read before the link is opened.
  const description = isEstimate
    ? "View this estimate, download the PDF, and approve it. Made with Invotick."
    : "View this invoice and download the PDF. Made with Invotick.";
  // OG image = the blob-backed route, versioned by content so an edited invoice (new total, more
  // items) gets a fresh card instead of the first render forever. `v` changes whenever the invoice
  // changes → new blob key + a new image URL crawlers re-fetch.
  const ogImage = { url: `${SITE}/api/og/${token}?v=${ogVersion(shared)}`, width: 1200, height: 630 };
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
        {/* Neutral wording on purpose: the share could not be loaded, so which kind of document it
            held is exactly what we do not know here. Guessing "invoice" is wrong half as often as
            it is right, and it is the last thing this person reads. */}
        <h1 className="text-2xl font-semibold text-neutral-900">This link is no longer available</h1>
        <p className="mt-3 text-neutral-600">
          It may have been revoked, replaced by a newer version, or expired.
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
  // Derived again here: generateMetadata runs in its own scope, and the two must not drift — the
  // card and the page a receiver opens from it should not call the document different things.
  const kind = shared.documentType === "ESTIMATE" ? "Estimate" : "Invoice";
  const status = shared.approvalStatus ?? "PENDING";
  const decided = status === "APPROVED" || status === "REJECTED";
  const platform = await detectPlatform();
  // Desktop can't install directly → offer a QR that carries the deferred deep link.
  const qrDataUrl =
    platform === "desktop"
      ? await QRCode.toDataURL(installUrl, { width: 176, margin: 1 }).catch(() => null)
      : null;

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col bg-neutral-50">
      {/* Records that a person — not a link unfurler — has the document on screen. Renders nothing;
          it has to be a client component so crawlers, which never run JS, are excluded by design. */}
      <ViewBeacon token={token} />

      <header className="no-print shrink-0 px-4 pt-3 pb-2 text-center">
        <h1 className="truncate text-base font-semibold text-neutral-900 sm:text-lg">
          {shared.invoiceNumber ? `${kind} ${shared.invoiceNumber}` : kind} ·{" "}
          <span className="text-neutral-500">{businessName}</span>
        </h1>
      </header>

      {/* Invoice rendered as HTML from the snapshot — the same <InvoiceDocument> / A4 paging the app
          and free tool use (multi-page, fits width, scrolls). No image upload/wait. */}
      <div className="min-h-0 flex-1 px-3">
        <div className="print-area relative mx-auto h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SharedInvoiceViewer data={shared.snapshot} qrDataUrl="/qr_code.jpg" />
        </div>
      </div>

      {/* Fixed footer — always visible without scrolling: decision + create CTA. */}
      <footer className="no-print shrink-0 space-y-2 px-4 pt-2 pb-4">
        {decided ? (
          <div
            className={`rounded-2xl border p-3 text-center ${
              status === "APPROVED"
                ? "border-[#16A34A]/30 bg-[#16A34A]/5"
                : "border-[#DC2626]/30 bg-[#DC2626]/5"
            }`}
          >
            <p
              className={`text-base font-semibold ${
                status === "APPROVED" ? "text-[#15803D]" : "text-[#DC2626]"
              }`}
            >
              {status === "APPROVED" ? "✓ You approved this invoice" : "✕ You rejected this invoice"}
            </p>
            <p className="text-xs text-neutral-600">The sender has been notified.</p>
          </div>
        ) : (
          <ApprovalActions token={token} compact />
        )}

        {/* Decision 0017: everyone is offered the PDF. Android reaches it through the app, which
            is where the growth loop lives; iOS and desktop get it from the browser, because there is
            no iOS app to install and a desktop has nowhere to be sent. */}
        <div className="flex gap-2">
          <PdfButton platform={platform} installUrl={installUrl} kind={kind} />
          {platform === "android" ? (
            <a
              href={installUrl}
              className="flex-1 rounded-full bg-[#0D4DC0] px-4 py-2.5 text-center text-sm font-medium text-white"
            >
              Install Invotick — free
            </a>
          ) : (
            <Link
              href="/"
              className="flex-1 rounded-full bg-[#0D4DC0] px-4 py-2.5 text-center text-sm font-medium text-white"
            >
              Create yours — free
            </Link>
          )}
        </div>
      </footer>
    </main>
  );
}
