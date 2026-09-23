/**
 * The event contract for the web's public pages — the ONE place the names, the surfaces and the
 * parameter values are written down.
 *
 * Two surfaces send events today: the `/i/{token}` share page (decision
 * `docs/decisions/0045-the-share-link-page-reports-its-own-journey.md`) and the free invoice tool at
 * `/` (decision `docs/decisions/0163-the-free-invoice-tool-reports-its-own-funnel-and-offers-the-app-after-the-pdf.md`).
 * Read `AGENTS-EVENTS.md` before changing anything here.
 *
 * Four properties this module exists to hold:
 *
 * 1. **The web may only send the names on this list.** The route validates against it, so the worst
 *    a spoofer can do is move one of a few known counters — never write an arbitrary row into
 *    `analytics_events`. Volume is the smaller problem; an open write of any event name would let
 *    anyone forge `invoice_shared_success`, which is the G1 metric itself.
 * 2. **Unknown parameters are dropped, not stored.** A key that is not in the schema below never
 *    reaches the backend.
 * 3. **An absent parameter means unknown** (`AGENTS-EVENTS.md` §1.7). Nothing here fills a gap with
 *    a default; a value we could not observe is simply not sent.
 * 4. **The surface is decided by the event name, here, and never taken from the browser**
 *    (§1.17 rule 4). Every name belongs to exactly one page, so the server needs nothing from the
 *    caller to stamp it — and unlike a `Referer`, a name cannot be missing. A browser that strips
 *    its `Referer` still lands in the right surface.
 */

/**
 * Where the event came from. Stamped server-side on every event, from `surfaceForEvent` below.
 *
 * The app sends no `surface` at all, so this facet reads against **NULL = unknown, not app**
 * (§1.7). `WEB_SURFACE` is kept as the share page's name because that is what 0045 shipped and what
 * every stored row since carries; renaming it would split its history (§1.8).
 */
export const WEB_SURFACE = "web_share_link";
export const FREE_TOOL_SURFACE = "web_free_tool";
export type WebSurface = typeof WEB_SURFACE | typeof FREE_TOOL_SURFACE;

