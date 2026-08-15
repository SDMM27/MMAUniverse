export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-6 p-6">
      <div aria-hidden="true" className="h-20 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} aria-hidden="true" className="h-20 animate-pulse rounded-lg border border-base-border bg-base-card" />
        ))}
      </div>
    </main>
  );
}
