/*
 * GIVENS — forward-compatible fallback values.
 *
 * Pattern (per CEO): for every value the webapp needs but the mobile/server
 * does NOT sync yet, we (1) read the intended real field first, and (2) fall
 * back to a documented "given" default here. The moment the real field starts
 * arriving from sync, it is used automatically — the default just stops applying.
 * No code change needed when the data lands; only remove the entry once ✅.
 *
 * Each entry documents: intended source field, current default, tracking id.
 * Keep in step with docs/MOBILE-APP-REQUIREMENTS.md.
 */

export const GIVENS = {
  // R3 — item sequence. Intended source: invoiceItem.orderIndex (not sent yet).
  // Until then, order by createdAt ascending.
  itemOrder: {
    intendedField: "invoiceItem.orderIndex",
    fallback: "sort by createdAt ascending",
  },

  // R6 — invoice title ("Invoice") color. Intended source: template.titleColor
  // (not sent yet). Until then: white over a header image, else theme-contrast.
  titleColor: {
    intendedField: "template.titleColor",
    defaultOverHeaderImage: "#ffffff",
  },

  // R5 — invoice currency. Intended source: invoice.currency (often empty).
  // Fallback chain: client.currencyCode -> business.currencyCode -> USD.
  currency: {
    intendedField: "invoice.currency",
    fallbackChain: ["client.currencyCode", "business.currencyCode", "USD"],
  },

  // R7 — footer Invotick brand logo. Intended source: a server-hosted brand
  // asset URL (e.g. /v1/app-config -> brandLogoUrl). Not on server yet, so we
  // use the SAME app icon bundled from the mobile repo. Auto-inflates later.
  footerLogo: {
    intendedField: "appConfig.brandLogoUrl",
    default: "/system-assets/invotick-logo.png",
  },
} as const;

// Brand footer logo — swap to a server value once appConfig provides one.
export const BRAND_LOGO = GIVENS.footerLogo.default;

// Resolve item order: use orderIndex when ANY item has it (auto-inflates once
// mobile/server sends it); otherwise keep createdAt order.
export function sortByOrder<T extends { orderIndex?: number | null; createdAt?: string | null }>(items: T[]): T[] {
  const hasOrder = items.some((i) => i.orderIndex != null);
  return [...items].sort((a, b) =>
    hasOrder
      ? (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      : (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
}
