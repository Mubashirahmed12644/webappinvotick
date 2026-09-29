import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Simplified Chinese, written by hand (wave 2 of decision 0187). Never a machine translation.
 * Kept at the owner's request although few phones use it (mainland China and Taiwan; Traditional-script phones read
 * the Simplified set).
 *
 *  - **发票** / **报价单** (invoice / estimate). In mainland China a 发票 is also the official tax receipt (增值税发票)
 *    printed through the tax system; this document is a commercial invoice, the first native-check question.
 *  - **销售方** / **购买方** for the two parties, the headings of a Chinese invoice.
 *  - **税额** for the tax, not 增值税: the seller's own tax name is printed on each line.
 *  - **应付余额** for the balance due, **已付金额** for the amount paid, **合计** for the total.
 *
 * Figures keep the app's own `¥1,234.50`, the way Chinese writes them. Dates are `2026年9月29日`.
 */
export const ZH_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "发票",
  from: "销售方",
  billTo: "购买方",
  invoiceDetails: "发票详情",
  invoiceNo: "发票编号",
  issueDate: "开票日期",
  dueDate: "到期日",
  poNo: "采购订单号",
  phone: "电话",
  email: "邮箱",
  colSn: "序号",
  colDescription: "项目描述",
  colQty: "数量",
  colPrice: "单价",
  colDisc: "折扣",
  colTax: "税额",
  colAmount: "金额",
  subTotal: "小计",
  discount: "折扣",
  tax: "税额",
  shipping: "运费",
  total: "合计",
  amountPaid: "已付金额",
  balanceDue: "应付余额",
  notes: "备注",
  terms: "条款和条件",
  paymentInstructions: "付款说明",
  authorizedSignature: "授权签名",
  footerGenerated: "本发票由 Invotick 生成",
  footerTagline: "几秒钟即可创建专业发票",
  footerScan: "扫码下载 Invotick",
  footerContact: "联系我们",
};

/** Only what an estimate says differently — merged over [ZH_LABELS]. */
export const ZH_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "报价单",
  invoiceDetails: "报价单详情",
  invoiceNo: "报价单编号",
  dueDate: "有效期至",
  footerGenerated: "本报价单由 Invotick 生成",
};
