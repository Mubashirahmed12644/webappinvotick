"use client";

import { useEffect, useState } from "react";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import type { InvoiceRenderData } from "@/lib/data";

/**
 * Headless invoice renderer for the native-vs-HTML parity harness (and, later, the
 * single source of truth for OG / shared-invoice / PDF).
 *
 * The app's WebView loads this page and passes the invoice as `InvoiceRenderData`
 * (== the app's InvoiceSnapshot — same field names) either via:
 *   - the URL hash: `#<urlencoded base64(utf8 json)>`  (simple, used by the harness), or
 *   - a postMessage: `{ type: "invotick:invoice", data: <InvoiceRenderData> }` (for
 *     larger payloads without URL-length limits).
 *
 * It renders the EXACT same <InvoiceDocument> the web uses, at a fixed A4-ish width so
 * the WebView (useWideViewPort) scales the whole sheet to fit — giving a clean, stable
 * invoice to screenshot and diff against the native render.
 */
export default function EmbedRenderPage() {
  const [data, setData] = useState<InvoiceRenderData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function decodeHash(): InvoiceRenderData | null {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) return null;
      // UTF-8 safe: base64 -> bytes -> TextDecoder (handles Arabic/Chinese/etc).
      const b64 = decodeURIComponent(raw);
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json) as InvoiceRenderData;
    }

    function loadFromHash() {
      try {
        const parsed = decodeHash();
        if (parsed) {
          setData(parsed);
          setError(null);
        } else if (!data) {
          setError("Waiting for invoice data…");
        }
      } catch {
        setError("Invalid invoice data");
      }
    }

    function onMessage(e: MessageEvent) {
      const payload = e.data;
      if (payload && typeof payload === "object" && payload.type === "invotick:invoice" && payload.data) {
        setData(payload.data as InvoiceRenderData);
        setError(null);
      }
    }

    loadFromHash();
    window.addEventListener("hashchange", loadFromHash);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("hashchange", loadFromHash);
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light-grey page background (matches the native canvas) behind the fitted sheet.
  useEffect(() => {
    document.documentElement.style.background = "#f7f7f7";
    document.body.style.background = "#f7f7f7";
    document.body.style.margin = "0";
  }, []);

  if (!data) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#666" }}>
        {error ?? "Loading…"}
      </div>
    );
  }

  // A4PagedFrame fills its positioned parent; a fixed full-screen wrapper makes it fill the WebView.
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100dvh" }}>
      <A4PagedFrame data={data} qrDataUrl="/qr_code.jpg" />
    </div>
  );
}
