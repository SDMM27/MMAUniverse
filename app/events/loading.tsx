import CardGridSkeleton from '@/components/ui/shared/card-grid-skeleton';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 shell py-4 sm:py-6">
      <CardGridSkeleton />
    </main>
  );
}
