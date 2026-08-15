export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-base-border bg-base-card py-16 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-ink-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
