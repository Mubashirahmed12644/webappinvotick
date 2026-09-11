import { getWorkspace } from "@/lib/data";
import { getSession } from "@/lib/session";
import { localDate } from "@/lib/invoice-status";
import { InvoiceHome } from "@/components/invoices/InvoiceHome";

export default async function InvoicesPage() {
  const [{ invoices, businesses }, session] = await Promise.all([getWorkspace(), getSession()]);
  const currency = invoices[0]?.currency || businesses[0]?.currencyCode || "USD";
  const userName = session?.user.username ?? null;

  // The server's date, so the server render and hydration agree on what is overdue; the page then
  // switches to the viewer's own date.
  return (
    <InvoiceHome invoices={invoices} businesses={businesses} currency={currency} userName={userName} today={localDate()} />
  );
}
