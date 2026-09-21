/**
 * Whether a document carries the Invotick footer — decision 0147.
 *
 * The owner, 2026-09-21: a premium user's invoice has no Invotick footer, anywhere it is drawn. Free
 * users keep it; it is the growth surface that tells their clients where the invoice was made (G2).
 *
 * Two sources can take it off, and either is enough:
 * - the snapshot itself (`hideInvotickFooter`), stamped by the app from the phone's premium state when
 *   the document is rendered or shared;
 * - the share read's `showInvotickFooter: false`, which the server answers when the OWNER is premium
 *   now. Shared snapshots are frozen, so without it a link sent before the owner paid, or by a build
 *   that did not stamp the snapshot, would keep the footer for ever.
 *
 * Deliberately free of imports, so the node check in scripts/checks can load it as it is.
 */

export interface FooterFlag {
  hideInvotickFooter?: boolean | null;
}

/** True unless the document says it is a premium one. Absent is a free user's, or an old snapshot. */
export function showsInvotickFooter(data: FooterFlag | null | undefined): boolean {
  return data?.hideInvotickFooter !== true;
}

/**
 * The snapshot as the share page renders it: footer off when the server says the owner is premium now.
 * Only an explicit `false` takes it off — a server from before 0147 sends nothing, which changes nothing.
 * Never puts a footer back on a snapshot that left it off.
 */
export function withOwnersFooterRule<T extends FooterFlag>(snapshot: T, showInvotickFooter?: boolean | null): T {
  return showInvotickFooter === false ? { ...snapshot, hideInvotickFooter: true } : snapshot;
}

/**
 * The business's own footer — decision 0151 ("apna footer").
 *
 * The owner, 2026-09-21: the footer's layout never changes. For a premium account each Invotick item is
 * replaced IN THE SAME SLOT by the business's own item — logo tile, message, name line, "Contact us",
 * contact line, QR tile. The app resolves every slot (settings + business profile + fallbacks) and ships
 * the result in the snapshot, so the four surfaces (app preview, offline bundle, online render, share
 * page) draw the same thing from the same data and none of them re-derives it.
 *
 * A slot that is null is drawn EMPTY — its space is kept, so the band never reflows.
 */
export interface OwnFooter {
  /** The owner removed the whole footer: no band at all, as in 0147. */
  removed?: boolean | null;
  /** Draw the business logo (`business.logo`) on the tile; without a logo, [initials] go there. */
  showLogo?: boolean | null;
  /** Letters for the tile when there is no logo. Null with no logo = an empty tile slot. */
  initials?: string | null;
  /** Where "Invoice generated using Invotick" was. */
  message?: string | null;
  /** Where the tagline was: the business name, and its address when it has one. */
  businessLine?: string | null;
  /** Where the Invotick link was: phone · email. Null = the whole "Contact us" block is empty. */
  contactLine?: string | null;
  /** What the QR encodes (WhatsApp or website). Null = the QR slot stays empty. */
  qrText?: string | null;
}

export interface OwnFooterFlag extends FooterFlag {
  ownFooter?: OwnFooter | null;
}

export type FooterMode = "invotick" | "own" | "none";

/**
 * Which footer a document carries.
 * - A free document (or any snapshot from before 0147): the Invotick footer, unchanged.
 * - A premium document with the business's own footer: that, in the same band.
 * - A premium document without one (a 1.4.8 snapshot, or the owner removed it): no footer (0147).
 */
export function footerMode(data: OwnFooterFlag | null | undefined): FooterMode {
  if (showsInvotickFooter(data)) return "invotick";
  const own = data?.ownFooter;
  if (own && own.removed !== true) return "own";
  return "none";
}
