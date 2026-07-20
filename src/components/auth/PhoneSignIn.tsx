"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

/**
 * Signing in by scanning a code with the Invotick app.
 *
 * This is not a convenience path. Nearly every Invotick account is a guest — no email, no password,
 * no Google account behind it — so both other options on this page are closed to them, and without
 * this the web app is something most users can never open, premium or not.
 *
 * The browser is the side asking to be let in: it shows a code and waits for the phone to approve.
 * Nothing on screen grants anything until then, which is why it is safe to display.
 */
export function PhoneSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const start = useCallback(async () => {
    stopPolling();
    setError(null);
    setExpired(false);
    setQr(null);

    const res = await fetch("/api/auth/device-link", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);

    if (!data?.success || !data.data?.code) {
      setError(data?.message || "Could not start sign-in. Please try again.");
      return;
    }

    const code: string = data.data.code;

    // The QR carries a link rather than the bare code, so the phone's own camera opens the app at
    // the approval screen. www because that is the host the app's link verification accepts.
    setQr(await QRCode.toDataURL(`https://www.invotick.com/device-link/${code}`, { margin: 1, width: 240 }));

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;

      // The code lives two minutes on the server; polling past that only asks a question whose
      // answer can no longer change.
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        setQr(null);
        setExpired(true);
        return;
      }

      const claim = await fetch("/api/auth/device-link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => null);

      const result = await claim?.json().catch(() => null);
      if (result?.success) {
        stopPolling();
        router.push(next);
        router.refresh();
      }
    }, POLL_MS);
  }, [next, router]);

  useEffect(() => {
    void start();
    return stopPolling;
  }, [start]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">
        Open Invotick on your phone and point its camera at this code.
      </p>

      {qr && <img src={qr} alt="Sign-in code" width={240} height={240} className="rounded-lg" />}

      {qr && (
        <p className="text-xs text-muted-foreground">
          Waiting for you to approve it on your phone. This code lasts two minutes.
        </p>
      )}

      {expired && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm">That code expired.</p>
          <button type="button" onClick={() => void start()} className="text-sm underline">
            Show a new one
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

const POLL_MS = 3000;
/** Two minutes, matching how long the server keeps a code. */
const MAX_ATTEMPTS = 40;
