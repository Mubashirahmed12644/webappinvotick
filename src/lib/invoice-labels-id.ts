import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Indonesian, written by hand (wave 2, 2026-09-29; the method of decision 0187). Never a
 * machine translation. The readers are in Indonesia and Timor-Leste in about equal numbers (20 and 19 phones in 90
 * days), so the words are the standard ones both read, with "Anda" and no slang.
 *
 *  - **Faktur** / **Penawaran Harga** (invoice / estimate): "faktur" is the KBBI word printed on Indonesian invoices;
 *    a quotation is a "penawaran harga".
 *  - **PAJAK** for the tax, not "PPN": Indonesia's VAT is PPN, but Timor-Leste has none, and the seller's own tax name
 *    is printed on each line.
 *  - **SISA TAGIHAN** for BALANCE DUE (what is still owed), **DIBAYAR** for AMOUNT PAID.
 *  - **Ditagihkan kepada** for Bill To, **Dari** for the sender.
 *  - No "total termasuk pajak": the total simply says TOTAL, as the line amounts already carry their tax.
 *  - Figures `Rp1.234,50` / `$1.234,50` (symbol first as in the app, dot thousands, decimal comma), rates `11,00%`,
 *    dates `29 Sep 2026`.
 *
 * Keys are `InvoiceLabels` minus the optional `totalWithTax`.
 */
export const ID_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "Faktur",
  from: "Dari",
  billTo: "Ditagihkan kepada",
  invoiceDetails: "Detail faktur",
  invoiceNo: "No. faktur",
  issueDate: "Tanggal faktur",
  dueDate: "Jatuh tempo",
  poNo: "No. PO",
  phone: "Telepon",
  email: "Email",
  colSn: "No.",
  colDescription: "Deskripsi",
  colQty: "Jml",
  colPrice: "Harga satuan",
  colDisc: "Diskon",
  colTax: "Pajak",
  colAmount: "Jumlah",
  subTotal: "SUBTOTAL",
  discount: "DISKON",
  tax: "PAJAK",
  shipping: "ONGKOS KIRIM",
  total: "TOTAL",
  amountPaid: "DIBAYAR",
  balanceDue: "SISA TAGIHAN",
  notes: "Catatan",
  terms: "Syarat dan ketentuan",
  paymentInstructions: "Instruksi pembayaran",
  authorizedSignature: "Tanda tangan",
  footerGenerated: "Faktur dibuat dengan Invotick",
  footerTagline: "Buat faktur profesional dalam hitungan detik",
  footerScan: "Pindai untuk mengunduh Invotick",
  footerContact: "Hubungi kami",
};

/** Only what an estimate says differently — merged over [ID_LABELS]. */
export const ID_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Penawaran Harga",
  billTo: "Kepada",
  invoiceDetails: "Detail penawaran",
  invoiceNo: "No. penawaran",
  issueDate: "Tanggal penawaran",
  dueDate: "Berlaku hingga",
  footerGenerated: "Penawaran dibuat dengan Invotick",
};
