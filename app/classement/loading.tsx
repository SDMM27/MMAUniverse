// app/classement/loading.tsx
export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-3 p-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} aria-hidden="true" className="h-12 animate-pulse rounded-lg border border-base-border bg-base-card" />
      ))}
    </main>
  );
}
