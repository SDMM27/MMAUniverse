// app/onboarding/loading.tsx
export default function Loading() {
  return (
    <main role="status" aria-label="Chargement" className="flex min-h-screen flex-col gap-3 p-4 sm:p-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} aria-hidden="true" className="h-16 animate-pulse border border-line bg-surface" />
      ))}
    </main>
  );
}
