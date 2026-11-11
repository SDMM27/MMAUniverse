export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen shell flex-col gap-8 py-8">
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="h-4 w-40 animate-pulse bg-surface-2" />
        <div className="h-16 w-full max-w-lg animate-pulse bg-surface-2" />
        <div className="h-4 w-full max-w-xl animate-pulse bg-surface-2" />
      </div>
      <div aria-hidden="true" className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 w-28 shrink-0 animate-pulse bg-surface-2" />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse border border-line bg-surface-2" />
        ))}
      </div>
    </main>
  );
}
