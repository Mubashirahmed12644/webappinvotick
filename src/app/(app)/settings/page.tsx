import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getProfile, getWorkspace } from "@/lib/data";

export default async function SettingsPage() {
  const [profile, { businesses }] = await Promise.all([getProfile(), getWorkspace()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Settings</h1>

      <Card className="p-6">
        <h2 className="font-bold text-[var(--color-on-surface)]">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={profile?.username} />
          <Field label="Email" value={profile?.email} />
          <Field label="Phone" value={profile?.phoneNumber} />
          <Field label="Email verified" value={profile?.isVerified ? "Yes" : "No"} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
          <h2 className="font-bold text-[var(--color-on-surface)]">Businesses ({businesses.length})</h2>
          <Link href="/settings/business/new"><Button size="sm">+ New business</Button></Link>
        </div>
        <div className="divide-y divide-[var(--color-outline-variant)]">
          {businesses.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--color-on-surface-variant)]">No businesses yet.</p>}
          {businesses.map((b) => (
            <Link key={b.id} href={`/settings/business/${b.id}/edit`} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface-variant)]">
              <span className="font-semibold text-[var(--color-on-surface)]">{b.name}</span>
              <span className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{b.currencyCode || ""}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">{label}</p>
      <p className="text-[var(--color-on-surface)]">{value || "—"}</p>
    </div>
  );
}
