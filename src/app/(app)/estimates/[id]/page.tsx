import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { estimates, clients } = await getWorkspace();
  const estimate = estimates.find((e) => e.id === id);
  if (!estimate) notFound();
  const client = clients.find((c) => c.id === estimate.customerId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/estimates" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">← Back to estimates</Link>
      <Card className="p-6 sm:p-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Estimate</h1>
            <p className="mt-1 font-semibold text-[var(--color-on-surface-variant)]">{estimate.estimateNumber}</p>
          </div>
          <span className="inline-flex rounded-full bg-[var(--color-surface-variant)] px-2.5 py-0.5 text-xs font-bold uppercase text-[var(--color-on-surface-variant)]">{estimate.status}</span>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">For</p>
            <p className="mt-1 font-bold text-[var(--color-on-surface)]">{client?.name ?? "—"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-[var(--color-on-surface-variant)]">Date: {formatDate(estimate.estimateDate)}</p>
          </div>
        </div>
        <div className="mt-8 flex justify-end border-t border-[var(--color-outline-variant)] pt-4">
          <div className="flex w-full max-w-xs justify-between">
            <span className="font-bold text-[var(--color-on-surface)]">Total</span>
            <span className="text-lg font-extrabold text-[var(--color-primary)]">{formatMoney(estimate.totalAmount, estimate.currency)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
