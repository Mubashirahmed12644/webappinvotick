/* eslint-disable @next/next/no-img-element */
import { footerMode, type OwnFooter } from "@/lib/invotick-footer";
import type { InvoiceRenderData } from "@/lib/data";
import { formatMoney, formatDate, hexToRgba, contrastText, onTint, blendOnWhite } from "@/lib/format";
import { imageProxyUrl } from "@/lib/image";
import { BRAND_LOGO } from "@/lib/givens";
import { LABELS, labelsFor, type InvoiceLabels } from "@/lib/invoice-labels";
import { SummaryLeftFitted } from "./SummaryLeftFitted";
import { QrSvg } from "./QrSvg";

// Faithful invoice document — mirrors the mobile app's rendered PDF:
// full-bleed header image + logo + title, decorative themed background,
// From / Bill To / Details, an S#/Desc/Qty/Price/Disc/Tax/Amount table,
// full totals block, signature + stamp, and a QR footer.
//
// `labels` (default English) + `dir` let the shared invoice render in the receiver's language: the
// structural labels are translated by the caller, and `dir="rtl"` mirrors the layout for Arabic/Farsi.
export function InvoiceDocument({ data, qrDataUrl, hideFooter, hideSummary, hideStamp, hideSignature, padRows, labels: labelsProp, dir = "ltr" }: { data: InvoiceRenderData; qrDataUrl?: string | null; hideFooter?: boolean; hideSummary?: boolean; hideStamp?: boolean; hideSignature?: boolean; padRows?: number; labels?: InvoiceLabels; dir?: "ltr" | "rtl" }) {
  // The document's own vocabulary, unless the caller passed a translated set — the shared-link view
  // does, having already run the labels through the receiver's language.
  const isEstimate = data.documentType === "ESTIMATE";
  const labels = labelsProp ?? labelsFor(data.documentType);
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
  // Item-table Description column alignment from the template config (native itemTable*Alignment).
  // Numeric columns always stay end-aligned. Logical start/end so RTL still mirrors.
  const alignClass = (a?: string | null) => {
    const v = (a ?? "").toLowerCase();
    return v === "right" ? "text-end" : v === "center" ? "text-center" : "text-start";
  };
  const descHead = alignClass(data.itemTableHeaderAlignment);
  const descBody = alignClass(data.itemTableBodyAlignment);

  return (
    // flex column so the footer can pin to the bottom of an A4-height sheet
    // (in the free-tool preview). In the app's plain container it's a no-op.
    <div dir={dir} className="relative flex flex-1 flex-col overflow-hidden bg-white text-[#1c1b1f]">
      {/* Background image — fetched from the synced template background (not invented) */}
      {backgroundUrl && (
        <img src={backgroundUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: data.backgroundOpacity }} />
      )}

      {/* Header: full-bleed image (or solid color) with logo + title — kept slim
          so the invoice stays compact and the details sit near the top. */}
      <div className="relative flex shrink-0 items-center justify-between gap-4 px-8" style={{ height: 165, backgroundColor: headerUrl ? undefined : backgroundUrl ? "transparent" : color }}>
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
            {labels.invoice}
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
              <p className={label}>{labels.from}</p>
              <p className="mt-1 text-[14px] font-medium">{data.business?.name ?? "—"}</p>
              {/* Full sender detail — mirrors Bill To, so "From" matches native instead of name-only. */}
              {[data.business?.addressLine1, data.business?.addressLine2, data.business?.city, data.business?.country].filter(Boolean).length > 0 && (
                <p className="text-[13px] font-medium">{[data.business?.addressLine1, data.business?.addressLine2, data.business?.city, data.business?.country].filter(Boolean).join(", ")}</p>
              )}
              {data.business?.phone && <p className="text-[13px] font-medium">{labels.phone}: {data.business.phone}</p>}
              {data.business?.emailAddress && <p className="text-[13px] font-medium">{labels.email}: {data.business.emailAddress}</p>}
            </div>
          )}
          {t.receiver && (
            <div>
              <p className={label}>{labels.billTo}</p>
              <p className="mt-1 text-[14px] font-medium">{c?.name ?? "—"}</p>
              {c?.companyName && <p className="text-[13px] font-medium">{c.companyName}</p>}
              {[c?.addressLine1, c?.city, c?.country].filter(Boolean).length > 0 && (
                <p className="text-[13px] font-medium">{[c?.addressLine1, c?.city, c?.country].filter(Boolean).join(", ")}</p>
              )}
              {c?.phone && <p className="text-[13px] font-medium">{labels.phone}: {c.phone}</p>}
              {c?.emailAddress && <p className="text-[13px] font-medium">{labels.email}: {c.emailAddress}</p>}
            </div>
          )}
          {/* Native FlexibleInvoiceMetaModule alignRight=true: the block sits at the RIGHT of its
              cell, but the text inside stays LEFT-aligned. */}
          <div className="flex justify-end">
            <div className="text-start">
              <p className={label}>{labels.invoiceDetails}</p>
              <p className="mt-1 text-[14px] font-medium">{labels.invoiceNo}: {data.invoiceNumber}</p>
              <p className="text-[14px] font-medium">{labels.issueDate}: {formatDate(data.invoiceDate)}</p>
              {data.dueDate && <p className="text-[14px] font-medium">{labels.dueDate}: {formatDate(data.dueDate)}</p>}
              {data.poNumber && <p className="text-[14px] font-medium">{labels.poNo}: {data.poNumber}</p>}
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
                  <th className="px-2 py-1.5 text-center font-extrabold">{labels.colSn}</th>
                  <th className={`px-2 py-1.5 font-extrabold ${descHead}`}>{labels.colDescription}</th>
                  <th className="px-2 py-1.5 text-end font-extrabold">{labels.colQty}</th>
                  <th className="px-2 py-1.5 text-end font-extrabold">{labels.colPrice}</th>
                  <th className="px-2 py-1.5 text-end font-extrabold">{labels.colDisc}</th>
                  <th className="px-2 py-1.5 text-end font-extrabold">{labels.colTax}</th>
                  <th className="px-2 py-1.5 text-end font-extrabold">{labels.colAmount}</th>
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
                      <td className={`px-2 align-middle font-bold ${descBody}`}>{it ? it.name : ""}</td>
                      <td className="px-2 align-middle text-end font-bold">{it ? it.quantity.toFixed(2) : ""}</td>
                      <td className="px-2 align-middle text-end font-bold">{it ? formatMoney(it.unitPrice, cur) : ""}</td>
                      <td className="px-2 align-middle text-end font-bold">{it ? (it.discountType === "PERCENTAGE" ? pct(it.discountValue) : it.discountValue.toFixed(2)) : ""}</td>
                      <td className="px-2 align-middle text-end font-bold">{it ? pct(it.taxRate) : ""}</td>
                      <td className="px-2 align-middle text-end font-bold">{it ? formatMoney(it.amount, cur) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals — emphasis ladder (TOTAL light → AMOUNT PAID medium → BALANCE DUE dark hero),
            JOINED to the bottom-right of the item table like native (the TotalsModule bodyRow sits
            directly after the table with no top padding). `-mt-px` overlaps the 1px borders so the
            totals box shares the table's bottom edge instead of floating below it. The payment stamp
            is NOT drawn here — it arrives via `stampImage` (the app's StampFactory), placed over the
            totals like native. */}
        {/* Summary band — NATIVE PARITY: Payment Instructions + Terms (native BOTTOM_LEFT) on the
            LEFT and the totals box (BOTTOM_RIGHT) on the RIGHT, SIDE BY SIDE on one row directly
            under the table — NOT stacked below it. Native's Canvas draws payment-left + totals-right
            together, which keeps the block short so it fits without overflowing the page and
            flex-shrinking the fixed header (the old layout stacked payment/terms below the totals via
            mt-auto → on long text it overflowed → header image height "shrank"). */}
        {((t.total) || (t.payment && data.paymentInstructions) || (t.terms && data.terms)) && !hideSummary && (
          <div className="-mt-px flex items-start justify-between gap-6" data-block>
            {/* LEFT — Payment Instructions + Terms, bound to the totals box's height and auto-fitted so
                long text never grows the summary onto an extra page (see SummaryLeftFitted). */}
            <SummaryLeftFitted data={data} labels={labels} />
            {/* RIGHT — totals box. Border = theme primary (FULL), like native. `data-totals` lets
                A4PagedFrame align the payment stamp's top edge to this box's top line. */}
            {t.total ? (
              <div data-totals className="relative w-full max-w-[300px]" style={{ border: `1px solid ${color}` }}>
                <TotalRow rowKey="subtotal" label={labels.subTotal} value={formatMoney(data.subtotal, cur)} tint={hexToRgba(color, 0.05)} />
                <TotalRow rowKey="discount" label={labels.discount} value={formatMoney(data.discountAmount, cur)} tint={hexToRgba(color, 0.05)} />
                <TotalRow rowKey="tax" label={labels.tax} value={formatMoney(data.taxAmount, cur)} tint={hexToRgba(color, 0.05)} />
                <TotalRow rowKey="shipping" label={labels.shipping} value={formatMoney(data.shippingCost, cur)} tint={hexToRgba(color, 0.05)} />
                {/* TOTAL — light tint + accent text, the lowest of three rungs on an invoice. On an
                    estimate it is the only figure that matters and the last row in the box, so it
                    takes the hero treatment BALANCE DUE would have had.

                    The text is `onTint`, not the raw accent. Written literally this row was the
                    accent on a 16% wash of itself: 5.7:1 for the default blue, but 1.99:1 if a
                    seller picks cyan and 1.18:1 for yellow. `onTint` keeps the hue and walks the
                    lightness down until the pair clears AA, so the row still reads as accent-on-
                    accent for every colour rather than only for the one that was tested. The
                    estimate branch already did the right thing with `onColor`; this is the invoice
                    branch catching up. */}
                <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={isEstimate ? { backgroundColor: color, color: onColor } : { backgroundColor: hexToRgba(color, 0.16), color: onTint(color, 0.16) }}>
                  <span>{labels.total}</span>
                  <span>{formatMoney(data.total, cur)}</span>
                </div>
                {/* AMOUNT PAID / BALANCE DUE — an invoice's two lower rungs, and nonsense on an
                    estimate: nothing has been paid against a price that is still being quoted, and
                    a "BALANCE DUE" on a quotation reads as a bill the client never agreed to. On an
                    estimate TOTAL is the last row, so it takes the dark hero treatment instead. */}
                {!isEstimate && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={{ backgroundColor: hexToRgba(color, 0.34), color: contrastText(blendOnWhite(color, 0.34)) }}>
                      <span>{labels.amountPaid}</span>
                      <span>{formatMoney(data.amountPaid ?? 0, cur)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-[15px] font-extrabold" style={{ backgroundColor: color, color: onColor }}>
                      <span>{labels.balanceDue}</span>
                      <span>{formatMoney(data.balanceDue ?? data.total, cur)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Notes */}
        {t.notes && data.notes && !hideSummary && (
          <div className="mt-8 border-t border-gray-200 pt-4" data-block>
            <p className={label}>{labels.notes}</p>
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
                  <p className="mt-1 border-t border-gray-300 pt-1 text-xs text-gray-500">{labels.authorizedSignature}</p>
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
        {!hideFooter && footerMode(data) !== "none" && (
          <div className="mt-auto">
            <InvoiceFooter qrDataUrl={qrDataUrl} labels={labels} {...ownFooterProps(data)} />
          </div>
        )}
      </div>
    </div>
  );
}

// Invotick branding footer — rendered at the bottom of every A4 page (see A4PagedFrame).
// `pageLabel` ("Page 1 of 3") is the multi-page pagination line, shown centred under the band.
//
// `own` (decision 0151) draws the business's own footer in the SAME band: every size, gap, colour and
// position below is shared, and only what sits in each slot changes — logo tile, message, name line,
// "Contact us", contact line, QR tile. An empty slot keeps its space, so the band never reflows.
// `control` is the app preview's Remove / Edit button; no other caller passes it, so the share page,
// its print and every image of the document are drawn without it.
export function InvoiceFooter({ qrDataUrl, pageLabel, labels = LABELS, own, businessLogo, accent = "#0D4DC0", control }: { qrDataUrl?: string | null; pageLabel?: string; labels?: InvoiceLabels; own?: OwnFooter | null; businessLogo?: string | null; accent?: string; control?: FooterControl | null }) {
  // Pixel-parity with the native promotional footer (SharedComponents.drawPromotionalFooter), whose
  // sizes are all fractions of the sheet width. On the 794px A4 sheet those resolve to:
  //   band height 0.12·W ≈ 95, icon/QR 0.65·band ≈ 62, inner pad 0.6·32 ≈ 19, line gap 0.35·32 ≈ 11.
  // Font sizes: generated 0.016·W, tagline 0.011·W, scan 0.0144·W, link 0.0168·W (bold).
  const tile = 62;
  const tileStyle = { width: tile, height: tile, borderRadius: tile * 0.15, background: "#fff", overflow: "hidden", flex: "none" } as const;
  const emptySlot = { width: tile, height: tile, flex: "none" } as const;
  // The QR's finder-pattern corners sat under the tile's own rounded clip (radius tile*0.15 ≈ 9.3px)
  // and got cut. Same outer tile, but the QR is inset by at least that radius so no module is clipped —
  // this padding never touches the logo tile, which keeps its own look.
  const qrPad = Math.ceil(tile * 0.15);
  const qrTileStyle = { ...tileStyle, padding: qrPad, boxSizing: "border-box" } as const;
  const qrInner = tile - 2 * qrPad;
  const logoUrl = own && own.showLogo !== false ? imageProxyUrl(businessLogo) : null;
  const initials = own && own.showLogo !== false && !logoUrl ? own.initials?.trim() || null : null;
  // Two lines at most for what the business typed: the band's height is fixed (it is the layout).
  const clamp2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" } as const;
  return (
    <div style={control ? { position: "relative" } : undefined}>
      {/* #E0E0E0 divider, an 11px gap, then the flat #F5F5F5 band (square corners, no shadow). */}
      <div style={{ borderTop: "1px solid #E0E0E0" }} />
      <div
        className="mb-1 flex items-center justify-between"
        style={{ backgroundColor: "#F5F5F5", height: 95, marginTop: 11, paddingLeft: 19, paddingRight: 19 }}
      >
        {/* LEFT — app icon on a white rounded tile (native draws a white round-rect then the icon), + text. */}
        <div className="flex items-center" style={own ? { gap: 19, minWidth: 0 } : { gap: 19 }}>
          {!own ? (
            <div style={tileStyle}>
              <img src={BRAND_LOGO} alt="Invotick" style={{ width: tile, height: tile, objectFit: "contain" }} />
            </div>
          ) : logoUrl ? (
            <div style={tileStyle}>
              <img src={logoUrl} alt="" style={{ width: tile, height: tile, objectFit: "contain" }} />
            </div>
          ) : initials ? (
            <div style={{ ...tileStyle, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
              {initials}
            </div>
          ) : (
            <div style={emptySlot} />
          )}
          <div style={own ? { minWidth: 0, maxWidth: 330 } : undefined}>
            {!own ? (
              <>
                <p style={{ fontSize: 12.7, fontWeight: 700, color: "#212121", lineHeight: 1.2 }}>{labels.footerGenerated}</p>
                <p style={{ fontSize: 8.7, color: "#666666", lineHeight: 1.2, marginTop: 2 }}>{labels.footerTagline}</p>
              </>
            ) : (
              <>
                {own.message && <p style={{ fontSize: 12.7, fontWeight: 700, color: "#212121", lineHeight: 1.2, ...clamp2 }}>{own.message}</p>}
                {own.businessLine && <p style={{ fontSize: 8.7, color: "#666666", lineHeight: 1.2, marginTop: 2, ...clamp2 }}>{own.businessLine}</p>}
              </>
            )}
          </div>
        </div>
        {/* RIGHT — "Scan…" over a fading gradient rule over the bold primary link, then a rounded QR tile. */}
        <div className="flex items-center" style={own ? { gap: 12, minWidth: 0 } : { gap: 12 }}>
          {!own ? (
            <div style={{ textAlign: "end" }}>
              <p style={{ fontSize: 11.4, color: "#666666", lineHeight: 1.3 }}>{labels.footerScan}</p>
              <div style={{ height: 1, margin: "3px 0", background: "linear-gradient(to right, transparent, #DDDDDD 20%, #DDDDDD 80%, transparent)" }} />
              <p style={{ fontSize: 13.3, fontWeight: 700, color: "#0D4DC0", lineHeight: 1.3 }}>https://gw.invotick.com/r/2/RefCode</p>
            </div>
          ) : own.contactLine ? (
            <div style={{ textAlign: "end", minWidth: 0, maxWidth: 360 }}>
              <p style={{ fontSize: 11.4, color: "#666666", lineHeight: 1.3 }}>{labels.footerContact ?? LABELS.footerContact}</p>
              <div style={{ height: 1, margin: "3px 0", background: "linear-gradient(to right, transparent, #DDDDDD 20%, #DDDDDD 80%, transparent)" }} />
              <p style={{ fontSize: 13.3, fontWeight: 700, color: "#0D4DC0", lineHeight: 1.3, ...clamp2 }}>{own.contactLine}</p>
            </div>
          ) : null}
          {!own ? (
            qrDataUrl && (
              <div style={qrTileStyle}>
                <img src={qrDataUrl} alt="QR" style={{ width: qrInner, height: qrInner, objectFit: "contain" }} />
              </div>
            )
          ) : own.qrText ? (
            <div style={qrTileStyle}>
              <QrSvg text={own.qrText} size={qrInner} />
            </div>
          ) : (
            <div style={emptySlot} />
          )}
        </div>
      </div>
      {pageLabel && <div className="pb-1 text-center text-[11px] font-medium text-gray-400">{pageLabel}</div>}
      {control && <FooterControlButton control={control} />}
    </div>
  );
}

/**
 * The app preview's button on the footer (decision 0151): a round × for a free account (it opens the
 * paywall), a round pencil for a premium one (it opens the footer sheet). ICON ONLY — the owner,
 * 2026-09-21, on the 1.4.9 device test: the "Remove ×" / "Edit" pill sat on the QR and the "Scan to
 * download" line. The words stay as the button's accessible name (`aria-label`), which TalkBack and
 * VoiceOver read, and nowhere on the page.
 *
 * **Neither the icon nor its touch target may touch the QR or the text, not even partly** (the owner).
 * The geometry, in sheet px on the 794 px sheet, measured from the band's top-right corner (x to the
 * right, y down). The band is 95 tall. The QR tile is 62 square, 19 in from the band's right edge and
 * centred in the band, so it spans x −81…−19, y 16.5…78.5. The text sits left of the QR and starts
 * lower: a two-line contact line starts at y 19.5. The page's right margin is x 0…32. The document above
 * the footer ends at y −12 (1 px rule + 11 px gap).
 *
 * - **The icon:** centre (15, 0), on the band's top edge in the right margin, radius at most 16. So it
 *   spans x −1…31, y −16…16. That is 17 px clear of the sheet's edge, 19.2 px from the document's
 *   corner (0, −12) and 34.8 px from the QR's corner (−19, 16.5).
 * - **The touch target:** 48dp square, its bottom edge at y 16 — above the QR's top edge (16.5) and
 *   above every line of text. Its right edge is the sheet's edge, which clips. So at any scale it lies
 *   over the right margin, the empty top strip of the band and the empty space above the band, never
 *   over the QR or the text. It sits just under the draggable signature and stamp (z 19 against their
 *   20), so a signature dragged into that corner still answers its own finger.
 *
 * On screen the icon is 24dp, capped at those 16 px (≈16dp at a phone's ≈0.49 scale), and the target is
 * 48dp to the finger at any zoom.
 *
 * The page is paper: `#fff` in the app's light and dark themes alike, so the colours are fixed. White on
 * #0D4DC0 is 7.3:1 and white on #374151 is 10.3:1; a white ring and a soft shadow lift both off the band.
 */
export type FooterControl = {
  kind: "remove" | "edit";
  /** Its accessible name, from the app (translated there): "Remove footer" / "Edit footer". Never drawn. */
  label: string;
  /** How much the sheet is scaled on screen (screen px per sheet px). */
  scale: number;
  onPress: () => void;
};

/** The numbers above, for the check that proves the icon and its target cover nothing. Sheet px. */
export const FOOTER_CONTROL_GEOMETRY = {
  /** The band's top edge below the footer box's top: the 1 px rule plus the 11 px gap. */
  bandTop: 12,
  bandHeight: 95,
  /** The QR tile: its side and the band's padding to its right. */
  qrTile: 62,
  qrRightPad: 19,
  /** The icon's centre, from the band's top-right corner: right, and down. */
  dx: 15,
  dy: 0,
  /** The largest icon radius that touches nothing drawn (see the note on [FooterControl]). */
  maxRadius: 16,
  /** The touch target's bottom edge, below the band's top: above the QR's top edge (16.5). */
  targetBottom: 16,
  /** The page's right margin: the sheet's edge, from the band's right edge. */
  sheetEdge: 32,
  /** The icon, and the finger, in screen dp. */
  iconDp: 24,
  touchDp: 48,
} as const;

/** Where the icon and its touch target go, in sheet px relative to the footer box's top-right corner. */
export function footerControlLayout(scale: number) {
  const g = FOOTER_CONTROL_GEOMETRY;
  const k = 1 / Math.max(scale || 1, 0.05);
  const radius = Math.min(g.maxRadius, (g.iconDp / 2) * k);
  const touch = g.touchDp * k;
  const cx = g.dx; // from the band's right edge, rightwards
  const cy = g.bandTop + g.dy; // from the footer box's top, downwards
  // Right edge on the sheet's edge, bottom edge above the QR: the target grows left and up only.
  const boxLeft = g.sheetEdge - touch;
  const boxTop = g.bandTop + g.targetBottom - touch;
  return { k, radius, touch, cx, cy, boxLeft, boxTop };
}

export function FooterControlButton({ control }: { control: FooterControl }) {
  const edit = control.kind === "edit";
  const { k, radius, touch, cx, cy, boxLeft, boxTop } = footerControlLayout(control.scale);
  const d = radius * 2;
  const glyph = d * 0.56;
  return (
    <button
      type="button"
      aria-label={control.label}
      data-footer-control={control.kind}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); control.onPress(); }}
      style={{
        position: "absolute", left: `calc(100% + ${boxLeft}px)`, top: boxTop, width: touch, height: touch,
        padding: 0, margin: 0, border: 0, background: "transparent", cursor: "pointer", zIndex: 19,
        touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden
        data-footer-control-icon=""
        style={{
          position: "absolute", left: cx - boxLeft - radius, top: cy - boxTop - radius, width: d, height: d,
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: edit ? "#0D4DC0" : "#374151", color: "#FFFFFF",
          boxShadow: `0 0 0 ${1.5 * k}px #FFFFFF, 0 ${1 * k}px ${3 * k}px rgba(0,0,0,0.25)`,
        }}
      >
        {edit ? (
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        ) : (
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <path d="M6 6l12 12" /><path d="M18 6L6 18" />
          </svg>
        )}
      </span>
    </button>
  );
}

/** The props that switch [InvoiceFooter] to the business's own footer, when the document carries one. */
export function ownFooterProps(data: InvoiceRenderData): { own?: OwnFooter | null; businessLogo?: string | null; accent?: string } {
  if (footerMode(data) !== "own") return {};
  return { own: data.ownFooter, businessLogo: data.business?.logo, accent: data.color || "#0D4DC0" };
}

function TotalRow({ label, value, tint, rowKey }: { label: string; value: string; tint: string; rowKey?: string }) {
  // Native: non-TOTAL rows carry theme.totalsBackground (primary @ 0.05) + Bold text.
  // `rowKey` / `data-total-label` name the row and its label for A4PagedFrame, which starts a stamp
  // that has no saved position just after the SHIPPING label ends. Named in the markup and not
  // matched on the text, because a shared invoice translates these words.
  return (
    <div data-total-row={rowKey} className="flex justify-between px-3 py-1 text-[13px]" style={{ backgroundColor: tint }}>
      <span data-total-label className="font-bold text-[#1c1b1f]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
