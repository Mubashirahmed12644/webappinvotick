import "server-only";

/**
 * A per-IP cap on how many analytics events one caller may post from the public share page.
 *
 * ## What this is, and what it is not
 *
 * It is a **volume** guard. It is not the main defence, and saying so matters: the real protection
 * is that `events.ts` fixes the six names and the exact parameter values the web may send, so the
 * worst a determined caller achieves is moving one of six known counters. An open write would have
 * let anyone forge `invoice_shared_success` — the G1 metric itself. Name validation first, volume
 * second.
 *
 * ## The honest caveat
 *
 * This map lives in one server instance's memory. On Vercel each serverless instance keeps its own,
 * so the effective ceiling is per-instance and it resets on a cold start. That stops a script
 * hammering from one address; it does not stop a distributed flood. Making it authoritative means a
 * shared store (Redis/KV) or a limiter in the backend — neither is written yet, and pretending this
 * one is stronger than it is would be worse than the gap. Written down so nobody reads a clean graph
 * as proof the door is shut.
 *
 * Nothing here is a security boundary against a direct POST to `/v2/analytics/track`, which has been
 * open to the internet since it existed and is how every phone reaches it. That is a separate
 * question and is listed as one.
 */

const WINDOW_MS = 60_000;
/** A real receiver fires at most ~3 events per page view; 20 leaves room to reload and re-read. */
const MAX_EVENTS_PER_WINDOW = 20;
/** The map is bounded so a spray of distinct addresses cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * The caller's address, from the proxy headers.
 *
 * `x-forwarded-for` is a client-controlled header everywhere except behind a proxy that overwrites
 * it — which Vercel does, appending the real peer last. Taking the FIRST hop is the convention and
 * is what a normal client sends; a caller who forges it is limiting a name they chose, which is a
 * limit they can escape. That is the same ceiling as the per-instance caveat above and is why this
 * is a volume guard, not an identity.
 */
export function callerKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** True when this caller is still under the cap; false when it has just gone over. */
export function allowEvent(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_EVENTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full after dropping everything expired: the window is short, so clearing costs one window
  // of counting and keeps the map from being a memory leak with a graph attached.
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

/** Test seam — the module keeps process-wide state, so a test must be able to start from empty. */
export function __resetRateLimitForTests() {
  buckets.clear();
}
