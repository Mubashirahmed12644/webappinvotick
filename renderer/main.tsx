import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { InvoiceFooter } from "@/components/invoice/InvoiceDocument";
import { LABELS } from "@/lib/invoice-labels";
import type { InvoiceRenderData } from "@/lib/data";
import { BRAND_LOGO } from "@/lib/givens";
import "./renderer.css";

// Placeholder shown INSTANTLY (before the app injects the invoice): one BLANK WHITE A4 page at the
// EXACT size the real render will be — same 794×1123 sheet, fit to the pane with the same scale as
// A4PagedFrame (min(cw/794, ch/1139) × 1.0) — with a spinner centred on it. The real invoice then
// renders into the same footprint, so there's no size jump / empty-invoice flicker, just skeleton →
// filled. (An invoice is always ≥1 page, and the sheet is always white regardless of theme.)
// A4PagedFrame's own page metrics — kept identical so the skeleton page occupies the EXACT footprint
// (and puts the footer in the EXACT place) the real render will, i.e. zero shift when it arrives.
const SHEET_W = 794;
const SHEET_H = 1123;
const STACK_PAD_Y = 8;
const FOOTER_BOTTOM_MARGIN = 32;

function sheetScale() {
  return Math.min(window.innerWidth / SHEET_W, window.innerHeight / (SHEET_H + STACK_PAD_Y * 2));
}

/**
 * Instant placeholder: ONE blank white A4 page at the exact final size, carrying the Invotick footer
 * (identical on every invoice, and its logo + QR are bundled — so drawing it costs nothing and makes
 * the skeleton look like the real thing), with the branded loader centred on top.
 *
 * The footer is skipped when the page is opened with `?footer=0` — the app passes that for users whose
 * invoices don't carry Invotick branding (e.g. premium), so the skeleton never shows a footer that then
 * disappears.
 */
function SkeletonPage({ withFooter }: { withFooter: boolean }) {
  // Computed synchronously on the first render (lazy initialiser), and the WebView only loads this page
  // AFTER it has been laid out, so the very first paint is already at the final size — no grow/jump.
  const [s, setS] = useState(sheetScale);
  useLayoutEffect(() => {
    const onResize = () => setS(sheetScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f7" }}>
      <div style={{ position: "relative", width: SHEET_W * s, height: SHEET_H * s }}>
        {/* The sheet itself, scaled exactly like A4PagedFrame scales a real page. */}
        <div style={{ width: SHEET_W, height: SHEET_H, background: "#fff", boxShadow: "0 3px 16px rgba(0,0,0,0.18)", transform: `scale(${s})`, transformOrigin: "top left", position: "relative", overflow: "hidden" }}>
          {withFooter && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: FOOTER_BOTTOM_MARGIN, background: "#fff", paddingLeft: 32, paddingRight: 32 }}>
              <InvoiceFooter qrDataUrl={qrCode} labels={LABELS} />
            </div>
          )}
        </div>
        {/* Branded loader — OUTSIDE the scaled sheet so it keeps its own size: the Invotick app icon
            sits still in the centre while a blue ring spins tight around it. */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, border: "3px solid rgba(37,99,235,0.15)", borderTopColor: "#2563eb", borderRadius: "50%", animation: "aospin 0.9s linear infinite" }} />
            <img src={BRAND_LOGO} alt="" style={{ width: 62, height: 62, objectFit: "cover", borderRadius: "50%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
// The native footer's "Scan to download Invotick" QR (bundled qr_code drawable), inlined.
import qrCode from "./qr_code.jpg";

// Offline invoice renderer bundled into the app (loaded in the WebView from local assets).
// The Android app injects the invoice AFTER load via `window.__setInvoice(json)` — a single
// self-contained HTML with NO network dependency (same <InvoiceDocument> the web uses).

declare global {
  interface Window {
    __setInvoice?: (json: string) => void;
    __INVOICE__?: InvoiceRenderData;
  }
}

const root = createRoot(document.getElementById("root")!);

function render(data: InvoiceRenderData | null) {
  if (!data) {
    // No invoice yet (page loaded, waiting for __setInvoice): show the white A4 skeleton page + footer
    // + spinner at the exact final size, so the real invoice fills the same footprint — no flicker or
    // size jump. `?footer=0` (passed by the app for un-branded/premium invoices) drops the footer.
    const withFooter = new URLSearchParams(window.location.search).get("footer") !== "0";
    root.render(<SkeletonPage withFooter={withFooter} />);
    return;
  }
  // A4PagedFrame fills its positioned parent; a fixed full-screen wrapper makes it fill the WebView.
  root.render(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <A4PagedFrame
        data={data}
        qrDataUrl={qrCode}
        draggableStamp
        onStampMove={(x, y) => {
          // Report to the Android WebView bridge if present, else a global the app can hook.
          const w = window as unknown as { AndroidStamp?: { onMoved?: (x: number, y: number) => void }; __onStampMoved?: (x: number, y: number) => void };
          w.AndroidStamp?.onMoved?.(x, y);
          w.__onStampMoved?.(x, y);
        }}
        onSignatureMove={(x, y) => {
          const w = window as unknown as { AndroidStamp?: { onSignatureMoved?: (x: number, y: number) => void }; __onSignatureMoved?: (x: number, y: number) => void };
          w.AndroidStamp?.onSignatureMoved?.(x, y);
          w.__onSignatureMoved?.(x, y);
        }}
        onStampRemove={() => {
          const w = window as unknown as { AndroidStamp?: { onStampRemoved?: () => void }; __onStampRemoved?: () => void };
          w.AndroidStamp?.onStampRemoved?.();
          w.__onStampRemoved?.();
        }}
        onSignatureRemove={() => {
          const w = window as unknown as { AndroidStamp?: { onSignatureRemoved?: () => void }; __onSignatureRemoved?: () => void };
          w.AndroidStamp?.onSignatureRemoved?.();
          w.__onSignatureRemoved?.();
        }}
        onAtTopChange={(atTop) => {
          // Lets the host decide who owns a downward drag: the invoice scrolls until it can't, then
          // the sheet takes over. Native can't work this out itself — the scrolling happens on a div
          // in here, not on the WebView.
          const w = window as unknown as { AndroidStamp?: { onAtTop?: (v: boolean) => void }; __onAtTop?: (v: boolean) => void };
          w.AndroidStamp?.onAtTop?.(atTop);
          w.__onAtTop?.(atTop);
        }}
      />
    </div>,
  );
}

window.__setInvoice = (json: string) => {
  try {
    render(JSON.parse(json) as InvoiceRenderData);
  } catch {
    render(null);
  }
};

render(window.__INVOICE__ ?? null);
