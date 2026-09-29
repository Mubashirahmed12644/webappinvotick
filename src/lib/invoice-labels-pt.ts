import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Portuguese, written by hand (decision 0187). Never a machine translation.
 *
 * European Portuguese norms, because the installs are Angola, Mozambique, Guinea-Bissau, Cabo Verde and São Tomé
 * (which follow them) with Brazil a small minority. Where the two differ the neutral word is taken:
 *
 *  - **Fatura** (1990 spelling; Angola's tax forms still write "Factura" — the first native-check question).
 *  - **Orçamento** for an estimate (Portugal, Brazil and Africa alike; "Proforma" is a different document).
 *  - **IVA** for the tax: the tax on an invoice in Angola, Mozambique, Portugal, Cabo Verde and São Tomé.
 *  - **Cliente** over "Faturar a" (a calque); **Emitente** for the sender, as Portuguese invoices print it.
 *  - **Valor** for a line's amount (understood everywhere; "Montante" reads European only).
 *  - **VALOR EM DÍVIDA** for BALANCE DUE — the Portuguese phrase; "Saldo devedor" is accountancy.
 *  - **ENVIO** for shipping (neutral; "Portes" is Portugal-only).
 *  - No "TOTAL c/ IVA": a line's amount already carries its tax, as in the French set.
 *
 * Keys are exactly `InvoiceLabels` minus the French-only `totalWithTax`.
 */
export const PT_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "Fatura",
  from: "Emitente",
  billTo: "Cliente",
  invoiceDetails: "Detalhes da fatura",
  invoiceNo: "N.º da fatura",
  issueDate: "Data de emissão",
  dueDate: "Data de vencimento",
  poNo: "N.º de encomenda",
  phone: "Telefone",
  email: "E-mail",
  colSn: "N.º",
  colDescription: "Descrição",
  colQty: "Qtd.",
  colPrice: "Preço unit.",
  colDisc: "Desc.",
  colTax: "IVA",
  colAmount: "Valor",
  subTotal: "SUBTOTAL",
  discount: "DESCONTO",
  tax: "IVA",
  shipping: "ENVIO",
  total: "TOTAL",
  amountPaid: "VALOR PAGO",
  balanceDue: "VALOR EM DÍVIDA",
  notes: "Observações",
  terms: "Termos e condições",
  paymentInstructions: "Instruções de pagamento",
  authorizedSignature: "Assinatura",
  footerGenerated: "Fatura criada com a Invotick",
  footerTagline: "Crie faturas profissionais em segundos",
  footerScan: "Leia o código para descarregar a Invotick",
  footerContact: "Contacte-nos",
};

/** Only what an estimate says differently — merged over [PT_LABELS]. */
export const PT_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "Orçamento",
  invoiceDetails: "Detalhes do orçamento",
  invoiceNo: "N.º do orçamento",
  dueDate: "Válido até",
  footerGenerated: "Orçamento criado com a Invotick",
};
