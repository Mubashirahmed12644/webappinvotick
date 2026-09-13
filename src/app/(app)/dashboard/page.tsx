import { getWorkspace } from "@/lib/data";
import { buildDashboard } from "@/lib/dashboard";
import { localDate } from "@/lib/invoice-status";
import { config } from "@/lib/config";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const workspace = await getWorkspace();
  // The server's date, for the server render and hydration. The page then works the figures that
  // depend on the date out again on the viewer's own, as the invoice list does.
  const model = buildDashboard(workspace, localDate());

  return (
    <>
      <DashboardView model={model} />
      {config.mockMode && (
        <p className="mt-4 text-center text-xs text-[var(--color-on-surface-variant)]">
          Demo data shown. Set MOCK_MODE=false to see live data.
        </p>
      )}
    </>
  );
}
