import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { getWorkspace } from "@/lib/data";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { products } = await getWorkspace();
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  return <ProductForm product={{ id: product.id, name: product.name, unitPrice: product.unitPrice }} />;
}
