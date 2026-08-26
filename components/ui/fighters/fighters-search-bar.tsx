'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Organization } from '@/data/lib/definitions';

/**
 * Search input + organization select for the /fighters page. Both are driven
 * by the URL (`?q=` / `?org=`) rather than local state, so the fighters list
 * — fetched server-side in page.tsx — re-renders with the filtered/paginated
 * result instead of filtering an already-downloaded full table client-side.
 *
 * The text input is debounced before it touches the URL: without that, every
 * keystroke would trigger a fresh server round-trip against the fighters table.
 */
function FightersSearchBarInner({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [text, setText] = useState(searchParams.get('q') ?? '');

  // Keep the input in sync when the URL changes from elsewhere (browser back/forward).
  useEffect(() => {
    setText(searchParams.get('q') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')]);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === (searchParams.get('q') ?? '')) return;

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function selectOrg(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('org');
    else params.set('org', value);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Rechercher un combattant..."
        aria-label="Rechercher un combattant"
        className="w-full rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-secondary sm:max-w-xs"
      />
      <select
        value={searchParams.get('org') ?? 'all'}
        onChange={(event) => selectOrg(event.target.value)}
        className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
      >
        <option value="all">Toutes les organisations</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={String(organization.id)}>
            {organization.abbreviation}
          </option>
        ))}
      </select>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary — without it, Next.js opts
// the whole page out of static rendering at build time.
export default function FightersSearchBar(props: { organizations: Organization[] }) {
  return (
    <Suspense fallback={null}>
      <FightersSearchBarInner {...props} />
    </Suspense>
  );
}
