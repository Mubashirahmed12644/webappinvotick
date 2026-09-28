import type { InvoiceLabels } from "./invoice-labels";

/** Every label, and the French-only `totalWithTax`, required here so none can be forgotten. */
export type FrenchLabels = Required<InvoiceLabels>;


/**
 * The invoice's labels in French, written by hand (decision 0185). Never a machine translation.
 *
 * This file is the ONE source of the French words on a document. Three places read it:
 *  - the renderer, for a document whose `language` is "fr" (`documentLabelsFor`);
 *  - the share page's language picker, when a reader picks French (`documentLabels`);
 *  - `scripts/apply-label-overrides.mjs`, which writes it over the French row of the generated table
 *    (`invoice-labels-i18n.ts`) and of the app's Kotlin copy, so the app's own picker says the same.
 *
 * The words follow the app's French glossary (decision 0185) and a French invoice's settled vocabulary.
 * Why each non-obvious one:
 *
 *  - **TVA**, not "Taxe": the tax on an invoice in France, Belgium, Switzerland and most of French-speaking
 *    Africa is TVA, and "Taxe" on a bill reads as a mistranslation.
 *  - **SOUS-TOTAL**, never "Total HT". The subtotal is the sum of the line amounts, and a line's amount
 *    already carries that line's own tax (invoice-calc.ts: net = price − discount + tax). Calling it
 *    "hors taxes" would be false whenever a line is taxed.
 *  - **TOTAL** / **TOTAL TTC** (`totalWithTax`): the total is the discounted subtotal plus the tax plus
 *    shipping, so it includes every tax on the document. "TTC" is printed only when the document carries a
 *    tax (a tax row or a taxed line). A business outside TVA (a French micro-entrepreneur, "TVA non
 *    applicable") has no tax, and "TOTAL TTC" would then claim a tax that is not there.
 *  - **RESTE À PAYER** for BALANCE DUE — the phrase on French invoices; "Solde dû" is a calque.
 *  - **Valable jusqu'au** for an estimate's date: the estimate's field is its expiry, and the reader
 *    wants to know how long the price holds.
 *  - **Devis** for an estimate, masculine: "Détails du devis", "N° de devis", "Devis créé avec Invotick".
 *  - Capitals where the English is in capitals (the totals box), sentence case elsewhere, as the English.
 *
 * Keys are exactly `InvoiceLabels`; `french-invoice.check.tsx` fails when one is missing or empty.
 */
export const FR_LABELS: FrenchLabels = {
  invoice: "Facture",
  from: "Émetteur",
  billTo: "Facturé à",
  invoiceDetails: "Détails de la facture",
  invoiceNo: "N° de facture",
  issueDate: "Date d'émission",
  dueDate: "Date d'échéance",
  poNo: "N° de commande",
  phone: "Téléphone",
  email: "E-mail",
  colSn: "N°",
  colDescription: "Description",
  colQty: "Qté",
  colPrice: "Prix unitaire",
  colDisc: "Remise",
  colTax: "TVA",
  colAmount: "Montant",
  subTotal: "SOUS-TOTAL",
  discount: "REMISE",
  tax: "TVA",
  shipping: "FRAIS DE LIVRAISON",
  total: "TOTAL",
  totalWithTax: "TOTAL TTC",
  amountPaid: "MONTANT PAYÉ",
  balanceDue: "RESTE À PAYER",
  notes: "Notes",
  terms: "Conditions générales",
  paymentInstructions: "Instructions de paiement",
  authorizedSignature: "Signature",
  footerGenerated: "Facture créée avec Invotick",
  footerTagline: "Créez des factures professionnelles en quelques secondes",
  footerScan: "Scannez pour télécharger Invotick",
  footerContact: "Contactez-nous",
};

/** Only what an estimate says differently — merged over [FR_LABELS], exactly as ESTIMATE_LABELS over LABELS. */
export const FR_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Devis",
  invoiceDetails: "Détails du devis",
  invoiceNo: "N° de devis",
  dueDate: "Valable jusqu'au",
  footerGenerated: "Devis créé avec Invotick",
};

/** The French label set for a document of this type. */
export function frenchLabelsFor(documentType?: string | null): InvoiceLabels {
  return documentType === "ESTIMATE" ? { ...FR_LABELS, ...FR_ESTIMATE_LABELS } : FR_LABELS;
}
