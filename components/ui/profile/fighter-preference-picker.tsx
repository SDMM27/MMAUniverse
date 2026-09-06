// components/ui/profile/fighter-preference-picker.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import type { FighterWithOrganization } from '@/data/lib/definitions';

export default function FighterPreferencePicker({
  preferredFighters,
}: {
  preferredFighters: FighterWithOrganization[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FighterWithOrganization[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Debounced live search — same 300ms pattern as FightersSearchBar
  // (components/ui/fighters/fighters-search-bar.tsx) — so every keystroke
  // doesn't fire its own request.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/fighters/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json())
        .then((data) => setResults(data.fighters ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const preferredIds = new Set(preferredFighters.map((fighter) => fighter.id));
  const visibleResults = results.filter((fighter) => !preferredIds.has(fighter.id));

  async function addFighter(fighterId: number) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/fighters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighterId }),
      });
      if (!response.ok) throw new Error('add failed');
      setQuery('');
      setResults([]);
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  async function removeFighter(fighterId: number) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/fighters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighterId }),
      });
      if (!response.ok) throw new Error('remove failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">Combattants préférés</h2>

      {preferredFighters.length > 0 && (
        <ul className="flex flex-col gap-2">
          {preferredFighters.map((fighter) => (
            <li
              key={fighter.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-base-border bg-base-card p-2"
            >
              <div className="flex items-center gap-2">
                <CoverImage src={fighter.image_url} alt={fighter.name} className="h-10 w-10 rounded-full" objectPosition="top" />
                <div className="flex items-center gap-1.5">
                  <CountryFlag code={fighter.nationality} className="text-sm" />
                  <span className="text-sm text-ink-primary">{fighter.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFighter(fighter.id)}
                disabled={status === 'saving'}
                className="text-xs text-ink-secondary hover:text-accent disabled:opacity-40"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un combattant..."
        aria-label="Rechercher un combattant"
        className="w-full rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-secondary sm:max-w-xs"
      />

      {visibleResults.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visibleResults.map((fighter) => (
            <li
              key={fighter.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-base-border bg-base-card p-2"
            >
              <div className="flex items-center gap-2">
                <CoverImage src={fighter.image_url} alt={fighter.name} className="h-10 w-10 rounded-full" objectPosition="top" />
                <div className="flex items-center gap-1.5">
                  <CountryFlag code={fighter.nationality} className="text-sm" />
                  <span className="text-sm text-ink-primary">{fighter.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => addFighter(fighter.id)}
                disabled={status === 'saving'}
                className="text-xs text-accent hover:underline disabled:opacity-40"
              >
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === 'error' && <p className="text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
