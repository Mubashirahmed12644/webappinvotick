/* eslint-disable @next/next/no-img-element */
import type { InvoiceRenderData } from "@/lib/data";
import { formatMoney, formatDate, hexToRgba, contrastText } from "@/lib/format";
import { imageProxyUrl } from "@/lib/image";
import { BRAND_LOGO } from "@/lib/givens";

// Faithful invoice document — mirrors the mobile app's rendered PDF:
// full-bleed header image + logo + title, decorative themed background,
// From / Bill To / Details, an S#/Desc/Qty/Price/Disc/Tax/Amount table,
// full totals block, signature + stamp, and a QR footer.
export function InvoiceDocument({ data, qrDataUrl, hideFooter, hideSummary, hideStamp, hideSignature, padRows }: { data: InvoiceRenderData; qrDataUrl?: string | null; hideFooter?: boolean; hideSummary?: boolean; hideStamp?: boolean; hideSignature?: boolean; padRows?: number }) {
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
  const label = "text-[15px] font-extrabold text-[#1c1b1f]";

  return (
    // flex column so the footer can pin to the bottom of an A4-height sheet
    // (in the free-tool preview). In the app's plain container it's a no-op.
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white text-[#1c1b1f]">
      {/* Background image — fetched from the synced template background (not invented) */}
      {backgroundUrl && (
        <img src={backgroundUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: data.backgroundOpacity }} />
      )}

      {/* Header: full-bleed image (or solid color) with logo + title — kept slim
          so the invoice stays compact and the details sit near the top. */}
      <div className="relative flex items-center justify-between gap-4 px-8" style={{ height: 165, backgroundColor: headerUrl ? undefined : backgroundUrl ? "transparent" : color }}>
        {headerUrl && <img src={headerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 30%" }} />}
        <div className="relative z-10">
          {/* Logo drawn directly (native LogoModule clipShape=NONE) — no white box/border. */}
          {logoUrl && <img src={logoUrl} alt="" className="h-[112px] w-auto object-contain" />}
        </div>
        {t.title && (
          <p
            className="relative z-10 text-[53px] leading-none"
            style={{
              // Native TitleModule: FontWeight.Black (900), fontSize = titleArea × 0.14 → ~0.226 of
              // the sheet width; measured native/HTML → HTML needed ~15% bump (46→53px) to match.
              // Theme color (white over a photo header), subtle shadow. No negative letter-spacing.
              color: data.titleColor ?? (headerUrl ? "#ffffff" : onColor),
              fontFamily: "var(--font-nunito), sans-serif",
              fontWeight: 900,
              letterSpacing: "0",
              textShadow: headerUrl && !data.titleColor ? "0 1px 4px rgba(0,0,0,0.45)" : "none",
            }}
          >
            Invoice
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-8 py-4">
        {/* From / Bill To / Details */}
        {/* From / Bill To / Invoice Details — faithful to native Sender/Receiver/FlexibleMeta modules:
            ExtraBold header (~16px), Medium body (~14px, uniform — no bolded label spans), tight
            line-height, and the "Phone:"/"Email:" prefixes + "P.O #:" the native modules emit. */}
        <div className="grid grid-cols-3 gap-4 leading-snug">
          {t.sender && (
            <div>
              <p className={label}>From</p>
              <p className="mt-1 text-[14px] font-medium">{data.business?.name ?? "—"}</p>
            </div>
          )}
          {t.receiver && (
            <div>
              <p className={label}>Bill To</p>
              <p className="mt-1 text-[14px] font-medium">{c?.name ?? "—"}</p>
              {c?.companyName && <p className="text-[13px] font-medium">{c.companyName}</p>}
              {[c?.addressLine1, c?.city, c?.country].filter(Boolean).length > 0 && (
                <p className="text-[13px] font-medium">{[c?.addressLine1, c?.city, c?.country].filter(Boolean).join(", ")}</p>
              )}
              {c?.phone && <p className="text-[13px] font-medium">Phone: {c.phone}</p>}
              {c?.emailAddress && <p className="text-[13px] font-medium">Email: {c.emailAddress}</p>}
            </div>
          )}
          {/* Native FlexibleInvoiceMetaModule alignRight=true: the block sits at the RIGHT of its
              cell, but the text inside stays LEFT-aligned. */}
          <div className="flex justify-end">
            <div className="text-left">
              <p className={label}>Invoice Details</p>
              <p className="mt-1 text-[14px] font-medium">Invoice #: {data.invoiceNumber}</p>
              <p className="text-[14px] font-medium">Issue Date: {formatDate(data.invoiceDate)}</p>
              {data.dueDate && <p className="text-[14px] font-medium">Due Date: {formatDate(data.dueDate)}</p>}
              {data.poNumber && <p className="text-[14px] font-medium">P.O #: {data.poNumber}</p>}
            </div>
          </div>
        </div>

        {/* Items table — mirrors the native ItemTableModule: 7 columns at fixed ratios, ALWAYS 9
            rows (blank rows padded so the layout stays balanced), even rows tinted (primary @5%)
            and odd rows white, blank rows carry no S# / values. */}
        {t.items && (
          // Outer border = theme.tableBorder = primary (FULL opacity), like native (not a 0.35 tint).
          <div className="mt-5" style={{ border: `1px solid ${color}` }}>
            <table className="w-full border-collapse text-[13px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "32.9%" }} />
                <col style={{ width: "9.4%" }} />
                <col style={{ width: "14.1%" }} />
                <col style={{ width: "9.4%" }} />
                <col style={{ width: "9.4%" }} />
                <col style={{ width: "18.8%" }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: color, color: onColor }}>
                  <th className="px-2 py-1.5 text-center font-extrabold">S#</th>
                  <th className="px-2 py-1.5 text-left font-extrabold">Description</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Qty</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Price</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Disc</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Tax</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(padRows ?? 9, data.items.length) }).map((_, i) => {
                  const it = data.items[i];
                  // Native zebra: first data row (index 0) is WHITE, tint on ODD rows
                  // (theme.tableRowBackground = primary @ 0.05).
                  const tint = i % 2 === 1 ? hexToRgba(color, 0.05) : "#ffffff";
                  return (
                    <tr key={i} style={{ backgroundColor: tint, height: 28 }}>
                      <td className="px-2 align-middle text-center font-bold">{it ? it.sn : ""}</td>
                      <td className="px-2 align-middle font-bold">{it ? it.name : ""}</td>
                      <td className="px-2 align-middle text-right font-bold">{it ? it.quantity.toFixed(2) : ""}</td>
                      <td className="px-2 align-middle text-right font-bold">{it ? formatMoney(it.unitPrice, cur) : ""}</td>
                      <td className="px-2 align-middle text-right font-bold">{it ? it.discountValue.toFixed(2) : ""}</td>
                      <td className="px-2 align-middle text-right font-bold">{it ? pct(it.taxRate) : ""}</td>
                      <td className="px-2 align-middle text-right font-bold">{it ? formatMoney(it.amount, cur) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals: emphasis ladder (TOTAL light → AMOUNT PAID medium → BALANCE DUE dark hero).
            The payment stamp is NOT drawn here — it's the auto PAID/PARTIALLY PAID stamp that comes
            through `stampImage` (rendered by the app's StampFactory) and is placed like any stamp. */}
        {t.total && !hideSummary && (
          <div className="mt-4 flex justify-end" data-block>
            <div
              className="relative w-full max-w-[300px]"
              // Outer border = theme.totalsAccent = primary (FULL), like native.
              style={{ border: `1px solid ${color}` }}
            >
              <TotalRow label="SUB TOTAL" value={formatMoney(data.subtotal, cur)} tint={hexToRgba(color, 0.05)} />
              <TotalRow label="DISCOUNT" value={formatMoney(data.discountAmount, cur)} tint={hexToRgba(color, 0.05)} />
              <TotalRow label="TAX" value={formatMoney(data.taxAmount, cur)} tint={hexToRgba(color, 0.05)} />
              <TotalRow label="SHIPPING" value={formatMoney(data.shippingCost, cur)} tint={hexToRgba(color, 0.05)} />
              {/* Emphasis ladder — TOTAL light tint + accent text (lowest rung). */}
              <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={{ backgroundColor: hexToRgba(color, 0.16), color }}>
                <span>TOTAL</span>
                <span>{formatMoney(data.total, cur)}</span>
              </div>
              {/* AMOUNT PAID — medium tint + dark text (middle rung). Always shown (0 when nothing paid). */}
              <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={{ backgroundColor: hexToRgba(color, 0.34), color: "#1c1b1f" }}>
                <span>AMOUNT PAID</span>
                <span>{formatMoney(data.amountPaid ?? 0, cur)}</span>
              </div>
              {/* BALANCE DUE = the dark hero (full primary + onColor), final amount owed; always last
                  so nothing dangles below the dark fill. */}
              <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={{ backgroundColor: color, color: onColor }}>
                <span>BALANCE DUE</span>
                <span>{formatMoney(data.balanceDue ?? data.total, cur)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {t.notes && data.notes && !hideSummary && (
          <div className="mt-8 border-t border-gray-200 pt-4" data-block>
            <p className={label}>Notes</p>
            <p className="mt-1 text-sm">{data.notes}</p>
          </div>
        )}

        {/* Signature & stamp — part of the trailing summary section, so it only appears on the
            LAST page (never repeated on continuation pages). */}
        {((signatureUrl && !hideSignature) || (stampUrl && !hideStamp)) && !hideSummary && (
          <div className="mt-12 flex items-end justify-between gap-8" data-block>
            <div>
              {signatureUrl && !hideSignature && (
                <>
                  <img src={signatureUrl} alt="Signature" draggable={false} className="pointer-events-none h-16 select-none object-contain" />
                  <p className="mt-1 border-t border-gray-300 pt-1 text-xs text-gray-500">Authorized signature</p>
                </>
              )}
            </div>
            {/* When hideStamp is set, the stamp is drawn as a draggable overlay by A4PagedFrame.
                Otherwise it's display-only — pointer-events:none so a finger landing on it during a
                pinch passes through to the zoom surface (react-zoom-pan-pinch needs both fingers). */}
            {stampUrl && !hideStamp && <img src={stampUrl} alt="Stamp" draggable={false} className="pointer-events-none h-24 w-24 select-none object-contain" />}
          </div>
        )}

        {/* Footer — pinned to the bottom of the sheet (mt-auto). Hidden when the paging frame
            renders one footer per A4 page instead (multi-page invoices). */}
        {!hideFooter && (
          <div className="mt-auto">
            <InvoiceFooter qrDataUrl={qrDataUrl} />
          </div>
        )}
      </div>
    </div>
  );
}

// Invotick branding footer — rendered at the bottom of every A4 page (see A4PagedFrame).
// `pageLabel` ("Page 1 of 3") is the multi-page pagination line, shown centred under the band.
export function InvoiceFooter({ qrDataUrl, pageLabel }: { qrDataUrl?: string | null; pageLabel?: string }) {
  return (
    <div>
      {/* Matches the native promotional footer (SharedComponents.drawPromotionalFooter):
          flat #F5F5F5 grey band, square corners, a #E0E0E0 divider line on top, no shadow/ring. */}
      <div className="mb-1 flex items-center justify-between gap-4 px-5 py-3" style={{ backgroundColor: "#F5F5F5", borderTop: "1px solid #E0E0E0" }}>
        <div className="flex items-center gap-3">
          <img src={BRAND_LOGO} alt="Invotick" className="h-9 w-9 rounded-md object-contain" />
          <div className="text-xs text-[#666666]">
            <p className="font-bold text-[#212121]">Invoice generated using Invotick</p>
            <p>Create professional invoices in seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right text-[10px] text-[#666666]">
          <div>
            <p className="font-semibold">Scan to download Invotick</p>
            <p className="text-[#0D4DC0]">https://gw.invotick.com/r/2/RefCode</p>
          </div>
          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="h-14 w-14" />}
        </div>
      </div>
      {pageLabel && <div className="pb-1 text-center text-[11px] font-medium text-gray-400">{pageLabel}</div>}
    </div>
  );
}

function TotalRow({ label, value, tint }: { label: string; value: string; tint: string }) {
  // Native: non-TOTAL rows carry theme.totalsBackground (primary @ 0.05) + Bold text.
  return (
    <div className="flex justify-between px-3 py-1 text-[13px]" style={{ backgroundColor: tint }}>
      <span className="font-bold text-[#1c1b1f]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
