import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getWorkspace } from "@/lib/data";

export default async function ClientsPage() {
  const { clients } = await getWorkspace();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">
          Clients <span className="text-[var(--color-on-surface-variant)]">({clients.length})</span>
        </h1>
        <Link href="/clients/new"><Button>+ New client</Button></Link>
      </div>

      {clients.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-on-surface-variant)]">No clients yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="p-5 transition hover:border-[var(--color-primary)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-container)] font-bold text-[var(--color-on-primary-container)]">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--color-on-surface)]">{c.name}</p>
                    <p className="truncate text-sm text-[var(--color-on-surface-variant)]">{c.emailAddress || "—"}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-sm text-[var(--color-on-surface-variant)]">
                  <span>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</span>
                  <span className="font-semibold">{c.currencyCode || ""}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
