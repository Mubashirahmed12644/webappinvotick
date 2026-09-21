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
