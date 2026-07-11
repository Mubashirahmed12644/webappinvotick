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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#0D4DC0]">Invoice</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          {shared.invoiceNumber ? `Invoice ${shared.invoiceNumber}` : "Invoice"} from {businessName}
        </h1>
      </header>

      {/* The exact invoice. When the app has uploaded its pixel-perfect render we show
          that (100% same as the sender sees — builds trust); once that ephemeral image
          is auto-deleted we fall back to the snapshot render, so the invoice always shows. */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {shared.imageUrl ? (
          <ZoomableImage
            src={shared.imageUrl}
            alt={`Invoice ${shared.invoiceNumber ?? ""} from ${businessName}`.trim()}
          />
        ) : (
          <InvoiceDocument data={shared.snapshot} />
        )}
      </div>

      {/* Decision: show the recorded outcome once decided, else the approve/reject controls. */}
      {decided ? (
        <section
          className={`mt-6 rounded-2xl border p-6 text-center ${
            status === "APPROVED"
              ? "border-[#16A34A]/30 bg-[#16A34A]/5"
              : "border-[#DC2626]/30 bg-[#DC2626]/5"
          }`}
        >
          <p
            className={`text-lg font-semibold ${
              status === "APPROVED" ? "text-[#15803D]" : "text-[#DC2626]"
            }`}
          >
            {status === "APPROVED" ? "✓ You approved this invoice" : "✕ You rejected this invoice"}
          </p>
          <p className="mt-1 text-sm text-neutral-600">The sender has been notified.</p>
        </section>
      ) : (
        <ApprovalActions token={token} />
      )}

      {/* Growth CTA — platform-aware. Approving works on the web (above); the app is the
          secondary step: install to approve in-app + make your own invoices. */}
      <section className="mt-8 rounded-2xl border border-[#0D4DC0]/20 bg-[#0D4DC0]/5 p-6 text-center">
        {platform === "android" ? (
          <>
            <h2 className="text-lg font-semibold text-neutral-900">Get the Invotick app</h2>
            <p className="mt-2 text-neutral-600">
              Save this invoice as a PDF and create your own — free, in seconds.
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
          </>
        ) : platform === "ios" ? (
          <>
            <h2 className="text-lg font-semibold text-neutral-900">Make your own invoice — free</h2>
            <p className="mt-2 text-neutral-600">
              Create and download professional invoices right here in your browser. The Invotick app
              is available on Android.
            </p>
            <div className="mt-5 flex justify-center">
              <Link
                href="/"
                className="w-full rounded-full bg-[#0D4DC0] px-6 py-3 font-medium text-white sm:w-auto"
              >
                Create an invoice online
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-neutral-900">Make your own invoice — free</h2>
            <p className="mt-2 text-neutral-600">
              Create and download invoices in your browser, or scan to get the app on your Android
              phone.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-center">
              {qrDataUrl ? (
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Scan to install Invotick on Android"
                    width={176}
                    height={176}
                    className="rounded-lg border border-neutral-200 bg-white p-2"
                  />
                  <span className="mt-2 text-xs text-neutral-500">Scan to install on Android</span>
                </div>
              ) : null}
              <Link
                href="/"
                className="w-full rounded-full bg-[#0D4DC0] px-6 py-3 font-medium text-white sm:w-auto"
              >
                Create an invoice online
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
