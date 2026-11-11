export default function ErrorState({
  title = 'Une erreur est survenue',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-accent border-l-4 bg-surface px-4 py-16 text-center">
      <p className="font-display text-xl uppercase text-danger">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
    </div>
  );
}
