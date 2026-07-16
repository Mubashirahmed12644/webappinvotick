import { createRoot } from "react-dom/client";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import type { InvoiceRenderData } from "@/lib/data";
import "./renderer.css";
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
    root.render(
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#666" }}>
        No invoice data
      </div>,
    );
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
