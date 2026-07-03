import { InvoiceForm } from "@/components/invoice/InvoiceForm";
import { getWorkspace } from "@/lib/data";

export default async function NewInvoicePage() {
  const { clients, products, taxes, templates, signatures, stamps } = await getWorkspace();
  return <InvoiceForm clients={clients} products={products} taxes={taxes} templates={templates} signatures={signatures} stamps={stamps} />;
}
