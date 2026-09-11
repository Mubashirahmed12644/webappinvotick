/**
 * The number a business's next invoice gets — the series the app writes
 * (`CreateInvoiceViewModel.generateInvoiceNumber`): the business's initials, the year and month,
 * then the next sequence, e.g. TB2609005.
 *
 * The web used to write `INV-` plus the last five digits of the clock: a series of its own that
 * could repeat every hundred seconds and matched nothing the phones write (INV-69850, 2026-09-10).
 */

/** Initials as the app takes them (`String.getInitials`): first and last word, or a word's first two letters. */
export function businessInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "--";
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  const initials =
    parts.length >= 2
      ? `${first[0] ?? "-"}${parts[parts.length - 1][0] ?? "-"}`
      : first.length >= 2
        ? `${first[0]}${first[1]}`
        : `${first[0]}${first[0]}`;
  return initials.toUpperCase();
}

/**
 * Duplicate-safe, as the app's is: the highest sequence among this business's numbers in its own
 * format (initials + four digits + sequence), plus one, then past any number already taken.
 */
export function nextBusinessInvoiceNumber(businessName: string, taken: Iterable<string>, now: Date = new Date()): string {
  const initials = businessInitials(businessName);
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const existing = new Set(taken);
  const autoSeq = new RegExp(`^${escapeRegExp(initials)}\\d{4}(\\d+)$`);

  let maxSeq = 0;
  for (const n of existing) {
    const m = autoSeq.exec(n);
    if (m) maxSeq = Math.max(maxSeq, Number.parseInt(m[1], 10) || 0);
  }

  let seq = maxSeq + 1;
  let candidate = `${initials}${year}${month}${String(seq).padStart(3, "0")}`;
  while (existing.has(candidate)) {
    seq += 1;
    candidate = `${initials}${year}${month}${String(seq).padStart(3, "0")}`;
  }
  return candidate;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
