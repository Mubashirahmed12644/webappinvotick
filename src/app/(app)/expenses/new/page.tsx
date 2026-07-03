import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { getWorkspace } from "@/lib/data";

export default async function NewExpensePage() {
  const { merchants } = await getWorkspace();
  return <ExpenseForm merchants={merchants} />;
}
