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
  const [phase, setPhase] = useState<Phase>("loading");
  /** Bumped on every swap so the ring's CSS animation restarts from full. */
  const [cycleKey, setCycleKey] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The next code, fetched early and held back until the ring finishes. */
  const nextRef = useRef<{ code: string; qr: string } | null>(null);
  /**
   * Every code still worth asking about — the one on screen, and the one it replaced.
   *
   * A code the user scanned a moment before the swap stays valid on the server for another half
   * minute, and they are, right then, tapping Approve on their phone. Polling only the newest code
   * would drop exactly that person.
   */
  const liveCodes = useRef<{ code: string; diesAt: number }[]>([]);
  const cyclesRef = useRef(0);

  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const render = useCallback(async (code: string) => {
    // High error correction, because the logo in the middle covers part of the pattern. At this
    // level roughly a third of the code can be obscured and it still reads.
    return QRCode.toDataURL(`https://www.invotick.com/device-link/${code}`, {
      margin: 1,
      width: 480,
      errorCorrectionLevel: "H",
      color: { dark: "#0B1B3A", light: "#FFFFFF" },
    });
  }, []);

  const mintCode = useCallback(async () => {
    const res = await fetch("/api/auth/device-link", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!data?.success || !data.data?.code) return null;
    return data.data.code as string;
  }, []);

  /** Puts a code on screen and starts the clock that will replace it. */
  const beginCycle = useCallback(
    async (existing?: { code: string; qr: string }) => {
      const code = existing?.code ?? (await mintCode());
      if (!code) {
        setError("Could not start sign-in. Please try again.");
        setPhase("error");
        return;
      }

      const image = existing?.qr ?? (await render(code));

      liveCodes.current = [
        { code, diesAt: Date.now() + CODE_TTL_MS },
        // Keep the one being replaced, until the server would refuse it anyway.
        ...liveCodes.current.filter((c) => c.code !== code && c.diesAt > Date.now()),
      ].slice(0, 2);

      setQr(image);
      setPhase("live");
      setCycleKey((k) => k + 1);

      // Fetched early and deliberately not shown yet. The swap is then instant — the shimmer is
      // covering a decision, not a network request, so it lasts the same beat every time instead
      // of however long the server happens to take.
      later(async () => {
        const upcoming = await mintCode();
        if (upcoming) nextRef.current = { code: upcoming, qr: await render(upcoming) };
      }, REFRESH_MS - PREFETCH_LEAD_MS);

      later(() => {
        cyclesRef.current += 1;
        if (cyclesRef.current >= MAX_CYCLES) {
          // Nobody is coming. Minting codes into an abandoned tab costs the server rows for no one.
          stopAll();
          setQr(null);
          setPhase("idle");
          return;
        }

        setPhase("shimmer");
        later(() => {
          const ready = nextRef.current;
          nextRef.current = null;
          void beginCycle(ready ?? undefined);
        }, SHIMMER_MS);
      }, REFRESH_MS);
    },
    [mintCode, render, stopAll],
  );

  const start = useCallback(
    async (manual = false) => {
      stopAll();
      setError(null);
      setPhase("loading");
      setQr(null);
      nextRef.current = null;
      liveCodes.current = [];
      if (manual) cyclesRef.current = 0;

      await beginCycle();

      pollRef.current = setInterval(async () => {
        const now = Date.now();
        liveCodes.current = liveCodes.current.filter((c) => c.diesAt > now);

        for (const { code } of liveCodes.current) {
          const claim = await fetch("/api/auth/device-link", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, deviceId: browserDeviceId() }),
          }).catch(() => null);

          const result = await claim?.json().catch(() => null);
          if (result?.success) {
            stopAll();
            setPhase("claimed");
            router.push(next);
            router.refresh();
            return;
          }
        }
      }, POLL_MS);
    },
    [beginCycle, next, router, stopAll],
  );

  useEffect(() => {
    void start();
    return stopAll;
  }, [start, stopAll]);

  // Coming back to the tab is a strong signal the user is about to scan, so the code is replaced
  // then — whatever was on screen while they were away has very likely expired.
  //
  // Deliberately *not* pausing while hidden. An earlier version did, to save requests, and it
  // recreated the exact bug this component exists to fix: the timers stopped but the QR stayed on
  // screen, so the page sat there showing a code that was already dead and would never be replaced.
  // Some environments report a tab as hidden permanently.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && phase !== "claimed") void start(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [start, phase]);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <style>{RING_STYLES}</style>

      {/* Numbered, because the flow crosses two devices and the person reading this is holding
          only one of them. A single sentence leaves them looking for a scanner in the browser. */}
      <ol className="w-full space-y-2 text-left text-sm text-[var(--color-on-surface-variant)]">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {phase !== "idle" && phase !== "error" && (
        <div className="relative" style={{ width: BOX, height: BOX }}>
          {/* The ring is the clock.
              A code that silently swaps looks like a glitch; a code you can watch running down
              looks like a system working. It also answers "is this still good?" without a word. */}
          <svg
            key={cycleKey}
            className="absolute inset-0"
            width={BOX}
            height={BOX}
            viewBox={`0 0 ${BOX} ${BOX}`}
            aria-hidden="true"
          >
            {/* A rounded rectangle, not a circle. A circle drawn around a square code is hidden
                behind its corners for most of its length, so it reads as four disconnected arcs.
                This traces the card's own outline instead.

                pathLength="1" lets the dash maths be a fraction of the whole rather than a
                perimeter recomputed by hand every time the size changes. */}
            <rect
              x={RING_INSET}
              y={RING_INSET}
              width={BOX - RING_INSET * 2}
              height={BOX - RING_INSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              pathLength={1}
              className="text-[var(--color-outline-variant)] opacity-40"
            />
            <rect
              x={RING_INSET}
              y={RING_INSET}
              width={BOX - RING_INSET * 2}
              height={BOX - RING_INSET * 2}
              rx={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              className="qr-ring text-[var(--color-primary)]"
              style={{
                strokeDasharray: 1,
                animationDuration: `${REFRESH_MS}ms`,
                // Held still during the shimmer so it rests at empty rather than snapping back to
                // full while the next code is still being swapped in.
                animationPlayState: phase === "live" ? "running" : "paused",
              }}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            {phase === "live" && qr ? (
              <div className="qr-fade relative rounded-2xl bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Sign-in code" width={QR} height={QR} className="rounded-lg" />
                {/* The mark sits on the code the way it does on WhatsApp's — it says which app is
                    being asked for before anything has been read. */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-[0_0_0_4px_white]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/invotick-icon.png" alt="" width={32} height={32} className="rounded-lg" />
                  </span>
                </span>
              </div>
            ) : (
              <div
                className="qr-shimmer rounded-2xl"
                style={{ width: QR + 24, height: QR + 24 }}
                aria-label="Loading a new code"
              />
            )}
          </div>
        </div>
      )}

      <p className="min-h-[2.5rem] text-xs text-[var(--color-on-surface-variant)]">
        {phase === "shimmer" || phase === "loading"
          ? "Getting a fresh code…"
          : phase === "live"
            ? "Waiting for you to approve it on your phone. A new code appears when the ring runs out."
            : null}
      </p>

      {phase === "idle" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm">Still there?</p>
          <button
            type="button"
            onClick={() => void start(true)}
            className="rounded-full border border-[var(--color-outline-variant)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-variant)]"
          >
            Show a code
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/**
 * A name this browser keeps, so the account owner can sign it out later.
 *
 * Stored rather than generated per visit: a device the owner cannot find twice is a device they
 * cannot revoke, and the whole point of the list is that ending a session actually ends it.
 *
 * Not an identifier of the person — it says nothing about them and is only ever seen by the account
 * they chose to link it to.
 */
function browserDeviceId(): string {
  const KEY = "invotick.device-id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private browsing, or storage refused. A session that cannot be revoked from the list is
    // still better than no sign-in at all — and it expires on its own in a week.
    return crypto.randomUUID();
  }
}

type Phase = "loading" | "live" | "shimmer" | "idle" | "claimed" | "error";

const STEPS = [
  "Open Invotick on your phone",
  "Go to Menu → Linked Devices and tap Link a device",
  "Point your phone at this code",
];

const QR = 216;
/** The white card is the code plus its padding; the ring sits just outside that. */
const CARD = QR + 24;
const BOX = CARD + 28;
const RING_INSET = 2;
const RING_RADIUS = 28;

const POLL_MS = 3000;

/**
 * When to replace the code, against a server that keeps one for two minutes.
 *
 * Thirty seconds early, so the code survives the gap between a scan and the Approve tap that
 * follows it.
 */
const REFRESH_MS = 90_000;

/** How long the server keeps a code — used to know when to stop asking about an old one. */
const CODE_TTL_MS = 120_000;

/**
 * How far ahead the next code is fetched.
 *
 * Its two-minute life starts when it is minted, not when it is shown, so this is spent out of the
 * displayed code's budget. Eight seconds buys an instant swap and still leaves the code on screen
 * comfortably inside its own life.
 */
const PREFETCH_LEAD_MS = 8_000;

/** Long enough to read as a deliberate change, short enough not to feel like waiting. */
const SHIMMER_MS = 2_500;

/**
 * How many cycles before assuming the tab was left open and abandoned.
 *
 * Ten is about fifteen minutes — far longer than signing in needs, short enough that a forgotten
 * tab stops asking the server for codes until it is closed.
 */
const MAX_CYCLES = 10;

const RING_STYLES = `
@keyframes qr-ring-drain { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 1; } }
@keyframes qr-fade-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes qr-shimmer-sweep { from { background-position: -180% 0; } to { background-position: 180% 0; } }

.qr-ring { animation: qr-ring-drain linear forwards; }
.qr-fade { animation: qr-fade-in 420ms ease-out both; }
.qr-shimmer {
  background: linear-gradient(100deg,
    var(--color-surface-variant, #eceef3) 30%,
    rgba(255,255,255,0.85) 50%,
    var(--color-surface-variant, #eceef3) 70%);
  background-size: 220% 100%;
  animation: qr-shimmer-sweep 1.35s ease-in-out infinite;
}

/* Motion here is decoration carrying one piece of information — time left. For anyone who has
   asked the system for less of it, the ring holds still and the code still swaps. */
@media (prefers-reduced-motion: reduce) {
  .qr-ring, .qr-fade, .qr-shimmer { animation: none; }
}
`;
