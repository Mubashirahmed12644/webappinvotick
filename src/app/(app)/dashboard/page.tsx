import { getWorkspace } from "@/lib/data";
import { buildDashboard } from "@/lib/dashboard";
import { config } from "@/lib/config";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const workspace = await getWorkspace();
  const model = buildDashboard(workspace);

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
