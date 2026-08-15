export default function ErrorState({
  title = 'Une erreur est survenue',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-accent/40 bg-base-card py-16 text-center">
      <p className="font-display text-lg uppercase tracking-wide text-accent">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
