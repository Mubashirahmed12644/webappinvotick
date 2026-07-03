import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { getClientDetail, getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, workspace] = await Promise.all([getClientDetail(id), getWorkspace()]);
  if (!client) notFound();

  const clientInvoices = workspace.invoices.filter((i) => i.clientId === id);
  const info: Array<[string, string | null | undefined]> = [
    ["Email", client.emailAddress],
    ["Phone", client.phone],
    ["Company", client.companyName],
    ["Address", [client.addressLine1, client.city, client.state, client.country].filter(Boolean).join(", ")],
    ["Currency", client.currencyCode],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/clients" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">← Back to clients</Link>
        <div className="flex gap-2">
          <Link href={`/clients/${id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
          <DeleteButton path={`/v1/clients/${id}`} redirectTo="/clients" confirmText="Delete this client?" />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-lg font-bold text-[var(--color-on-primary-container)]">
            {client.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{client.name}</h1>
            {client.companyName && <p className="text-[var(--color-on-surface-variant)]">{client.companyName}</p>}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {info.filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">{label}</p>
              <p className="text-[var(--color-on-surface)]">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
          <h2 className="font-bold text-[var(--color-on-surface)]">Invoices ({clientInvoices.length})</h2>
          <Link href="/invoices/new" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">+ New</Link>
        </div>
        <div className="divide-y divide-[var(--color-outline-variant)]">
          {clientInvoices.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--color-on-surface-variant)]">No invoices for this client.</p>}
          {clientInvoices.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface-variant)]">
              <div>
                <p className="font-semibold text-[var(--color-on-surface)]">{inv.invoiceNumber}</p>
                <p className="text-sm text-[var(--color-on-surface-variant)]">{formatDate(inv.invoiceDate)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={inv.status} />
                <span className="font-bold text-[var(--color-on-surface)]">{formatMoney(inv.totalAmount, inv.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
