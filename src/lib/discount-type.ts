// How a discount or a tax is measured, and how its stored word is read. Kept apart from invoice-calc.ts so
// the document renderer (and the offline bundle built from it) can read a type without the money arithmetic.

/**
 * How a discount or a tax is measured: a percentage, or a fixed amount per unit.
 *
 * FLAT is the fixed amount's name in the app and in the database. FIXED stays as the free tool's own
 * name, and nothing is sent with it: every type the web sends goes through typeWord. The math below
 * treats everything other than PERCENTAGE as a fixed amount.
 */
export type DiscountType = "PERCENTAGE" | "FLAT" | "FIXED";

/**
 * A stored discount or tax type, read the way the app reads it (`DiscountType.parseOrNull`, then
 * `toDiscountType`, since 2026-09-27). Every word that has been written for a fixed amount is FLAT:
 * FLAT (the app, the server), FIXED (this form until 9c0b2d8, and the app's pull when the server sent
 * none) and AMOUNT (seen once on the server). Case and spaces do not matter; PERCENTAGE, PERCENT, a
 * missing value and anything unknown are a percentage.
 *
 * It read only "flat" as fixed until then, so a stored FIXED opened here as "%" (the app now shows it
 * as a fixed amount), and the form's math took 50 as 50 %.
 */
export function discountTypeOf(stored: string | null | undefined): DiscountType {
  switch (stored?.trim().toUpperCase()) {
    case "FLAT":
    case "FIXED":
    case "AMOUNT":
      return "FLAT";
    default:
      return "PERCENTAGE";
  }
}

/**
 * The word a discount or tax type is sent as, the reverse of discountTypeOf: PERCENTAGE, or FLAT for
 * any fixed amount. FIXED never leaves the web: app builds before 2026-09-27 read it as a percentage,
 * so a fixed 50 would open there as 50%, and the server refuses it as an item's tax type.
 */
export function typeWord(type: DiscountType): "PERCENTAGE" | "FLAT" {
  return type === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";
}
