import { Card } from "@/components/ui/Card";

export function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{title}</h1>
      <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-2xl">
          🚧
        </span>
        <p className="font-bold text-[var(--color-on-surface)]">Coming soon</p>
        <p className="max-w-sm text-sm text-[var(--color-on-surface-variant)]">
          {description ?? "This screen is being built next. The layout, theme, and navigation are ready."}
        </p>
      </Card>
    </div>
  );
}
