/**
 * The e-mail typo hint: given what a person typed, the same address with ONLY its domain corrected,
 * or null when there is nothing worth suggesting. Pure, never throws, no network, no MX lookup.
 *
 * This is the web twin of the app's `suggestEmailFix` (`EmailTypoSuggestion.kt`). The two MUST agree
 * row for row: both encode the 60-row table of `kaam/research/otp-wrong-email-spec.md` section 1.3
 * (see `emailTypo.test.ts`). Change a rule here and the same change goes to the app, in the same
 * release, or the two platforms start suggesting different things for one address.
 *
 * It catches domain typos only (`gmial.con`). A typo before the `@` cannot be known by any rule; the
 * code step puts the address in front of the person for that.
 *
 * Adding a provider: first look at its one-step neighbours for real domains and put those in
 * KNOWN_REAL in the same change, with a row in the test table.
 */

const PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "msn.com",
  "ymail.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
] as const;

// Real domains that sit one step from a provider (mail.com and email.com are next to gmail.com,
// cloud.com is next to icloud.com). Without this list they would be "corrected" into a provider.
const KNOWN_REAL = ["mail.com", "email.com", "cloud.com", "gmx.com", "me.com", "mac.com"] as const;

// Exactly two labels, ASCII only. This one line leaves gmail.com.pk, yahoo.co.uk, a trailing dot,
// a missing dot and any non-ASCII letter (a Cyrillic "a" in "gmail") alone.
const TWO_ASCII_LABELS = /^[a-z0-9-]+\.[a-z0-9-]+$/;

/** Optimal string alignment distance: insert, delete, substitute, or swap two neighbours, each 1. */
function osa(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many edits the part before the dot may take: short names may only have their ending fixed. */
function labelLimit(providerLabel: string): number {
  if (providerLabel.length <= 4) return 0;
  if (providerLabel.length <= 6) return 1;
  return 2;
}

export function suggestEmailFix(typed: string): string | null {
  const s = String(typed ?? "").trim();
  const parts = s.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain) return null;

  const d = domain.toLowerCase();
  if (!TWO_ASCII_LABELS.test(d)) return null;
  if (d.startsWith("xn--") || d.includes(".xn--")) return null;
  if ((PROVIDERS as readonly string[]).includes(d) || (KNOWN_REAL as readonly string[]).includes(d)) return null;

  const [label, tld] = d.split(".");
  let best: string | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;
  let tie = false;
  for (const provider of PROVIDERS) {
    const [pLabel, pTld] = provider.split(".");
    const labelDistance = osa(label, pLabel);
    const tldDistance = osa(tld, pTld);
    if (labelDistance > labelLimit(pLabel) || tldDistance > 1) continue;
    const total = labelDistance + tldDistance;
    if (total === 0 || total > 2) continue;
    if (total < bestTotal) {
      best = provider;
      bestTotal = total;
      tie = false;
    } else if (total === bestTotal) {
      tie = true;
    }
  }
  // Never guess between two providers (hmail.com is one step from gmail.com and ymail.com).
  if (best === null || tie) return null;
  return `${local}@${best}`;
}
