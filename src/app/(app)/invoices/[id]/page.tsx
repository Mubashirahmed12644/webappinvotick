import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { getInvoiceRenderData } from "@/lib/data";
import QRCode from "qrcode";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInvoiceRenderData(id);
  if (!data) notFound();

  const qrDataUrl = await QRCode.toDataURL("https://gw.invotick.com/r/2/RefCode", {
    margin: 1,
    width: 120,
  }).catch(() => null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">← Back to invoices</Link>
        <div className="flex gap-2">
          <PrintButton />
          <Link href={`/invoices/${data.id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
          <DeleteButton path={`/v1/invoices/${data.id}`} redirectTo="/invoices" confirmText="Delete this invoice?" />
        </div>
      </div>

      <div className="print-area overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-outline-variant)]">
        <InvoiceDocument data={data} qrDataUrl={qrDataUrl} />
      </div>
    </div>
  );
}
