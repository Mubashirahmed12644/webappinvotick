import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSharedInvoice, installUrlForToken } from "@/lib/shared-invoice";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { ApprovalActions } from "@/components/shared-invoice/ApprovalActions";
import { ZoomableImage } from "@/components/shared-invoice/ZoomableImage";

const SITE = "https://www.invotick.com";

type Platform = "android" | "ios" | "desktop";

async function detectPlatform(): Promise<Platform> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

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
      <header className="shrink-0 px-4 pt-3 pb-2 text-center">
        <h1 className="truncate text-base font-semibold text-neutral-900 sm:text-lg">
          {shared.invoiceNumber ? `Invoice ${shared.invoiceNumber}` : "Invoice"} ·{" "}
          <span className="text-neutral-500">{businessName}</span>
        </h1>
      </header>

      {/* Invoice fills the available height (whole invoice visible; tap/pinch to zoom + read).
          App-rendered pixel-perfect image when present, else the snapshot render. */}
      <div className="min-h-0 flex-1 px-3">
        <div className="mx-auto h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {shared.imageUrl ? (
            <ZoomableImage
              src={shared.imageUrl}
              alt={`Invoice ${shared.invoiceNumber ?? ""} from ${businessName}`.trim()}
            />
          ) : (
            <div className="h-full overflow-auto">
              <InvoiceDocument data={shared.snapshot} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer — always visible without scrolling: decision + create CTA. */}
      <footer className="shrink-0 space-y-2 px-4 pt-2 pb-4">
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

        {platform === "android" ? (
          <div className="flex gap-2">
            <a
              href={installUrl}
              className="flex-1 rounded-full bg-[#0D4DC0] px-4 py-2.5 text-center text-sm font-medium text-white"
            >
              Install Invotick — free
            </a>
            <Link
              href="/"
              className="flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-800"
            >
              Create an invoice online
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="block w-full rounded-full bg-[#0D4DC0] px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Create an invoice online — free
          </Link>
        )}
      </footer>
    </main>
  );
}
