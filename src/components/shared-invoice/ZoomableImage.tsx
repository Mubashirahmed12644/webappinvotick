"use client";

import { useRef, useState } from "react";

/**
 * The shared invoice image, sized to fit its (height-constrained) container so the WHOLE invoice
 * is visible at a glance — then tap/click to zoom in and scroll/pan the details, tap again to
 * return to the fit-to-view state. Works on touch (tap) and desktop (click).
 */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function toggle(e: React.MouseEvent<HTMLDivElement>) {
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
        zoomed
          ? "h-full w-full cursor-zoom-out overflow-auto"
          : "flex h-full w-full cursor-zoom-in items-start justify-center overflow-hidden"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`block select-none ${
          zoomed ? "w-[180%] max-w-none" : "max-h-full max-w-full object-contain"
        }`}
      />
    </div>
  );
}
