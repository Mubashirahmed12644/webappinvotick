// Data model for the public, no-login "Free Invoice Generator" tool.
// Everything here lives in the browser (React state + IndexedDB) until the user
// signs in to back up — no PII is sent to the server before then.
import type { DiscountType } from "@/lib/invoice-calc";

export interface FreeLineItem {
  id: string;
  description: string;
  // Kept as strings so inputs stay controlled and empty-able; math coerces.
  quantity: string;
  rate: string;
}

export type InvoiceOrigin = "typed" | "sample" | "sample_edited";

export interface FreeInvoice {
  id: string; // stable UUID assigned at creation — the dedup key for later sync
  // Your business
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  businessPhone: string;
  logoDataUrl: string | null; // client-side data URL (<=2MB), never uploaded pre-signup
  // Invoice meta
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;
  paymentTerms: string;
  poNumber: string;
  // Bill To
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  // Ship To (optional)
  shipTo: string;
  // Line items (per-item is just qty x rate; tax/discount are invoice-level)
  items: FreeLineItem[];
  // Adjustments (all optional)
  taxRate: string; // percentage
  discountValue: string;
  discountType: DiscountType;
  shippingCost: string;
  // Free text
  notes: string;
  terms: string;
  // Presentation
  currency: string;
  color: string; // theme color used by the live preview
  // Template (design): header image + theme. "simple" = solid color, no header.
  templateId: string;
  headerImage: string | null; // /system-assets/header_N.png, or null for simple
  titleColor: string | null; // optional override for the "Invoice" title color
  // Where the content came from, for the G1 question: is this the person's own invoice, or ours?
  // "✨ Surprise me" fills a whole invoice with our sample business, client and line items in one
  // press, and that draft can reach the PDF without a character being typed. `typed` on creation,
  // `sample` from Surprise me, and `sample_edited` the first time a content field of a sample draft
  // is changed — a one-way move, because our words may still be in the rest of it.
  //
  // Optional because a draft saved in this browser before it existed has none, and a draft with no
  // origin is reported as unknown, never as `typed` (AGENTS-EVENTS.md §1.7). Local only: the backup
  // sync maps named fields, so this never leaves the browser.
  origin?: InvoiceOrigin;
  // Bookkeeping
  createdAt: number;
  updatedAt: number;
  isSynced?: boolean; // true once pushed to the user's account (post-signup)
}

export const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AUD", "CAD", "AED"] as const;
