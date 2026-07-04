import { getWorkspace } from "@/lib/data";
import { EstimatesView } from "@/components/estimates/EstimatesView";

export default async function EstimatesPage() {
  const { estimates, clients } = await getWorkspace();
  const names: Record<string, string> = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const currency = estimates[0]?.currency || "USD";

  return <EstimatesView estimates={estimates} names={names} currency={currency} />;
}
