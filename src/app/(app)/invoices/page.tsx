import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function InvoicesPage() {
  const { invoices } = await getWorkspace();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Invoices <span className="text-[var(--color-on-surface-variant)]">({invoices.length})</span>
        </h1>
        <Link href="/invoices/new">
          <Button>+ New invoice</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-outline-variant)] text-left text-[var(--color-on-surface-variant)]">
              <th className="px-5 py-3 font-semibold">Invoice</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="hidden px-5 py-3 font-semibold sm:table-cell">Date</th>
              <th className="hidden px-5 py-3 font-semibold sm:table-cell">Due</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-outline-variant)]">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-on-surface-variant)]">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[var(--color-surface-variant)]">
                <td className="px-5 py-3.5">
                  <Link href={`/invoices/${inv.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-[var(--color-on-surface)]">{inv.clientName}</td>
                <td className="hidden px-5 py-3.5 text-[var(--color-on-surface-variant)] sm:table-cell">{formatDate(inv.invoiceDate)}</td>
                <td className="hidden px-5 py-3.5 text-[var(--color-on-surface-variant)] sm:table-cell">{formatDate(inv.dueDate)}</td>
                <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                <td className="px-5 py-3.5 text-right font-bold text-[var(--color-on-surface)]">
                  {formatMoney(inv.totalAmount, inv.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
