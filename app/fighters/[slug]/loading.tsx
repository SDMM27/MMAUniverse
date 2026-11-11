export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <div aria-hidden="true" className="h-24 animate-pulse border border-line bg-surface" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} aria-hidden="true" className="h-16 animate-pulse border border-line bg-surface" />
        ))}
      </div>
    </main>
  );
}
