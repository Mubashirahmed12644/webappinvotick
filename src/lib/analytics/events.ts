/**
 * The event contract for the public `/i/{token}` share page — the ONE place the names and the
 * parameter values are written down.
 *
 * Read `AGENTS-EVENTS.md` before changing anything here. Decision
 * `docs/decisions/0045-the-share-link-page-reports-its-own-journey.md` records why each name is what
 * it is and what was rejected.
 *
 * Three properties this module exists to hold:
 *
 * 1. **The web may only send these six names.** The route validates against this list, so the worst
 *    a spoofer can do is move one of six known counters — never write an arbitrary row into
 *    `analytics_events`. Volume is the smaller problem; an open write of any event name would let
 *    anyone forge `invoice_shared_success`, which is the G1 metric itself.
 * 2. **Unknown parameters are dropped, not stored.** A key that is not in the schema below never
 *    reaches the backend.
 * 3. **An absent parameter means unknown** (`AGENTS-EVENTS.md` §1.7). Nothing here fills a gap with
 *    a default; a value we could not observe is simply not sent.
 */

/** Where the event came from. Stamped server-side on every event this surface sends. */
export const WEB_SURFACE = "web_share_link";

export const WEB_EVENT_NAMES = [
  // New. The web twin of the app's `shared_invoice_opened`, which it deliberately does NOT reuse:
  // the app fires that one only AFTER routing senders away to their own invoice, so its rows are
  // receivers-only. This page cannot tell the two apart, so the same name would put two different
  // populations under one id (§1.4).
  "shared_invoice_page_view",
  // Existing names, same action on another surface (§1.1 — the surface is a parameter, not a new
  // name). Both fire on the backend's CONFIRMATION, matching `ReceivedInvoiceViewModel.decide`:
  // firing one on the click and the other on success would make the count mean two things.
  "shared_invoice_approved",
  "shared_invoice_rejected",
  "shared_invoice_decision_failed",
  // Existing name. The app fires it on the click, before navigating; so does this page.
  "shared_invoice_create_own_click",
  // New. Getting the document is not the same action as wanting your own copy of the product.
  "shared_invoice_pdf_click",
] as const;

export type WebEventName = (typeof WEB_EVENT_NAMES)[number];

/**
 * What the page found behind the token.
 *
 * These are the four answers the web can actually observe, and no more. The backend answers 410 GONE
 * for a revoked link AND for an expired one (`SharedInvoice.isViewable()`), so `revoked` and
 * `expired` are NOT separable from here — naming them would be fiction that nobody could later
 * catch (§1.15). `gone` is what was seen. `fetch_failed` is the read itself failing, which is a
 * different fact from the link being dead and must not be counted as one.
 */
export const LINK_STATES = ["active", "not_found", "gone", "fetch_failed"] as const;
export type LinkState = (typeof LINK_STATES)[number];

/**
 * Where a CTA sends the receiver.
 *
 * One parameter name across both CTA events, with a value space that does not overlap — `play_store`
 * means the same thing on either (§1.15). "Install Invotick" and "Create yours" are one slot on the
 * page holding one intent (get your own Invotick) down two routes, so they are one event with this
 * as the variation, not two names.
 */
export const CTA_DESTINATIONS = ["play_store", "web_app", "print_dialog"] as const;
export type CtaDestination = (typeof CTA_DESTINATIONS)[number];

export const DECISIONS = ["APPROVED", "REJECTED"] as const;

/** `has_note` as the app sends it — a boolean's string form, so both surfaces share one code space. */
export const HAS_NOTE = ["true", "false"] as const;
export type DecisionValue = (typeof DECISIONS)[number];

/**
 * The parameters each event may carry, beyond the two the server stamps on all of them
 * (`surface`, `viewer_platform`).
 *
 * `http_status` — NOT `status`. The app already sends `status` on `shared_invoice_opened` meaning
 * the approval state (`PENDING|APPROVED|REJECTED`), so an HTTP code under that key would be two
 * code spaces in one parameter name — the exact defect §1.15 was written for.
 */
type ParamRule =
  | { kind: "enum"; values: readonly string[]; required: boolean }
  | { kind: "http_status"; required: boolean };

const PARAM_SCHEMA: Record<WebEventName, Record<string, ParamRule>> = {
  shared_invoice_page_view: {
    link_state: { kind: "enum", values: LINK_STATES, required: true },
    // Present only when the read got an HTTP answer at all. This is what stops `fetch_failed` from
    // becoming a permanent "unknown" row — the mandate is that unknown shrinks release by release.
    http_status: { kind: "http_status", required: false },
  },
  // Whether the receiver wrote anything to the sender. The note itself goes to the backend with the
  // decision and never into analytics: a receiver's words are not a metric. Declared here because
  // this route answers an undeclared parameter with a 400, so an unlisted `has_note` would have
  // dropped the approval event itself.
  shared_invoice_approved: { has_note: { kind: "enum", values: HAS_NOTE, required: false } },
  shared_invoice_rejected: { has_note: { kind: "enum", values: HAS_NOTE, required: false } },
  shared_invoice_decision_failed: {
    decision: { kind: "enum", values: DECISIONS, required: true },
    // "The link was already decided" (409) and "our backend was down" (5xx) are two different
    // buckets for the same receiver-side outcome, and only this separates them.
    http_status: { kind: "http_status", required: false },
  },
  shared_invoice_create_own_click: {
    destination: { kind: "enum", values: ["play_store", "web_app"], required: true },
  },
  shared_invoice_pdf_click: {
    destination: { kind: "enum", values: ["play_store", "print_dialog"], required: true },
  },
};

export function isWebEventName(value: unknown): value is WebEventName {
  return typeof value === "string" && (WEB_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Keep only what the schema allows, and refuse the event outright when a required parameter is
 * missing or wrong.
 *
 * Refusing rather than storing a partial row is deliberate: a `shared_invoice_page_view` with no
 * `link_state` would land in the table looking exactly like a page view we simply forgot to
 * classify, and it would sit in the unknown bucket for ever. A row that never arrives is visible as
 * a gap; a row that arrives half-formed is not.
 */
export function sanitiseParams(
  name: WebEventName,
  raw: unknown,
): Record<string, string | number> | null {
  const schema = PARAM_SCHEMA[name];
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string | number> = {};

  for (const [key, rule] of Object.entries(schema)) {
    const value = input[key];
    if (value === undefined || value === null) {
      if (rule.required) return null;
      continue;
    }
    if (rule.kind === "enum") {
      if (typeof value !== "string" || !rule.values.includes(value)) return null;
      out[key] = value;
      continue;
    }
    // http_status: a real HTTP code or nothing. A number outside the range is a client saying
    // something we cannot use, so it is dropped rather than stored as a fact.
    const asNumber = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(asNumber) || asNumber < 100 || asNumber > 599) {
      if (rule.required) return null;
      continue;
    }
    out[key] = asNumber;
  }

  return out;
}
