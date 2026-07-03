import { ClientForm } from "@/components/client/ClientForm";
import { getWorkspace } from "@/lib/data";

export default async function NewClientPage() {
  const { primaryBusinessId } = await getWorkspace();
  return <ClientForm primaryBusinessId={primaryBusinessId} />;
}
