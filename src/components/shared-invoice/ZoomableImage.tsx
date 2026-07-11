"use client";

import { useRef, useState } from "react";

/**
 * The shared invoice image with tap/click zoom. Tap to zoom in (and scroll/pan around the
 * enlarged invoice); tap again to return to the actual fit-to-width position. Works on both
 * touch (tap) and desktop (click).
 */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function toggle(e: React.MouseEvent<HTMLDivElement>) {
    const next = !zoomed;
    setZoomed(next);
    // When zooming in, center the tapped point so the user zooms "into" what they touched.
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
        zoomed
          ? "max-h-[85vh] cursor-zoom-out overflow-auto"
          : "cursor-zoom-in overflow-hidden"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`block select-none transition-[width] duration-200 ${
          zoomed ? "w-[200%] max-w-none" : "w-full"
        }`}
      />
    </div>
  );
}
