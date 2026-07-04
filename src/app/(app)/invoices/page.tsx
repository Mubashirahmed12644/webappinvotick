import { getWorkspace } from "@/lib/data";
import { getSession } from "@/lib/session";
import { InvoiceHome } from "@/components/invoices/InvoiceHome";

export default async function InvoicesPage() {
  const [{ invoices, businesses }, session] = await Promise.all([getWorkspace(), getSession()]);
  const businessName = businesses[0]?.name ?? null;
  const currency = invoices[0]?.currency || businesses[0]?.currencyCode || "USD";
  const userName = session?.user.username ?? null;

  return <InvoiceHome invoices={invoices} businessName={businessName} currency={currency} userName={userName} />;
}
