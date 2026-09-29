import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Turkish, written by hand (wave 2 of decision 0187). Never a machine translation. The
 * Turkish phones in our data are mostly Turks working in France and the Netherlands, so the words are the ones a
 * Turkish invoice uses, without anything only Turkey's e-Fatura rules require.
 *
 *  - **Fatura** / **Fiyat Teklifi** (invoice / estimate).
 *  - **Satıcı** / **Alıcı** for the two parties.
 *  - **KDV** for the tax: the word on a Turkish invoice, and the same tax (TVA, BTW) where these users work.
 *  - **Kalan tutar** for the balance due, **Ödenen** for the amount paid, **Vade tarihi** for the due date.
 *
 * Figures are written the Turkish way — `1.234,50 €`, full stop between thousands, decimal comma, the symbol after,
 * and a rate as `%20,00` — and read back as exactly the English number. Dates are numeric, `29.09.2026`.
 */
export const TR_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "Fatura",
  from: "Satıcı",
  billTo: "Alıcı",
  invoiceDetails: "Fatura bilgileri",
  invoiceNo: "Fatura no",
  issueDate: "Düzenleme tarihi",
  dueDate: "Vade tarihi",
  poNo: "Sipariş no",
  phone: "Telefon",
  email: "E-posta",
  colSn: "Sıra",
  colDescription: "Açıklama",
  colQty: "Miktar",
  colPrice: "Birim fiyat",
  colDisc: "İnd.",
  colTax: "KDV",
  colAmount: "Tutar",
  subTotal: "ARA TOPLAM",
  discount: "İNDİRİM",
  tax: "KDV",
  shipping: "KARGO",
  total: "TOPLAM",
  amountPaid: "ÖDENEN",
  balanceDue: "KALAN TUTAR",
  notes: "Notlar",
  terms: "Şartlar ve koşullar",
  paymentInstructions: "Ödeme bilgileri",
  authorizedSignature: "İmza",
  footerGenerated: "Fatura Invotick ile oluşturuldu",
  footerTagline: "Profesyonel faturaları saniyeler içinde oluşturun",
  footerScan: "Invotick'i indirmek için tarayın",
  footerContact: "Bize ulaşın",
};

/** Only what an estimate says differently — merged over [TR_LABELS]. */
export const TR_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Fiyat Teklifi",
  invoiceDetails: "Teklif bilgileri",
  invoiceNo: "Teklif no",
  dueDate: "Geçerlilik tarihi",
  footerGenerated: "Teklif Invotick ile oluşturuldu",
};
