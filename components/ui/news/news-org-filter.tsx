'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Organization } from '@/data/lib/definitions';

function NewsOrgFilterInner({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectOrg(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('org');
    else params.set('org', value);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={searchParams.get('org') ?? 'all'}
      onChange={(event) => selectOrg(event.target.value)}
      aria-label="Filtrer par organisation"
      className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
    >
      <option value="all">Toutes les organisations</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={String(organization.id)}>
          {organization.abbreviation}
        </option>
      ))}
    </select>
  );
}

// useSearchParams() requires a Suspense boundary — without it, Next.js opts
// the whole page out of static rendering at build time.
export default function NewsOrgFilter(props: { organizations: Organization[] }) {
  return (
    <Suspense fallback={null}>
      <NewsOrgFilterInner {...props} />
    </Suspense>
  );
}
