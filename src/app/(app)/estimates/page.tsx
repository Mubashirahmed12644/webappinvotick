import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function EstimatesPage() {
  const { estimates, clients } = await getWorkspace();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Estimates <span className="text-[var(--color-on-surface-variant)]">({estimates.length})</span>
        </h1>
      </div>

      {estimates.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-on-surface-variant)]">No estimates yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-outline-variant)] text-left text-[var(--color-on-surface-variant)]">
                <th className="px-5 py-3 font-semibold">Estimate</th>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-surface-variant)]">
                  <td className="px-5 py-3.5">
                    <Link href={`/estimates/${e.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{e.estimateNumber}</Link>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-on-surface)]">{e.customerId ? clientName.get(e.customerId) ?? "—" : "—"}</td>
                  <td className="hidden px-5 py-3.5 text-[var(--color-on-surface-variant)] sm:table-cell">{formatDate(e.estimateDate)}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-full bg-[var(--color-surface-variant)] px-2.5 py-0.5 text-xs font-bold uppercase text-[var(--color-on-surface-variant)]">{e.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-[var(--color-on-surface)]">{formatMoney(e.totalAmount, e.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
