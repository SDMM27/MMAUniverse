export default function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-40 animate-pulse border border-line border-t-2 border-t-ink bg-surface"
        />
      ))}
    </div>
  );
}
