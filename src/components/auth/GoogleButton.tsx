"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface GoogleIdApi {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// `label` is a Google-supported button text code: signin_with | signup_with | continue_with.
export function GoogleButton({ onError, label = "signin_with" }: { onError?: (m: string) => void; label?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const render = () => {
      const el = ref.current;
      const id = window.google?.accounts?.id;
      if (!el || !id || done.current) return;
      done.current = true;

      id.initialize({
        client_id: CLIENT_ID,
        // popup flow → works across browsers incl. Safari (no FedCM dependency)
        ux_mode: "popup",
        callback: async (resp) => {
          try {
            const r = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: resp.credential }),
            });
            const data = await r.json();
            if (!data.success) {
              onError?.(data.message || "Google sign-in failed.");
              return;
            }
            router.push(params.get("next") || "/invoices");
            router.refresh();
          } catch {
            onError?.("Something went wrong. Please try again.");
          }
        },
      });

      const width = Math.min(400, Math.max(240, el.offsetWidth || 320));
      id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: label,
        shape: "pill",
        logo_alignment: "center",
        width,
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, [router, params, onError, label]);

  if (!CLIENT_ID) {
    return <p className="text-center text-xs text-[var(--color-on-surface-variant)]">Google sign-in isn’t configured yet.</p>;
  }

  return <div ref={ref} className="flex w-full justify-center" />;
}
