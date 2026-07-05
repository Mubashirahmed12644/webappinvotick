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
  // Bookkeeping
  createdAt: number;
  updatedAt: number;
  isSynced?: boolean; // true once pushed to the user's account (post-signup)
}

export const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AUD", "CAD", "AED"] as const;
