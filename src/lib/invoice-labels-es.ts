import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Spanish, written by hand (decision 0187). Never a machine translation.
 *
 * Neutral Latin American Spanish, because the installs are the United States (es-US), Mexico, Venezuela, Bolivia,
 * the Dominican Republic and Nicaragua, with Spain a minority:
 *
 *  - **Cotización** for an estimate (Latin America; Spain says "Presupuesto" — a native-check question).
 *  - **Impuesto**, not "IVA": the largest group is es-US, where the tax is a sales tax, and the Dominican Republic's
 *    is ITBIS. The seller's own tax name is printed on each line anyway.
 *  - **Importe** for amounts (Mexico's own invoices print it; understood everywhere).
 *  - **SALDO PENDIENTE** for BALANCE DUE.
 *  - Figures keep the app's own `1,234.50` (see `format.ts`): the point-decimal countries are the majority here.
 */
export const ES_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "Factura",
  from: "Emisor",
  billTo: "Cliente",
  invoiceDetails: "Datos de la factura",
  invoiceNo: "N.º de factura",
  issueDate: "Fecha de emisión",
  dueDate: "Fecha de vencimiento",
  poNo: "N.º de orden de compra",
  phone: "Teléfono",
  email: "Correo",
  colSn: "N.º",
  colDescription: "Descripción",
  colQty: "Cant.",
  colPrice: "Precio unit.",
  colDisc: "Desc.",
  colTax: "Impuesto",
  colAmount: "Importe",
  subTotal: "SUBTOTAL",
  discount: "DESCUENTO",
  tax: "IMPUESTO",
  shipping: "ENVÍO",
  total: "TOTAL",
  amountPaid: "IMPORTE PAGADO",
  balanceDue: "SALDO PENDIENTE",
  notes: "Notas",
  terms: "Términos y condiciones",
  paymentInstructions: "Instrucciones de pago",
  authorizedSignature: "Firma",
  footerGenerated: "Factura creada con Invotick",
  footerTagline: "Cree facturas profesionales en segundos",
  footerScan: "Escanee para descargar Invotick",
  footerContact: "Contáctenos",
};

/** Only what an estimate says differently — merged over [ES_LABELS]. */
export const ES_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Cotización",
  invoiceDetails: "Datos de la cotización",
  invoiceNo: "N.º de cotización",
  dueDate: "Válida hasta",
  footerGenerated: "Cotización creada con Invotick",
};
