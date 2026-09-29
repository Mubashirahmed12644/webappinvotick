import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Persian (Farsi), written by hand (wave 2 of decision 0187). Never a machine translation.
 * Almost every Persian-language phone in our data is set to fa-IR (Iran, or Iranians abroad), a few fa-AF. The
 * document is drawn right to left (`documentDir`), with every figure, date, phone number and invoice number isolated
 * so it keeps its own left-to-right order — the Arabic machinery.
 *
 *  - **فاکتور** / **پیش‌فاکتور** (invoice / estimate): the words an Iranian shop prints. The formal tax-form title
 *    "صورتحساب فروش کالا و خدمات" is a specific official form, not what a small business calls its invoice.
 *  - **فروشنده** / **خریدار** for the two parties, as Iranian invoices head them.
 *  - **مالیات**, the generic tax, not "مالیات بر ارزش افزوده": the seller's own tax name is printed on each line.
 *  - **ردیف** for the line number, the usual heading of that column.
 *  - **Western digits** and the app's own `1,234.50`: Iranian phones default to Persian digits (۱۲۳), but none of the
 *    Persian-script records our users typed contain a Persian digit, the app computes and prints Western digits
 *    everywhere, and an invoice read abroad must show the same figure. Dates are `2026/09/29` — year first, as Iran
 *    writes a date — in the Gregorian calendar the invoice was dated in.
 */
export const FA_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "فاکتور",
  from: "فروشنده",
  billTo: "خریدار",
  invoiceDetails: "مشخصات فاکتور",
  invoiceNo: "شماره فاکتور",
  issueDate: "تاریخ صدور",
  dueDate: "تاریخ سررسید",
  poNo: "شماره سفارش خرید",
  phone: "تلفن",
  email: "ایمیل",
  colSn: "ردیف",
  colDescription: "شرح",
  colQty: "تعداد",
  colPrice: "قیمت واحد",
  colDisc: "تخفیف",
  colTax: "مالیات",
  colAmount: "مبلغ",
  subTotal: "جمع جزء",
  discount: "تخفیف",
  tax: "مالیات",
  shipping: "هزینه ارسال",
  total: "جمع کل",
  amountPaid: "مبلغ پرداخت‌شده",
  balanceDue: "مانده قابل پرداخت",
  notes: "یادداشت‌ها",
  terms: "شرایط و ضوابط",
  paymentInstructions: "دستورالعمل پرداخت",
  authorizedSignature: "امضا",
  footerGenerated: "فاکتور با Invotick ساخته شده است",
  footerTagline: "فاکتورهای حرفه‌ای را در چند ثانیه بسازید",
  footerScan: "برای دانلود Invotick اسکن کنید",
  footerContact: "تماس با ما",
};

/** Only what an estimate says differently — merged over [FA_LABELS]. */
export const FA_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "پیش‌فاکتور",
  invoiceDetails: "مشخصات پیش‌فاکتور",
  invoiceNo: "شماره پیش‌فاکتور",
  dueDate: "معتبر تا",
  footerGenerated: "پیش‌فاکتور با Invotick ساخته شده است",
};
