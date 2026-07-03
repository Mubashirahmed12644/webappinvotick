import { notFound } from "next/navigation";
import { BusinessForm } from "@/components/business/BusinessForm";
import { getBusinessDetail } from "@/lib/data";

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessDetail(id);
  if (!business) notFound();
  return <BusinessForm business={business} />;
}
