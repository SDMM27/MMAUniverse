export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="h-24 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg border border-base-border bg-base-card" />
        ))}
      </div>
    </main>
  );
}
