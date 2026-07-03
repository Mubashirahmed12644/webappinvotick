import { notFound } from "next/navigation";
import { ClientForm } from "@/components/client/ClientForm";
import { getClientDetail, getWorkspace } from "@/lib/data";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, { primaryBusinessId }] = await Promise.all([getClientDetail(id), getWorkspace()]);
  if (!client) notFound();
  return <ClientForm primaryBusinessId={primaryBusinessId} client={client} />;
}
