import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Polish, written by hand (wave 2 of decision 0187). Never a machine translation. The Polish
 * phones in our data are Poles working in Germany, the UK and Portugal, so the words are the ones a Polish invoice
 * uses, without anything only Poland's own tax rules require.
 *
 *  - **Faktura** / **Wycena** (invoice / estimate). "Oferta" also means a job or marketing offer; "Faktura proforma"
 *    is a different document. The first native-check question.
 *  - **Sprzedawca** / **Nabywca** for the two parties, as every Polish invoice heads them.
 *  - **VAT** for the tax: the word on a Polish invoice, and the same tax in Germany and the UK where these users work.
 *  - **Lp.** for the line number and **Wartość** for a line's amount.
 *  - **DO ZAPŁATY** for the balance due, **ZAPŁACONO** for the amount paid.
 *  - **SUMA CZĘŚCIOWA**, not "RAZEM NETTO": a line's amount already carries its tax, so the subtotal is not a net
 *    figure.
 *
 * Figures are written the Polish way — `1 234,50 zł`: no-break space between thousands, decimal comma, the symbol
 * after — and read back as exactly the English number. Dates are numeric, `29.09.2026`, as Polish invoices print them.
 */
export const PL_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "Faktura",
  from: "Sprzedawca",
  billTo: "Nabywca",
  invoiceDetails: "Szczegóły faktury",
  invoiceNo: "Nr faktury",
  issueDate: "Data wystawienia",
  dueDate: "Termin płatności",
  poNo: "Nr zamówienia",
  phone: "Telefon",
  email: "E-mail",
  colSn: "Lp.",
  colDescription: "Opis",
  colQty: "Ilość",
  colPrice: "Cena jedn.",
  colDisc: "Rabat",
  colTax: "VAT",
  colAmount: "Wartość",
  subTotal: "SUMA CZĘŚCIOWA",
  discount: "RABAT",
  tax: "VAT",
  shipping: "WYSYŁKA",
  total: "RAZEM",
  amountPaid: "ZAPŁACONO",
  balanceDue: "DO ZAPŁATY",
  notes: "Uwagi",
  terms: "Warunki",
  paymentInstructions: "Informacje o płatności",
  authorizedSignature: "Podpis",
  footerGenerated: "Faktura wystawiona w Invotick",
  footerTagline: "Twórz profesjonalne faktury w kilka sekund",
  footerScan: "Zeskanuj, aby pobrać Invotick",
  footerContact: "Kontakt",
};

/** Only what an estimate says differently — merged over [PL_LABELS]. */
export const PL_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Wycena",
  invoiceDetails: "Szczegóły wyceny",
  invoiceNo: "Nr wyceny",
  dueDate: "Ważna do",
  footerGenerated: "Wycena przygotowana w Invotick",
};
