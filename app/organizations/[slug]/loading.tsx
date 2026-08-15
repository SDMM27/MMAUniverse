import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="h-16 animate-pulse rounded-lg border border-base-border bg-base-card" />
      <CardGridSkeleton />
    </main>
  );
}
