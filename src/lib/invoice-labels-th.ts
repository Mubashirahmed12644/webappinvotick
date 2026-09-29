import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Thai, written by hand (wave 2 of decision 0187). Never a machine translation.
 *
 * As a Thai small business prints its documents (Thailand, and Thai readers in Laos):
 *
 *  - **ใบแจ้งหนี้** for invoice, **ใบเสนอราคา** for an estimate, and **ยืนราคาถึง** ("price held until") for its validity,
 *    the phrase Thai quotations use — the machine row said "ประมาณการ", a forecast.
 *  - **เลขที่** for the document number and **วันที่** for its date, the two words at the top of every Thai invoice.
 *  - **ภาษี**, the generic tax, not "ภาษีมูลค่าเพิ่ม": the seller's own tax name (VAT 7% …) is printed on each line, and not
 *    every seller is VAT-registered (a native-check question).
 *  - **รวมเป็นเงิน** / **รวมทั้งสิ้น** for subtotal / total, **ยอดค้างชำระ** for the balance due.
 *  - Figures stay the app's own `1,234.50` with Western digits; dates are `29 ก.ย. 2026` — the Gregorian year, not the
 *    Buddhist Era (2569) many Thai documents print (the first native-check question).
 *
 * Keys are exactly `InvoiceLabels` minus the French-only `totalWithTax`.
 */
export const TH_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "ใบแจ้งหนี้",
  from: "ผู้ขาย",
  billTo: "ลูกค้า",
  invoiceDetails: "รายละเอียดใบแจ้งหนี้",
  invoiceNo: "เลขที่",
  issueDate: "วันที่",
  dueDate: "วันครบกำหนด",
  poNo: "เลขที่ใบสั่งซื้อ",
  phone: "โทร.",
  email: "อีเมล",
  colSn: "ลำดับ",
  colDescription: "รายการ",
  colQty: "จำนวน",
  colPrice: "ราคาต่อหน่วย",
  colDisc: "ส่วนลด",
  colTax: "ภาษี",
  colAmount: "จำนวนเงิน",
  subTotal: "รวมเป็นเงิน",
  discount: "ส่วนลด",
  tax: "ภาษี",
  shipping: "ค่าจัดส่ง",
  total: "รวมทั้งสิ้น",
  amountPaid: "ชำระแล้ว",
  balanceDue: "ยอดค้างชำระ",
  notes: "หมายเหตุ",
  terms: "ข้อกำหนดและเงื่อนไข",
  paymentInstructions: "วิธีการชำระเงิน",
  authorizedSignature: "ลายเซ็น",
  footerGenerated: "ใบแจ้งหนี้นี้สร้างด้วย Invotick",
  footerTagline: "สร้างใบแจ้งหนี้แบบมืออาชีพในไม่กี่วินาที",
  footerScan: "สแกนเพื่อดาวน์โหลด Invotick",
  footerContact: "ติดต่อเรา",
};

/** Only what an estimate says differently — merged over [TH_LABELS]. */
export const TH_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "ใบเสนอราคา",
  invoiceDetails: "รายละเอียดใบเสนอราคา",
  invoiceNo: "เลขที่",
  dueDate: "ยืนราคาถึง",
  footerGenerated: "ใบเสนอราคานี้สร้างด้วย Invotick",
};
