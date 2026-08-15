import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div
        aria-hidden="true"
        className="h-[280px] animate-pulse rounded-lg border border-base-border bg-base-card"
      />
      <CardGridSkeleton />
    </main>
  );
}
