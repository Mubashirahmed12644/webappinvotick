"use client";

import { useEffect, useRef, useState } from "react";

// The app uploads the invoice image when the sender taps Share (kept light — a screen-res WebP —
// so it lands fast). A receiver who opens the link immediately can arrive a beat before the upload
// finishes, so we poll for it, show a progress state while we wait, and swap it in the moment it
// lands. If it still never arrives (rare — upload failed / sender offline), we surface a retry +
// "open in the app" nudge instead of spinning forever.
const POLL_INTERVAL_MS = 1500;
const GIVE_UP_AFTER_MS = 45000;

/**
 * The shared invoice image, sized to fit its (height-constrained) container so the WHOLE invoice
 * is visible at a glance — tap/click to zoom, tap again to fit. Works on touch and desktop.
 */
export function ZoomableImage({
  token,
  initialSrc,
  alt,
  installUrl,
}: {
  token: string;
  initialSrc: string | null;
  alt: string;
  installUrl?: string;
}) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [loaded, setLoaded] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bump to restart the poll cycle (Retry)

  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const erroredRef = useRef(false);
  const bustRef = useRef(0);

  // Poll for the image URL until it loads, or we give up. Updating `src` only when we have no URL
  // yet or the current one errored avoids interrupting a valid in-flight load.
  useEffect(() => {
    loadedRef.current = false;
    erroredRef.current = false;
    setLoaded(false);
    setGaveUp(false);
    setZoomed(false);
    setSrc(initialSrc);

    let cancelled = false;
    const start = Date.now();
    let pollTimer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled || loadedRef.current) return;
      if (Date.now() - start > GIVE_UP_AFTER_MS) {
        if (!cancelled) setGaveUp(true);
        return;
      }
      try {
        const res = await fetch(`/api/shared-invoice/${encodeURIComponent(token)}/image-url`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as { imageUrl?: string | null } | null;
        const url = json?.imageUrl ?? null;
        if (!cancelled && !loadedRef.current && url && (src === null || erroredRef.current)) {
          erroredRef.current = false;
          bustRef.current += 1;
          setSrc(`${url}${url.includes("?") ? "&" : "?"}v=${bustRef.current}`);
        }
      } catch {
        /* ignore; retry on next tick */
      }
      if (!cancelled && !loadedRef.current) pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    pollTimer = setTimeout(tick, initialSrc ? POLL_INTERVAL_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialSrc, attempt]);

  function toggle(e: React.MouseEvent<HTMLDivElement>) {
    if (!loaded) return;
    const next = !zoomed;
    setZoomed(next);
    if (next && containerRef.current) {
      const el = containerRef.current;
      requestAnimationFrame(() => {
        const x = e.nativeEvent.offsetX / el.clientWidth;
        const y = e.nativeEvent.offsetY / el.clientHeight;
        el.scrollLeft = x * (el.scrollWidth - el.clientWidth);
        el.scrollTop = y * (el.scrollHeight - el.clientHeight);
      });
    } else if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, left: 0 });
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={toggle}
      className={
        loaded
          ? zoomed
            ? "relative h-full w-full cursor-zoom-out overflow-auto"
            : "relative flex h-full w-full cursor-zoom-in items-start justify-center overflow-hidden"
          : "relative h-full w-full overflow-hidden"
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => {
            loadedRef.current = true;
            setLoaded(true);
            setGaveUp(false);
          }}
          onError={() => {
            erroredRef.current = true;
          }}
          className={
            !loaded
              ? "hidden"
              : zoomed
                ? "block w-[180%] max-w-none select-none"
                : "block max-h-full max-w-full select-none object-contain"
          }
        />
      ) : null}

      {!loaded && (gaveUp ? <TimeoutState installUrl={installUrl} onRetry={() => setAttempt((a) => a + 1)} /> : <PreparingState />)}
    </div>
  );
}

/** Skeleton + indeterminate bar while the image is being prepared/uploaded. */
function PreparingState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
      {/* faint invoice-shaped skeleton so the area doesn't read as broken/empty */}
      <div className="w-full max-w-xs space-y-2.5 opacity-60" aria-hidden>
        <div className="h-8 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="w-40 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-1.5 w-1/2 rounded-full bg-[#0D4DC0] [animation:si-slide_1.1s_ease-in-out_infinite]" />
      </div>
      <p className="text-sm text-neutral-500">Preparing invoice…</p>
      <style>{`@keyframes si-slide{0%{margin-left:-50%}100%{margin-left:100%}}`}</style>
    </div>
  );
}

/** Shown only if the image never arrives — retry + open-in-app, instead of spinning forever. */
function TimeoutState({ installUrl, onRetry }: { installUrl?: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-sm text-neutral-600">This invoice is taking longer than usual to load.</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="rounded-full bg-[#0D4DC0] px-5 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
        {installUrl ? (
          <a
            href={installUrl}
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-800"
          >
            Open in app
          </a>
        ) : null}
      </div>
    </div>
  );
}
