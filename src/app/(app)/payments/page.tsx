import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function PaymentsPage() {
  const { payments, clients } = await getWorkspace();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Payments <span className="text-[var(--color-on-surface-variant)]">({payments.length})</span>
        </h1>
        <Link href="/payments/new"><Button>+ Record payment</Button></Link>
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Total received</p>
        <p className="mt-1 text-2xl font-extrabold text-[var(--color-on-surface)]">{formatMoney(total)}</p>
      </Card>

      {payments.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-on-surface-variant)]">No payments yet.</Card>
      ) : (
        <Card className="divide-y divide-[var(--color-outline-variant)]">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="font-semibold text-[var(--color-on-surface)]">{p.paymentNumber}</p>
                <p className="text-sm text-[var(--color-on-surface-variant)]">
                  {[p.clientId ? clientName.get(p.clientId) : null, formatDate(p.paymentDate)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="font-bold text-[var(--color-secondary)]">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
