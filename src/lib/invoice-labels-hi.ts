import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Hindi, written by hand (wave 2 of decision 0187). Never a machine translation.
 *
 * Everyday business Hindi, as an Indian shop writes its bill (the Hindi phones in our data are in India):
 *
 *  - **बिल** for invoice — what a shopkeeper and his customer call it. The machine row said "चालान", which in India is
 *    as often a delivery challan or a traffic fine. **कोटेशन** for an estimate (not "अनुमान", a guess).
 *  - **टैक्स**, the generic word: the seller's own tax name (GST, IGST …) is printed on each line, and not every seller
 *    is GST-registered, so the document does not say "GST" by itself (a native-check question).
 *  - **विक्रेता** / **ग्राहक** for the two parties, **दर** for a line's rate (the column Indian bills print), and the
 *    English loanwords users already say: सबटोटल, शिपिंग, नोट्स.
 *  - Figures stay the app's own `1,234.50` (Western digits; not the lakh grouping `1,23,456` — a native-check
 *    question), and dates are numeric day-first, `29/09/2026`, as Indian bills write them.
 *
 * Keys are exactly `InvoiceLabels` minus the French-only `totalWithTax`.
 */
export const HI_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "बिल",
  from: "विक्रेता",
  billTo: "ग्राहक",
  invoiceDetails: "बिल का विवरण",
  invoiceNo: "बिल नं.",
  issueDate: "जारी तिथि",
  dueDate: "देय तिथि",
  poNo: "PO नं.",
  phone: "फ़ोन",
  email: "ईमेल",
  colSn: "क्र.सं.",
  colDescription: "विवरण",
  colQty: "मात्रा",
  colPrice: "दर",
  colDisc: "छूट",
  colTax: "टैक्स",
  colAmount: "राशि",
  subTotal: "सबटोटल",
  discount: "छूट",
  tax: "टैक्स",
  shipping: "शिपिंग",
  total: "कुल",
  amountPaid: "भुगतान की गई राशि",
  balanceDue: "बकाया राशि",
  notes: "नोट्स",
  terms: "नियम और शर्तें",
  paymentInstructions: "भुगतान के निर्देश",
  authorizedSignature: "हस्ताक्षर",
  footerGenerated: "Invotick से बनाया गया बिल",
  footerTagline: "सेकंडों में प्रोफ़ेशनल बिल बनाएं",
  footerScan: "Invotick डाउनलोड करने के लिए स्कैन करें",
  footerContact: "संपर्क करें",
};

/** Only what an estimate says differently — merged over [HI_LABELS]. */
export const HI_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "कोटेशन",
  invoiceDetails: "कोटेशन का विवरण",
  invoiceNo: "कोटेशन नं.",
  dueDate: "मान्य तिथि तक",
  footerGenerated: "Invotick से बनाया गया कोटेशन",
};
