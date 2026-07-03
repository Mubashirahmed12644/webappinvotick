import { PaymentForm } from "@/components/payment/PaymentForm";
import { getWorkspace } from "@/lib/data";

export default async function NewPaymentPage() {
  const { clients } = await getWorkspace();
  return <PaymentForm clients={clients} />;
}
