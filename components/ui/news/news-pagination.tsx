import Link from 'next/link';

export default function NewsPagination({
  page,
  totalPages,
  organizationId,
}: {
  page: number;
  totalPages: number;
  organizationId?: string;
}) {
  if (totalPages <= 1) return null;

  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    if (organizationId && organizationId !== 'all') params.set('org', organizationId);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/actualites?${qs}` : '/actualites';
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Link
        href={hasPrevious ? hrefForPage(page - 1) : hrefForPage(page)}
        aria-disabled={!hasPrevious}
        tabIndex={hasPrevious ? undefined : -1}
        className={`inline-flex min-h-11 items-center border-2 border-ink px-4 font-display text-sm uppercase text-ink transition-colors ${
          hasPrevious ? 'hover:border-accent hover:text-accent-strong' : 'pointer-events-none opacity-40'
        }`}
      >
        Précédent
      </Link>
      <span className="font-mono text-xs uppercase text-muted">
        Page {page} / {totalPages}
      </span>
      <Link
        href={hasNext ? hrefForPage(page + 1) : hrefForPage(page)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={`inline-flex min-h-11 items-center border-2 border-ink px-4 font-display text-sm uppercase text-ink transition-colors ${
          hasNext ? 'hover:border-accent hover:text-accent-strong' : 'pointer-events-none opacity-40'
        }`}
      >
        Suivant
      </Link>
    </div>
  );
}
