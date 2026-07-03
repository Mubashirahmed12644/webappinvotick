import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export default async function ProductsPage() {
  const { products } = await getWorkspace();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Products <span className="text-[var(--color-on-surface-variant)]">({products.length})</span>
        </h1>
        <Link href="/products/new"><Button>+ New product</Button></Link>
      </div>

      {products.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-on-surface-variant)]">No products yet.</Card>
      ) : (
        <Card className="divide-y divide-[var(--color-outline-variant)]">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}/edit`} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface-variant)]">
              <span className="font-semibold text-[var(--color-on-surface)]">{p.name}</span>
              <span className="font-bold text-[var(--color-on-surface)]">{formatMoney(p.unitPrice)}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
