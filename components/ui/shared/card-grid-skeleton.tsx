export default function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-lg border border-base-border bg-base-card"
        />
      ))}
    </div>
  );
}