export const SHARE_LINK_EVENT_NAMES = [
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

/**
 * The free invoice tool at `/` — the funnel a social ad lands in (decision 0163).
 *
 * All seven are **new names**, not the app's. The app's own activation events
 * (`business_form_text_typed`, `invoice_created_success`, …) describe a person inside the app with a
 * saved business, saved clients and an account or guest identity. This page is a stranger with a
 * browser and one throwaway draft. Reusing those names would put two populations under one id
 * (§1.4) and would raise the app's own counts the day this deploys, with nothing saying so — the
 * §1.17 rule 2 case, the same reason `shared_invoice_page_view` is not `shared_invoice_opened`.
 *
 * What they do keep from the app is the **honest meaning** of each step, and the app's shape for the
 * one it mirrors: `free_invoice_form_typed` is the web twin of `business_form_text_typed` /
 * `client_form_text_add` / `item_form_text_add` — first non-blank keystroke in the name field, once
 * per form. It proves typing started. It does **not** prove the data is real; `free_invoice_completed`
 * and `free_invoice_pdf_download` carry `source` for that.
 *
 * One name per step, and the variation is a parameter (§1.1). The app's three names for one
 * "started typing" step are a historical accident, not a pattern to copy onto a new surface.
 */
export const FREE_TOOL_EVENT_NAMES = [
  // Landed on the tool. The denominator of this whole funnel, so it carries no parameter that could
  // delay it or fail: it fires on mount, before any storage read.
  "free_invoice_page_view",
  // First non-blank keystroke in a form's NAME field, once per form per visit. `form` is which one.
  "free_invoice_form_typed",
  // The draft first held everything an invoice needs: a business name, a client name, and at least
  // one line with a description and a rate. Once per draft per visit.
  "free_invoice_completed",
  // The value moment, and the G1 signal for this surface: the person asked for the PDF and we saw
  // what happened. One row per press, `outcome` carries the result (the 0155 shape).
  "free_invoice_pdf_download",
  // The soft install offer went up, and what it was acted on with. Three actions, three names: shown
  // is ours, the click and the dismissal are theirs, and "ignored it" is the absence of both.
  "free_invoice_install_offer_shown",
  "free_invoice_install_offer_click",
  "free_invoice_install_offer_dismissed",
] as const;

export const WEB_EVENT_NAMES = [...SHARE_LINK_EVENT_NAMES, ...FREE_TOOL_EVENT_NAMES] as const;

export type WebEventName = (typeof WEB_EVENT_NAMES)[number];

/**
 * Which page an event belongs to. A `Record`, not a list membership test, so a name added without a
 * surface is a compile error rather than a row quietly filed under the share page.
 */
const EVENT_SURFACE: Record<WebEventName, WebSurface> = {
  shared_invoice_page_view: WEB_SURFACE,
  shared_invoice_approved: WEB_SURFACE,
  shared_invoice_rejected: WEB_SURFACE,
  shared_invoice_decision_failed: WEB_SURFACE,
  shared_invoice_create_own_click: WEB_SURFACE,
  shared_invoice_pdf_click: WEB_SURFACE,
  free_invoice_page_view: FREE_TOOL_SURFACE,
  free_invoice_form_typed: FREE_TOOL_SURFACE,
  free_invoice_completed: FREE_TOOL_SURFACE,
  free_invoice_pdf_download: FREE_TOOL_SURFACE,
  free_invoice_install_offer_shown: FREE_TOOL_SURFACE,
  free_invoice_install_offer_click: FREE_TOOL_SURFACE,
  free_invoice_install_offer_dismissed: FREE_TOOL_SURFACE,
};

export function surfaceForEvent(name: WebEventName): WebSurface {
  return EVENT_SURFACE[name];
}

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

/* ---------------- the free invoice tool's value spaces (decision 0163) ---------------- */

/**
 * Which form the first keystroke was in.
 *
 * One event with this as the variation, not three names (§1.1). The app has three
 * (`business_form_text_typed`, `client_form_text_add`, `item_form_text_add`) because they were added
 * separately over time; every query that wants "did they start typing at all" has to OR them
 * together, and the first one anybody forgets lowers the number in silence.
 */
export const TYPED_FORMS = ["business", "client", "item"] as const;

/**
 * Where the draft's content came from — the G1 question on this surface, and the one thing the app
 * never has to ask.
 *
 * AGENTS.md §1: *"An invoice made of our placeholder data is not activation."* Nothing is prefilled
 * anywhere in the app, so there the enemy is throwaway data. Here "✨ Surprise me" fills a whole
 * invoice with OUR sample business, OUR client and OUR line items in one press, and that draft can
 * reach the PDF without the person typing a character. Without this parameter a downloaded sample
 * and a downloaded real invoice are one number.
 *
 * - `typed` — the draft was started empty. Every character in it was typed here.
 * - `sample` — the draft came from "Surprise me" and no content field has been edited since.
 * - `sample_edited` — a sample draft that has since been edited. It is **not** `typed`: some of our
 *   words may still be in it, and this says exactly that rather than guessing which.
 *
 * Absent means unknown (§1.7) — a draft saved in this browser before 0163 shipped carries no origin,
 * and is never reported as `typed`.
 */
export const INVOICE_SOURCES = ["typed", "sample", "sample_edited"] as const;

/** What the browser did with the PDF request. `saved` is `jsPDF.save` returning, nothing more. */
export const PDF_OUTCOMES = ["saved", "failed"] as const;

/**
 * What put the install offer on screen.
 *
 * One value today, and that is worth saying out loud: a parameter with one value attributes nothing
 * (§1.15's corollary about a constant `placement`). It is here because the offer's trigger is the
 * first thing the planned A/B moves, and a second value then joins an existing key instead of
 * needing a new one.
 */
export const OFFER_TRIGGERS = ["pdf_downloaded"] as const;

/**
 * Where the offer's button sends them.
 *
 * `app_store` is declared and **nothing renders it today**: there is no Invotick listing on the App
 * Store (checked 2026-09-23 — `itunes.apple.com/lookup` returns `resultCount: 0` for both
 * `id=6757918977` and `bundleId=invotick.invoicemaker`), and offering a dead link is worse than
 * offering nothing. It is written down so the day the listing exists is a one-line change in
 * `InstallOffer.tsx` and not a change to the event contract.
 *
 * `web_account` is NOT the share page's `web_app`. That one means "go to the free tool"; this one
 * means "sign up so these invoices survive this browser", which is a different destination — one
 * parameter name, one code space (§1.15).
 */
export const OFFER_DESTINATIONS = ["play_store", "app_store", "web_account"] as const;

/**
 * How the offer was closed.
 *
 * The ✕ and "Not now" are the same action with a different control (§1.1, decision 0023). Ignoring
 * the offer produces no row at all, and that is correct: it is the absence of both a click and a
 * dismissal, against a `free_invoice_install_offer_shown` that is always there to divide by.
 */
export const OFFER_DISMISS_METHODS = ["close_button", "not_now"] as const;

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
  | { kind: "http_status"; required: boolean }
  /** A non-negative whole number, capped. Anything above the cap is a client we cannot use. */
  | { kind: "count"; max: number; required: boolean }
  /**
   * A bare identifier — today only `exception_class`, which on the web is `Error.name`.
   *
   * Free text from the browser never reaches the backend: a message can carry a business name, a
   * client name or a file path, and this page's whole promise is that what is typed here stays in
   * the browser. The name of the error class is a closed-enough vocabulary to count and carries
   * nothing of the person's (§1.22 allows the vendor's sentence beside the word — here there is no
   * vendor and no sentence worth the risk).
   */
  | { kind: "identifier"; required: boolean };

/** A boolean as the app sends one, so both clients share one code space (§1.15). */
const BOOLEAN_VALUES = ["true", "false"] as const;

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

  /* ---------------- the free invoice tool (decision 0163) ---------------- */

  // No parameters at all, deliberately. This is the denominator of the funnel, so nothing it
  // carries may be able to delay it, fail its schema, or drop the row. `surface` and
  // `viewer_platform` are stamped server-side and are enough to split it.
  free_invoice_page_view: {},

  free_invoice_form_typed: {
    form: { kind: "enum", values: TYPED_FORMS, required: true },
  },

  // The four `has_*` / `optional_fields` keys are the app's LOST parameters, put back on the one
  // surface that can still see them. AGENTS.md §5b: `optional_fields_filled`, `has_logo`,
  // `has_description` and `has_discount` went with the coded calls deleted in 1.4.3, so "nothing in
  // the app now separates real data from the minimum that clears validation — the G1 question", and
  // the fix is parameters on a surviving event (§1.1), which is what these are.
  free_invoice_completed: {
    source: { kind: "enum", values: INVOICE_SOURCES, required: false },
    // Lines carrying a description or a rate — not the row count, which is never below 1.
    items: { kind: "count", max: 200, required: true },
    has_logo: { kind: "enum", values: BOOLEAN_VALUES, required: true },
    has_tax: { kind: "enum", values: BOOLEAN_VALUES, required: true },
    has_discount: { kind: "enum", values: BOOLEAN_VALUES, required: true },
    // How many of the optional fields carry anything: the two addresses, the business email and
    // phone, the client email, ship-to, PO number, notes and terms. A count, because which ones
    // were filled has never changed a decision and nine more keys on every row would.
    optional_fields: { kind: "count", max: 9, required: true },
  },

  free_invoice_pdf_download: {
    outcome: { kind: "enum", values: PDF_OUTCOMES, required: true },
    // On the G1 row itself, so "how many real invoices came off this page" is one query and not a
    // join back to `free_invoice_completed`.
    source: { kind: "enum", values: INVOICE_SOURCES, required: false },
    // `failed` only. Absent on `saved`, where it is not applicable rather than unknown.
    exception_class: { kind: "identifier", required: false },
  },

  free_invoice_install_offer_shown: {
    trigger: { kind: "enum", values: OFFER_TRIGGERS, required: true },
  },
  free_invoice_install_offer_click: {
    destination: { kind: "enum", values: OFFER_DESTINATIONS, required: true },
  },
  free_invoice_install_offer_dismissed: {
    method: { kind: "enum", values: OFFER_DISMISS_METHODS, required: true },
  },
};

/** `Error.name` and nothing else: a bare identifier, no spaces, no punctuation, no sentence. */
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

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
    if (rule.kind === "identifier") {
      // A bare class name and nothing else. Anything with a space, a slash or a quote in it is
      // free text wearing an identifier's key, and free text from this page is never stored.
      if (typeof value !== "string" || !IDENTIFIER_RE.test(value)) {
        if (rule.required) return null;
        continue;
      }
      out[key] = value;
      continue;
    }
    const asNumber = typeof value === "number" ? value : Number(value);
    if (rule.kind === "count") {
      if (!Number.isInteger(asNumber) || asNumber < 0 || asNumber > rule.max) {
        if (rule.required) return null;
        continue;
      }
      out[key] = asNumber;
      continue;
    }
    // http_status: a real HTTP code or nothing. A number outside the range is a client saying
    // something we cannot use, so it is dropped rather than stored as a fact.
    if (!Number.isInteger(asNumber) || asNumber < 100 || asNumber > 599) {
      if (rule.required) return null;
      continue;
    }
    out[key] = asNumber;
  }

  return out;
}
