import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Arabic (Modern Standard Arabic), written by hand (decision 0187). Never a machine
 * translation. The document is drawn right to left (`documentDir`), with every figure, date, phone number and
 * invoice number isolated so it keeps its own left-to-right order.
 *
 *  - **فاتورة** / **عرض سعر** (invoice / estimate).
 *  - **الضريبة**, the generic tax, not "ضريبة القيمة المضافة": Egypt, the UAE and Algeria have VAT, but Syria, Libya
 *    and Yemen do not, and the seller's own tax name is printed on each line.
 *  - **العميل** for the client block and **المُصدِر** for the sender, as Arabic invoices head them.
 *  - **م** (مسلسل) for the line number, the usual heading of that column in Arabic tables.
 *  - Western digits and the app's own `1,234.50`: most phones in the data use them for business (the Maghreb always
 *    does), and a figure must read the same on the client's side of any border. Dates are `29/09/2026`.
 */
export const AR_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "فاتورة",
  from: "المُصدِر",
  billTo: "العميل",
  invoiceDetails: "تفاصيل الفاتورة",
  invoiceNo: "رقم الفاتورة",
  issueDate: "تاريخ الإصدار",
  dueDate: "تاريخ الاستحقاق",
  poNo: "رقم أمر الشراء",
  phone: "الهاتف",
  email: "البريد الإلكتروني",
  colSn: "م",
  colDescription: "الوصف",
  colQty: "الكمية",
  colPrice: "سعر الوحدة",
  colDisc: "الخصم",
  colTax: "الضريبة",
  colAmount: "المبلغ",
  subTotal: "المجموع الفرعي",
  discount: "الخصم",
  tax: "الضريبة",
  shipping: "الشحن",
  total: "الإجمالي",
  amountPaid: "المبلغ المدفوع",
  balanceDue: "المبلغ المستحق",
  notes: "ملاحظات",
  terms: "الشروط والأحكام",
  paymentInstructions: "تعليمات الدفع",
  authorizedSignature: "التوقيع",
  footerGenerated: "أُنشئت الفاتورة باستخدام Invotick",
  footerTagline: "أنشئ فواتير احترافية في ثوانٍ",
  footerScan: "امسح الرمز لتنزيل Invotick",
  footerContact: "تواصل معنا",
};

/** Only what an estimate says differently — merged over [AR_LABELS]. */
export const AR_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "عرض سعر",
  invoiceDetails: "تفاصيل عرض السعر",
  invoiceNo: "رقم عرض السعر",
  dueDate: "صالح حتى",
  footerGenerated: "أُنشئ عرض السعر باستخدام Invotick",
};
