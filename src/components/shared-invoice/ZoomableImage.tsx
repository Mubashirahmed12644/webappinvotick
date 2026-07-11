"use client";

import { useEffect, useRef, useState } from "react";

// The app uploads the pixel-perfect invoice image a few seconds AFTER the share link is minted,
// so a receiver who opens the link immediately (e.g. straight from WhatsApp) can momentarily hit
// a 404. Retry a handful of times — the upload usually lands within seconds — before giving up.
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 1500;

/**
 * The shared invoice image, sized to fit its (height-constrained) container so the WHOLE invoice
 * is visible at a glance — then tap/click to zoom in and scroll/pan the details, tap again to
 * return to the fit-to-view state. Works on touch (tap) and desktop (click).
 *
 * Resilient to the upload race above: while the image is (re)loading it shows a quiet placeholder
 * instead of the browser's broken-image icon, retries a few times, and if it still isn't there it
 * renders [fallback] (the server-rendered snapshot) so the invoice is ALWAYS visible.
 */
export function ZoomableImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when the source changes (e.g. the real image appears after a background revalidate).
  useEffect(() => {
    setAttempt(0);
    setLoading(true);
    setFailed(false);
    setZoomed(false);
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [src]);

  // Cache-bust each retry so the browser re-requests instead of serving the cached 404.
  const displaySrc =
    attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  function handleError() {
    if (attempt >= MAX_RETRIES) {
      setFailed(true);
      return;
    }
    setLoading(true);
    retryTimer.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
  }

  function toggle(e: React.MouseEvent<HTMLDivElement>) {
    if (loading || failed) return;
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

  // Retries exhausted → show the server-rendered invoice instead of a broken image.
  if (failed && fallback) {
    return <div className="h-full w-full overflow-auto">{fallback}</div>;
  }

  return (
    <div
      ref={containerRef}
      onClick={toggle}
      className={
        zoomed
          ? "relative h-full w-full cursor-zoom-out overflow-auto"
          : "relative flex h-full w-full cursor-zoom-in items-start justify-center overflow-hidden"
      }
    >
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-neutral-400">Loading invoice…</span>
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt={alt}
        draggable={false}
        onLoad={() => setLoading(false)}
        onError={handleError}
        className={`block select-none ${loading ? "opacity-0" : ""} ${
          zoomed ? "w-[180%] max-w-none" : "max-h-full max-w-full object-contain"
        }`}
      />
    </div>
  );
}
