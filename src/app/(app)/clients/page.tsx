import { getWorkspace } from "@/lib/data";
import { ClientsView, type ClientStat } from "@/components/clients/ClientsView";

const num = (v: string | number | null | undefined) => {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
};

export default async function ClientsPage() {
  const { clients, invoices } = await getWorkspace();

  // Per-client business summary (invoice count + total) from synced invoices.
  const stats: Record<string, ClientStat> = {};
  for (const inv of invoices) {
    if (!inv.clientId) continue;
    const s = stats[inv.clientId] ?? { count: 0, total: 0 };
    s.count += 1;
    s.total += num(inv.totalAmount);
    stats[inv.clientId] = s;
  }

  return <ClientsView clients={clients} stats={stats} />;
}
