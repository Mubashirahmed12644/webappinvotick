import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getWorkspace } from "@/lib/data";
import { formatMoney, formatDate } from "@/lib/format";

export default async function ExpensesPage() {
  const { expenses, merchants } = await getWorkspace();
  const merchantName = new Map(merchants.map((m) => [m.id, m.name]));
  const total = expenses.reduce((s, e) => s + Number(e.total || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Expenses <span className="text-[var(--color-on-surface-variant)]">({expenses.length})</span>
        </h1>
        <Link href="/expenses/new"><Button>+ New expense</Button></Link>
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Total expenses</p>
        <p className="mt-1 text-2xl font-extrabold text-[var(--color-on-surface)]">{formatMoney(total)}</p>
      </Card>

      {expenses.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-on-surface-variant)]">No expenses yet.</Card>
      ) : (
        <Card className="divide-y divide-[var(--color-outline-variant)]">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="font-semibold text-[var(--color-on-surface)]">{e.category || "Expense"}</p>
                <p className="text-sm text-[var(--color-on-surface-variant)]">
                  {[e.merchantId ? merchantName.get(e.merchantId) : null, formatDate(e.date)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="font-bold text-[var(--color-on-surface)]">{formatMoney(e.total)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
