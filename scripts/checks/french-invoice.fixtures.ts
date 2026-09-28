/**
 * Documents used by the French-invoice check (french-invoice.check.tsx) and by the owner's A4 mockups.
 *
 * English on purpose: `language` is absent, which is what every snapshot captured before decision 0185
 * says. The check renders these as they are against a golden captured from `gitlab/main` BEFORE the French
 * work (golden/*.html), so any byte the English document changes is a failure; then it renders the same
 * documents with `language: "fr"`.
 */
import type { InvoiceRenderData } from "@/lib/data";

const business = {
  name: "Atelier Lumière",
  logo: null,
  emailAddress: "contact@atelier-lumiere.fr",
  phone: "+33 1 42 00 00 00",
  addressLine1: "12 rue des Lilas",
  addressLine2: null,
  city: "Lyon",
  country: "France",
};

const client = {
  id: "c",
  name: "Claire Martin",
  companyName: "Martin & Fils SARL",
  emailAddress: "claire@martin-fils.fr",
  phone: "+33 6 12 34 56 78",
  addressLine1: "4 place Bellecour",
  addressLine2: null,
  city: "Lyon",
  state: null,
  zipcode: null,
  country: "France",
};

const toggles = { logo: false, title: true, sender: true, receiver: true, notes: true, payment: true, terms: true, signature: false, stamp: false, total: true, items: true };

/** One page: line discounts (percentage and flat), line tax, an invoice discount, TVA, shipping, a part payment. */
export const discountAndTax: InvoiceRenderData = {
  id: "fixture-discount-tax",
  documentType: "INVOICE",
  invoiceNumber: "FAC-2026-0042",
  invoiceDate: "2026-09-29",
  dueDate: "2026-10-29",
  poNumber: "BC-7781",
  status: "SENT",
  currency: "EUR",
  subtotal: 3456.79,
  discountAmount: 172.84,
  taxAmount: 656.79,
  shippingCost: 25,
  total: 3965.74,
  amountPaid: 1000,
  balanceDue: 2965.74,
  paymentStatus: "PARTIALLY_PAID",
  notes: "Merci pour votre confiance.",
  paymentInstructions: "Virement : FR76 3000 6000 0112 3456 7890 189",
  terms: "Paiement à 30 jours.",
  color: "#0D4DC0",
  titleColor: null,
  toggles,
  business,
  client,
  headerImage: null,
  backgroundImage: null,
  backgroundOpacity: 1,
  items: [
    { sn: 1, name: "Création du logo", quantity: 1, unitPrice: 1200, discountValue: 10, discountType: "PERCENTAGE", taxRate: 0, amount: 1080 },
    { sn: 2, name: "Site vitrine (5 pages)", quantity: 1, unitPrice: 1850.5, discountValue: 50, discountType: "FLAT", taxRate: 0, amount: 1800.5 },
    { sn: 3, name: "Photographies produit", quantity: 12, unitPrice: 45.99, discountValue: 0, discountType: "PERCENTAGE", taxRate: 0, amount: 551.88 },
    { sn: 4, name: "Hébergement (mois)", quantity: 1.5, unitPrice: 16.27, discountValue: 0, discountType: "PERCENTAGE", taxRate: 0, amount: 24.41 },
  ],
} as unknown as InvoiceRenderData;

// Each line carries 20 % tax on its own amount, so the lines already hold the tax and the TAX row is zero.
const MULTI_ITEMS = Array.from({ length: 34 }, (_, i) => {
  const unitPrice = 19.5 + i * 37.25;
  const quantity = (i % 4) + 1;
  return { sn: i + 1, name: `Prestation ${i + 1}`, quantity, unitPrice, discountValue: 0, discountType: "PERCENTAGE", taxRate: 20, amount: Math.round(unitPrice * 1.2 * quantity * 100) / 100 };
});
const MULTI_TOTAL = Math.round(MULTI_ITEMS.reduce((a, it) => a + it.amount, 0) * 100) / 100;

/** Enough lines for two pages or more, in a currency with no symbol of our own (CHF). */
export const multiPage: InvoiceRenderData = {
  ...discountAndTax,
  id: "fixture-multi-page",
  invoiceNumber: "FAC-2026-0043",
  currency: "CHF",
  poNumber: null,
  items: MULTI_ITEMS,
  subtotal: MULTI_TOTAL,
  discountAmount: 0,
  taxAmount: 0,
  shippingCost: 0,
  total: MULTI_TOTAL,
  amountPaid: MULTI_TOTAL,
  balanceDue: 0,
  paymentStatus: "PAID",
} as unknown as InvoiceRenderData;

/** An estimate, with the raw symbol the app sends ("Rs") and a day-first date as the app writes it. */
export const estimate: InvoiceRenderData = {
  ...discountAndTax,
  id: "fixture-estimate",
  documentType: "ESTIMATE",
  invoiceNumber: "DEV-2026-0007",
  invoiceDate: "05/09/2026",
  dueDate: "05/10/2026",
  currency: "€",
  amountPaid: null,
  balanceDue: null,
  paymentStatus: null,
} as unknown as InvoiceRenderData;

/** No tax anywhere: a business outside TVA. Its total must not claim taxes are included. */
export const noTax: InvoiceRenderData = {
  ...discountAndTax,
  id: "fixture-no-tax",
  taxAmount: 0,
  total: 3308.95,
  balanceDue: 2308.95,
} as unknown as InvoiceRenderData;

export const FIXTURES = { discountAndTax, multiPage, estimate, noTax } as const;
