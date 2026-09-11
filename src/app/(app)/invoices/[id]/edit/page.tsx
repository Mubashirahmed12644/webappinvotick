import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoice/InvoiceForm";
import { getInvoiceDetail, getWorkspace } from "@/lib/data";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, ws] = await Promise.all([getInvoiceDetail(id), getWorkspace()]);
  if (!invoice) notFound();

  return (
    <InvoiceForm
      businesses={ws.businesses}
      clients={ws.clients}
      products={ws.products}
      taxes={ws.taxes}
      templates={ws.templates}
      signatures={ws.signatures}
      stamps={ws.stamps}
      invoice={invoice}
      // The REST detail omits the business; the sync pull carries it (or its client's).
      initialBusinessId={ws.invoices.find((i) => i.id === id)?.businessId ?? null}
    />
  );
}
