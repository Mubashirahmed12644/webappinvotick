// Where an overlay with no place of its own starts on the page, in either reading direction (decision 0187).
//
// Every default below is designed against the left-to-right page: the stamps start over the totals box, which sits on
// the right. A right-to-left page draws its totals box on the left, so a default there is the mirror of the
// left-to-right one: the overlay's left edge lands where its right edge was, `x → 1 − x − size`. The app's native
// renderer does the same (`DraggableModule`, `DraggableStampModule.paymentStampStart`).
//
// Only a default mirrors. A stamp or signature the user dragged keeps the place they gave it, in either direction,
// because it is a place on the preview they were looking at — and so does the native PDF.

/** The automatic PAID / PARTIALLY PAID stamp's width and height, as a share of the sheet's width. */
export const PAYMENT_STAMP_SIZE = 0.189;

/** Where the automatic PAID / PARTIALLY PAID stamp starts on a left-to-right page (its y is then measured). */
export const PAYMENT_STAMP_START = { x: 0.68, y: 0.521 };

type Frac = { x: number; y: number };

/**
 * [start], designed left to right, on a page read in [dir]: the same object left to right (so nothing about an English
 * document changes), its mirror right to left. [size] is the overlay's width as a share of the sheet's width.
 */
export function startInDirection(start: Frac, size: number, dir: "ltr" | "rtl"): Frac {
  return dir === "rtl" ? { x: 1 - start.x - size, y: start.y } : start;
}
