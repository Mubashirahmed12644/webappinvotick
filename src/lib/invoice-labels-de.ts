import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in German, written by hand (wave 2, 2026-09-29; the method of decision 0187). Never a machine
 * translation. The readers are in Germany (17 of 26 German-language phones in 90 days); the words are the ones a
 * German small-business invoice prints, formal throughout.
 *
 *  - **Rechnung** / **Angebot** (invoice / estimate). "Kostenvoranschlag" is a trade estimate with its own rules.
 *  - **MwSt.** for the tax, in the column and the totals: what a German invoice calls its VAT ("USt." is the tax
 *    office's word; readers use MwSt.).
 *  - **ZWISCHENSUMME**, never "Netto": the subtotal is the sum of the line amounts, and a line's amount already carries
 *    its own tax (invoice-calc.ts: net = price − discount + tax). Calling it net would be false whenever a line is taxed.
 *  - **GESAMT (BRUTTO)** (`totalWithTax`) when the document carries a tax, **GESAMT** when it has none: the total
 *    includes every tax on it, and "brutto" on an invoice without tax would claim one that is not there — the same rule
 *    as the French "TOTAL TTC".
 *  - **OFFENER BETRAG** for BALANCE DUE (what is still to be paid), **BEZAHLT** for AMOUNT PAID.
 *  - **Pos.** heads the line-number column, as German invoice tables do.
 *  - Figures `1.234,50 €` (dot thousands, decimal comma, symbol after), rates `19,00 %`, dates `29.09.2026`.
 *
 * Keys are `InvoiceLabels`; `more-languages-invoice.check.tsx` fails when one is missing or English.
 */
export const DE_LABELS: Required<InvoiceLabels> = {
  invoice: "Rechnung",
  from: "Von",
  billTo: "Rechnung an",
  invoiceDetails: "Rechnungsdetails",
  invoiceNo: "Rechnungsnr.",
  issueDate: "Rechnungsdatum",
  dueDate: "Fällig am",
  poNo: "Bestellnr.",
  phone: "Telefon",
  email: "E-Mail",
  colSn: "Pos.",
  colDescription: "Beschreibung",
  colQty: "Menge",
  colPrice: "Einzelpreis",
  colDisc: "Rabatt",
  colTax: "MwSt.",
  colAmount: "Betrag",
  subTotal: "ZWISCHENSUMME",
  discount: "RABATT",
  tax: "MWST.",
  shipping: "VERSAND",
  total: "GESAMT",
  totalWithTax: "GESAMT (BRUTTO)",
  amountPaid: "BEZAHLT",
  balanceDue: "OFFENER BETRAG",
  notes: "Anmerkungen",
  terms: "Geschäftsbedingungen",
  paymentInstructions: "Zahlungshinweise",
  authorizedSignature: "Unterschrift",
  footerGenerated: "Rechnung erstellt mit Invotick",
  footerTagline: "Professionelle Rechnungen in Sekunden",
  footerScan: "Scannen, um Invotick herunterzuladen",
  footerContact: "Kontakt",
};

/** Only what an estimate says differently — merged over [DE_LABELS]. */
export const DE_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Angebot",
  billTo: "Angebot für",
  invoiceDetails: "Angebotsdetails",
  invoiceNo: "Angebotsnr.",
  issueDate: "Angebotsdatum",
  dueDate: "Gültig bis",
  footerGenerated: "Angebot erstellt mit Invotick",
};
