import { InvoiceForm } from "@/components/invoice/InvoiceForm";
import { getWorkspace } from "@/lib/data";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?business= carries the business chosen on the invoices page into the form.
  const { business } = await searchParams;
  const { businesses, clients, invoices, products, taxes, templates, signatures, stamps, headers, backgrounds } =
    await getWorkspace();
  return (
    <InvoiceForm
      businesses={businesses}
      clients={clients}
      products={products}
      taxes={taxes}
      templates={templates}
      signatures={signatures}
      stamps={stamps}
      headers={headers}
      backgrounds={backgrounds}
      initialBusinessId={typeof business === "string" ? business : null}
      takenNumbers={invoices.map((i) => ({ businessId: i.businessId, invoiceNumber: i.invoiceNumber }))}
    />
  );
}
