import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Dutch, written by hand (wave 2, 2026-09-29; the method of decision 0187). Never a machine
 * translation. The readers are in the Netherlands (12 of 23 Dutch-language phones in 90 days) and Suriname (7); both
 * write standard Dutch and both have BTW (Suriname since 2023).
 *
 *  - **Factuur** / **Offerte** (invoice / estimate).
 *  - **BTW** for the tax, in the column and the totals (lower case "btw" in running text, per the Taalunie).
 *  - **TOTAAL INCL. BTW** (`totalWithTax`) when the document carries a tax, **TOTAAL** when it has none: the total
 *    includes every tax on it; "incl. btw" on a document without tax would claim one that is not there.
 *  - **SUBTOTAAL**, never "excl. btw": a line's amount already carries its own tax.
 *  - **TE BETALEN** for BALANCE DUE, **BETAALD** for AMOUNT PAID.
 *  - Figures `€ 1.234,50` (symbol first with a space, dot thousands, decimal comma), rates `21,00%`,
 *    dates `29 sep. 2026`.
 *
 * Keys are `InvoiceLabels`; `more-languages-invoice.check.tsx` fails when one is missing or English.
 */
export const NL_LABELS: Required<InvoiceLabels> = {
  invoice: "Factuur",
  from: "Van",
  billTo: "Factuur aan",
  invoiceDetails: "Factuurgegevens",
  invoiceNo: "Factuurnr.",
  issueDate: "Factuurdatum",
  dueDate: "Vervaldatum",
  poNo: "Ordernr.",
  phone: "Telefoon",
  email: "E-mail",
  colSn: "Nr.",
  colDescription: "Omschrijving",
  colQty: "Aantal",
  colPrice: "Stukprijs",
  colDisc: "Korting",
  colTax: "Btw",
  colAmount: "Bedrag",
  subTotal: "SUBTOTAAL",
  discount: "KORTING",
  tax: "BTW",
  shipping: "VERZENDKOSTEN",
  total: "TOTAAL",
  totalWithTax: "TOTAAL INCL. BTW",
  amountPaid: "BETAALD",
  balanceDue: "TE BETALEN",
  notes: "Opmerkingen",
  terms: "Voorwaarden",
  paymentInstructions: "Betaalinstructies",
  authorizedSignature: "Handtekening",
  footerGenerated: "Factuur gemaakt met Invotick",
  footerTagline: "Maak professionele facturen in enkele seconden",
  footerScan: "Scan om Invotick te downloaden",
  footerContact: "Contact",
};

/** Only what an estimate says differently — merged over [NL_LABELS]. */
export const NL_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Offerte",
  billTo: "Offerte voor",
  invoiceDetails: "Offertegegevens",
  invoiceNo: "Offertenr.",
  issueDate: "Offertedatum",
  dueDate: "Geldig tot",
  footerGenerated: "Offerte gemaakt met Invotick",
};
