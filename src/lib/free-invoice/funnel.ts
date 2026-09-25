/**
 * What the free invoice tool's funnel events say about a draft — the derived facts, in one pure
 * place so they can be tested without a browser and so every reader of them agrees.
 *
 * Decision `docs/decisions/0163-the-free-invoice-tool-reports-its-own-funnel-and-offers-the-app-after-the-pdf.md`.
 * The rules these follow are in `AGENTS-EVENTS.md`; the two that shape this file:
 *
 * - **§1.14 — a name says what was seen, never why.** "Complete" here is a stated threshold, spelled
 *   out below, not a judgement about whether the invoice is any good.
 * - **§1.7 — an absent parameter means unknown.** `sourceOf` returns undefined for a draft that has
 *   no origin, and the caller leaves the key off. It is never reported as `typed`.
 */
import type { FreeInvoice, FreeLineItem, InvoiceOrigin } from "./types";

/** A line the person actually put something in: row 1 exists from the start and is not one. */
function isFilledLine(item: FreeLineItem): boolean {
  return Boolean(item.description.trim() || item.rate.trim());
}

function isPriced(item: FreeLineItem): boolean {
  return (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0) > 0;
}

/**
 * The draft holds everything an invoice needs to be sent to somebody: who it is from, who it is
 * for, and at least one line that is charging for something.
 *
 * Deliberately **not** "the preview looks right" and not "every field is filled". The preview always
 * renders — it is live from the first keystroke — so it can never be the test. This is the smallest
 * set without which the document is not an invoice at all, and it is the same set on every reading.
 *
 * A "Surprise me" draft passes it the instant it is created. That is correct and is why the event
 * carries `source`: the step counts drafts that reached invoice shape, and `source` says whose words
 * they are.
 */
export function isComplete(inv: FreeInvoice): boolean {
  return Boolean(
    inv.businessName.trim() && inv.clientName.trim() && inv.items.some((it) => it.description.trim() && isPriced(it)),
  );
}

/**
 * Where the content came from, or undefined when this browser cannot say.
 *
 * Undefined happens for a draft saved before the origin field existed. Those are the only rows that
 * will ever be missing it, and they stop appearing as this session's drafts age out.
 */
export function sourceOf(inv: FreeInvoice): InvoiceOrigin | undefined {
  return inv.origin;
}

/** The optional fields, counted rather than named — see the schema note in `events.ts`. */
const OPTIONAL_FIELDS: Array<keyof FreeInvoice> = [
  "businessEmail",
  "businessPhone",
  "businessAddress",
  "clientEmail",
  "clientAddress",
  "shipTo",
  "poNumber",
  "notes",
  "terms",
];

/**
 * The parameters `free_invoice_completed` carries.
 *
 * These are the app's lost `optional_fields_filled` / `has_logo` / `has_discount` parameters, put
 * back on the one surface that can still see them (AGENTS.md §5b). Booleans are strings because the
 * app sends them that way and both clients share one code space (§1.15).
 */
export function completionParams(inv: FreeInvoice): Record<string, string | number> {
  const source = sourceOf(inv);
  return {
    ...(source ? { source } : {}),
    items: inv.items.filter(isFilledLine).length,
    has_logo: inv.logoDataUrl ? "true" : "false",
    // Only alongside a logo that exists, and only when this browser knows which kind it is. A
    // draft stored before the field existed carries no answer, and inventing one would report a
    // file somebody chose as a mark we made.
    ...(inv.logoDataUrl && inv.logoSource ? { logo_source: inv.logoSource } : {}),
    // The trade, only when one was picked. It is a join-free answer to "which trades finish an
    // invoice"; a draft from before the onboarding has none, and none is never guessed at.
    ...(inv.industry ? { industry: inv.industry } : {}),
    has_tax: (parseFloat(inv.taxRate) || 0) > 0 ? "true" : "false",
    has_discount: (parseFloat(inv.discountValue) || 0) > 0 ? "true" : "false",
    optional_fields: OPTIONAL_FIELDS.filter((k) => String(inv[k] ?? "").trim()).length,
  };
}

/**
 * The fields whose change means the person put something of their own into the draft.
 *
 * A template, a colour, a currency and the invoice number are ours or automatic, so changing one
 * does not move a sample draft to `sample_edited` — that would report our own sample as half-theirs
 * the moment somebody clicked a different header design.
 */
const CONTENT_FIELDS = new Set<keyof FreeInvoice>([
  "businessName",
  "businessEmail",
  "businessPhone",
  "businessAddress",
  "logoDataUrl",
  "clientName",
  "clientEmail",
  "clientAddress",
  "shipTo",
  "items",
  "taxRate",
  "discountValue",
  "shippingCost",
  "notes",
  "terms",
  "poNumber",
  "dueDate",
  "issueDate",
  "paymentTerms",
]);

export function touchesContent(patch: Partial<FreeInvoice>): boolean {
  return Object.keys(patch).some((k) => CONTENT_FIELDS.has(k as keyof FreeInvoice));
}

/**
 * The origin a draft has after this edit: `sample` becomes `sample_edited`, everything else stays.
 *
 * One way only. A person who deletes our sample client and types their own still has our notes, our
 * terms and possibly our line items, and no code here can tell which — so the draft never goes back
 * to being `typed`, and `sample_edited` says exactly that much and no more.
 */
export function originAfterEdit(origin: InvoiceOrigin | undefined): InvoiceOrigin | undefined {
  return origin === "sample" ? "sample_edited" : origin;
}
