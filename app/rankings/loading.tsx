import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <div aria-hidden="true" className="h-8 w-40 animate-pulse border border-line bg-surface" />
      <CardGridSkeleton />
    </main>
  );
}
