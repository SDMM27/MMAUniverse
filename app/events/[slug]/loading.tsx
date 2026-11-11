export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <div aria-hidden="true" className="h-40 animate-pulse border border-line bg-surface" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} aria-hidden="true" className="h-20 animate-pulse border border-line bg-surface" />
        ))}
      </div>
    </main>
  );
}
