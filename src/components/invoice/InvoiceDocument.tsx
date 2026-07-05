/* eslint-disable @next/next/no-img-element */
import type { InvoiceRenderData } from "@/lib/data";
import { formatMoney, formatDate, hexToRgba, contrastText } from "@/lib/format";
import { imageProxyUrl } from "@/lib/image";
import { BRAND_LOGO } from "@/lib/givens";

// Faithful invoice document — mirrors the mobile app's rendered PDF:
// full-bleed header image + logo + title, decorative themed background,
// From / Bill To / Details, an S#/Desc/Qty/Price/Disc/Tax/Amount table,
// full totals block, signature + stamp, and a QR footer.
export function InvoiceDocument({ data, qrDataUrl }: { data: InvoiceRenderData; qrDataUrl?: string | null }) {
  const color = data.color || "#0D4DC0";
  const onColor = contrastText(color);
  const cur = data.currency;
  const t = data.toggles;
  const logoUrl = t.logo ? imageProxyUrl(data.business?.logo) : null;
  const headerUrl = imageProxyUrl(data.headerImage);
  const backgroundUrl = imageProxyUrl(data.backgroundImage);
  const signatureUrl = imageProxyUrl(data.signatureImage);
  const stampUrl = imageProxyUrl(data.stampImage);
  const c = data.client;
  const pct = (n: number) => `${n.toFixed(2)}%`;
  const label = "text-xs font-extrabold uppercase tracking-wide text-[#1c1b1f]";

  return (
    // flex column so the footer can pin to the bottom of an A4-height sheet
    // (in the free-tool preview). In the app's plain container it's a no-op.
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white text-[#1c1b1f]">
      {/* Background image — fetched from the synced template background (not invented) */}
      {backgroundUrl && (
        <img src={backgroundUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: data.backgroundOpacity }} />
      )}

      {/* Header: full-bleed image (or solid color) with logo + title */}
      <div className="relative flex items-center justify-between gap-4 px-8 py-6" style={{ minHeight: 128, backgroundColor: headerUrl ? undefined : backgroundUrl ? "transparent" : color }}>
        {headerUrl && <img src={headerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="relative z-10">
          {logoUrl && (
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-md bg-white shadow-md">
              <img src={logoUrl} alt="" className="h-[72px] w-[72px] rounded object-contain" />
            </span>
          )}
        </div>
        {t.title && (
          <p
            className="relative z-10 text-5xl font-bold tracking-tight"
            style={{
              // Uses the synced title color if present; else default (white over
              // a header image, theme-contrast otherwise). Auto-applies on sync.
              color: data.titleColor ?? (headerUrl ? "#ffffff" : onColor),
              fontFamily: "var(--font-nunito), sans-serif",
              letterSpacing: "-0.02em",
              textShadow: headerUrl && !data.titleColor ? "0 1px 4px rgba(0,0,0,0.45)" : "none",
            }}
          >
            Invoice
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-8 py-6">
        {/* From / Bill To / Details */}
        <div className="grid gap-6 sm:grid-cols-3">
          {t.sender && (
            <div>
              <p className={label}>From</p>
              <p className="mt-1 font-bold">{data.business?.name ?? "—"}</p>
            </div>
          )}
          {t.receiver && (
            <div>
              <p className={label}>Bill To</p>
              <p className="mt-1 font-bold">{c?.name ?? "—"}</p>
              {c?.companyName && <p className="text-sm text-gray-600">{c.companyName}</p>}
              {c?.emailAddress && <p className="text-sm text-gray-600">{c.emailAddress}</p>}
              {c?.phone && <p className="text-sm text-gray-600">{c.phone}</p>}
              {[c?.addressLine1, c?.city, c?.country].filter(Boolean).length > 0 && (
                <p className="text-sm text-gray-600">{[c?.addressLine1, c?.city, c?.country].filter(Boolean).join(", ")}</p>
              )}
            </div>
          )}
          <div>
            <p className={label}>Invoice Details</p>
            <p className="mt-1 text-sm"><span className="font-semibold">Invoice #:</span> {data.invoiceNumber}</p>
            <p className="text-sm"><span className="font-semibold">Issue Date:</span> {formatDate(data.invoiceDate)}</p>
            {data.dueDate && <p className="text-sm"><span className="font-semibold">Due Date:</span> {formatDate(data.dueDate)}</p>}
            {data.poNumber && <p className="text-sm"><span className="font-semibold">PO #:</span> {data.poNumber}</p>}
            <p className="text-sm"><span className="font-semibold">Status:</span> {data.status}</p>
          </div>
        </div>

        {/* Items table */}
        {t.items && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: color, color: onColor }}>
                  <th className="px-3 py-2.5 text-left font-bold">S#</th>
                  <th className="px-3 py-2.5 text-left font-bold">Description</th>
                  <th className="px-3 py-2.5 text-right font-bold">Qty</th>
                  <th className="px-3 py-2.5 text-right font-bold">Price</th>
                  <th className="px-3 py-2.5 text-right font-bold">Disc</th>
                  <th className="px-3 py-2.5 text-right font-bold">Tax</th>
                  <th className="px-3 py-2.5 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr
                    key={i}
                    style={{ backgroundColor: i % 2 ? hexToRgba(color, 0.07) : "#ffffff", borderBottom: `1px solid ${hexToRgba(color, 0.3)}` }}
                  >
                    <td className="px-3 py-2.5 align-top font-semibold">{it.sn}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{it.name}</p>
                      {it.description && <p className="text-xs text-gray-500">{it.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">{it.quantity.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right align-top">{formatMoney(it.unitPrice, cur)}</td>
                    <td className="px-3 py-2.5 text-right align-top">{it.discountType === "FIXED" ? formatMoney(it.discountValue, cur) : pct(it.discountValue)}</td>
                    <td className="px-3 py-2.5 text-right align-top">{pct(it.taxRate)}</td>
                    <td className="px-3 py-2.5 text-right align-top font-bold">{formatMoney(it.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals (all rows shown, TOTAL highlighted in theme color) */}
        {t.total && (
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-sm">
              <TotalRow label="SUB TOTAL" value={formatMoney(data.subtotal, cur)} />
              <TotalRow label="DISCOUNT" value={formatMoney(data.discountAmount, cur)} />
              <TotalRow label="TAX" value={formatMoney(data.taxAmount, cur)} />
              <TotalRow label="SHIPPING" value={formatMoney(data.shippingCost, cur)} />
              <div className="mt-1 flex items-center justify-between px-4 py-2.5 text-base font-extrabold" style={{ backgroundColor: color, color: onColor }}>
                <span>TOTAL</span>
                <span>{formatMoney(data.total, cur)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {t.notes && data.notes && (
          <div className="mt-8 border-t border-gray-200 pt-4">
            <p className={label}>Notes</p>
            <p className="mt-1 text-sm">{data.notes}</p>
          </div>
        )}

        {/* Signature & stamp */}
        {(signatureUrl || stampUrl) && (
          <div className="mt-12 flex items-end justify-between gap-8">
            <div>
              {signatureUrl && (
                <>
                  <img src={signatureUrl} alt="Signature" className="h-16 object-contain" />
                  <p className="mt-1 border-t border-gray-300 pt-1 text-xs text-gray-500">Authorized signature</p>
                </>
              )}
            </div>
            {stampUrl && <img src={stampUrl} alt="Stamp" className="h-24 w-24 object-contain" />}
          </div>
        )}

        {/* Footer — pinned to the bottom of the sheet (mt-auto); the gap above it
            flexes with the content, so its position doesn't shift as line items grow. */}
        <div className="mt-auto flex items-center justify-between gap-4 rounded-[var(--radius-md)] bg-white px-5 py-3.5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-3">
            <img src={BRAND_LOGO} alt="Invotick" className="h-9 w-9 rounded-md object-contain" />
            <div className="text-xs text-gray-500">
              <p className="font-bold text-[#1c1b1f]">Invoice generated using Invotick</p>
              <p>Create professional invoices in seconds</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-right text-[10px] text-gray-500">
            <div>
              <p className="font-semibold">Scan to download Invotick</p>
              <p className="text-[var(--color-primary)]">gw.invotick.com/r/2/RefCode</p>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="h-14 w-14" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-1.5 text-sm">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
