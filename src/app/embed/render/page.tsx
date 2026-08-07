"use client";

import { useEffect, useState } from "react";
import { A4PagedFrame } from "@/components/invoice/A4PagedFrame";
import { translateInvoice, type TranslatedInvoice } from "@/lib/translate-invoice";
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
  // Server-data mode: `?token=X` fetches the SERVER-STORED snapshot (what OG-link / webapp / iOS get)
  // and renders it read-only (non-draggable) — the app's "Online" verify tab uses this to confirm the
  // server round-trip renders identically to the offline bundle. No token → local hash/postMessage
  // data with draggable overlays (the editing harness).
  const [serverMode, setServerMode] = useState(false);
  // Translated view of [data], or null when the document is shown in its original language.
  //
  // The app's preview asks for this with ?lang=xx, so an invoice can be read in the receiver's
  // language from inside the app using the SAME translation the public share page runs — one
  // implementation, one set of labels, one right-to-left decision. A second translator would drift
  // from this one and the sender would be shown something the receiver never sees.
  const [translated, setTranslated] = useState<TranslatedInvoice | null>(null);

  useEffect(() => {
    if (!data) return;
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (!lang || lang === "en") {
      setTranslated(null);
      return;
    }
    let cancelled = false;
    void translateInvoice(data, lang)
      .then((t) => { if (!cancelled) setTranslated(t); })
      // Silent on failure, showing the original. A half-translated invoice, or an error where a
      // document should be, is worse than one in the language it was written in.
      .catch(() => { if (!cancelled) setTranslated(null); });
    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    setServerMode(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shared-invoice/${encodeURIComponent(token)}/snapshot`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { snapshot?: InvoiceRenderData };
        if (!cancelled && json.snapshot) { setData(json.snapshot); setError(null); }
        else if (!cancelled) setError("No snapshot on server for this token");
      } catch (e) {
        if (!cancelled) setError(`Server fetch failed: ${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Effects run client-side only, so window is safe here. In token mode the fetch above owns the
    // data — skip the local hash/postMessage listeners entirely (no state-timing race).
    if (new URLSearchParams(window.location.search).has("token")) return;
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
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      <A4PagedFrame
        data={translated?.data ?? data}
        labels={translated?.labels}
        dir={translated?.dir ?? "ltr"}
        qrDataUrl="/qr_code.jpg"
        // Server (token) mode renders read-only — exactly like the receiver's OG-link. Local (hash)
        // mode keeps the draggable editing overlays.
        draggableStamp={!serverMode}
        onStampMove={(x, y) => {
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
    </div>
  );
}
