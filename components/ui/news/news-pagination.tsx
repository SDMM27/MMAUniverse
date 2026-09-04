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
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasPrevious ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Précédent
      </Link>
      <span className="text-sm text-ink-secondary">
        Page {page} / {totalPages}
      </span>
      <Link
        href={hasNext ? hrefForPage(page + 1) : hrefForPage(page)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={`rounded-md border border-base-border px-3 py-1.5 text-sm text-ink-primary transition-colors ${
          hasNext ? 'hover:border-accent' : 'pointer-events-none opacity-40'
        }`}
      >
        Suivant
      </Link>
    </div>
  );
}
