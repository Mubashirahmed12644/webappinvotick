import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Swedish, written by hand (wave 2, 2026-09-29; the method of decision 0187). Never a machine
 * translation. The readers are in Sweden (18 of 22 Swedish-language phones in 90 days); the words are the ones a
 * Swedish invoice prints.
 *
 *  - **Faktura** / **Offert** (invoice / estimate).
 *  - **Moms** for the tax, in the column and the totals.
 *  - **TOTALT INKL. MOMS** (`totalWithTax`) when the document carries a tax, **TOTALT** when it has none: the total
 *    includes every tax on it; "inkl. moms" without a tax would claim one that is not there.
 *  - **DELSUMMA**, never "exkl. moms": a line's amount already carries its own tax.
 *  - **ATT BETALA** for BALANCE DUE, **BETALT** for AMOUNT PAID; **À-pris** heads the unit price, as Swedish invoice
 *    tables do.
 *  - Figures `1 234,50 kr` (no-break space thousands, decimal comma, symbol after), rates `25,00 %`, dates in the
 *    Swedish standard `2026-09-29`.
 *
 * Keys are `InvoiceLabels`; `more-languages-invoice.check.tsx` fails when one is missing or English.
 */
export const SV_LABELS: Required<InvoiceLabels> = {
  invoice: "Faktura",
  from: "Från",
  billTo: "Kund",
  invoiceDetails: "Fakturauppgifter",
  invoiceNo: "Fakturanr",
  issueDate: "Fakturadatum",
  dueDate: "Förfallodatum",
  poNo: "Ordernr",
  phone: "Telefon",
  email: "E-post",
  colSn: "Nr",
  colDescription: "Beskrivning",
  colQty: "Antal",
  colPrice: "À-pris",
  colDisc: "Rabatt",
  colTax: "Moms",
  colAmount: "Belopp",
  subTotal: "DELSUMMA",
  discount: "RABATT",
  tax: "MOMS",
  shipping: "FRAKT",
  total: "TOTALT",
  totalWithTax: "TOTALT INKL. MOMS",
  amountPaid: "BETALT",
  balanceDue: "ATT BETALA",
  notes: "Anteckningar",
  terms: "Villkor",
  paymentInstructions: "Betalningsinformation",
  authorizedSignature: "Underskrift",
  footerGenerated: "Faktura skapad med Invotick",
  footerTagline: "Skapa professionella fakturor på några sekunder",
  footerScan: "Skanna för att ladda ner Invotick",
  footerContact: "Kontakta oss",
};

/** Only what an estimate says differently — merged over [SV_LABELS]. */
export const SV_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Offert",
  invoiceDetails: "Offertuppgifter",
  invoiceNo: "Offertnr",
  issueDate: "Offertdatum",
  dueDate: "Giltig till",
  footerGenerated: "Offert skapad med Invotick",
};
