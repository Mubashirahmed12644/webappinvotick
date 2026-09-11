import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoice/InvoiceForm";
import { getInvoiceDetail, getInvoiceItemsForEdit, getWorkspace } from "@/lib/data";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, ws, savedItems] = await Promise.all([getInvoiceDetail(id), getWorkspace(), getInvoiceItemsForEdit(id)]);
  if (!invoice) notFound();
  // The items come from the sync pull, as the invoice's page shows them. The REST detail has none of
  // their tax or links and lists the items deleted in the app as well, so the form does not fall
  // back to it.
  if (!savedItems) {
    return (
      <div className="mx-auto max-w-4xl rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-3 text-sm font-medium text-[var(--color-on-error-container)]">
        This invoice&apos;s items could not be loaded, so it cannot be edited right now. Please try again in a moment.
      </div>
    );
  }

  return (
    <InvoiceForm
      businesses={ws.businesses}
      clients={ws.clients}
      products={ws.products}
      taxes={ws.taxes}
      templates={ws.templates}
      signatures={ws.signatures}
      stamps={ws.stamps}
      headers={ws.headers}
      backgrounds={ws.backgrounds}
      invoice={invoice}
      savedItems={savedItems}
      // The REST detail omits the business; the sync pull carries it (or its client's).
      initialBusinessId={ws.invoices.find((i) => i.id === id)?.businessId ?? null}
    />
  );
}
