import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/session";
import { getWorkspace } from "@/lib/data";
import { config } from "@/lib/config";
import { formatMoney, formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const session = await getSession();
  const { invoices, stats } = await getWorkspace();
  const firstName = (session?.user.username || "there").split(" ")[0];
  const recent = invoices.slice(0, 6);

  const cards = [
    { label: "Total revenue", value: formatMoney(stats.totalRevenue) },
    { label: "Paid", value: formatMoney(stats.paid) },
    { label: "Outstanding", value: formatMoney(stats.outstanding) },
    { label: "Invoices", value: String(stats.invoiceCount) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
            Welcome back, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Here&apos;s what&apos;s happening with your business.
          </p>
        </div>
        <Link href="/invoices/new">
          <Button>+ New invoice</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{s.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-on-surface)]">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
          <h2 className="font-bold text-[var(--color-on-surface)]">Recent invoices</h2>
          <Link href="/invoices" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-[var(--color-outline-variant)]">
          {recent.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-on-surface-variant)]">
              No invoices yet.
            </p>
          )}
          {recent.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-variant)]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-on-surface)]">{inv.invoiceNumber}</p>
                <p className="truncate text-sm text-[var(--color-on-surface-variant)]">{inv.clientName}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden text-sm text-[var(--color-on-surface-variant)] sm:block">
                  {formatDate(inv.invoiceDate)}
                </span>
                <StatusBadge status={inv.status} />
                <span className="w-24 text-right font-bold text-[var(--color-on-surface)]">
                  {formatMoney(inv.totalAmount, inv.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {config.mockMode && (
        <p className="text-center text-xs text-[var(--color-on-surface-variant)]">
          Demo data shown. Set MOCK_MODE=false to see live data.
        </p>
      )}
    </div>
  );
}
