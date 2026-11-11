import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="h-[280px] animate-pulse border border-line border-t-2 border-t-ink bg-surface"
      />
      <CardGridSkeleton />
    </main>
  );
}
