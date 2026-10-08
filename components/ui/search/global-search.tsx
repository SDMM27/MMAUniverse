'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';
import {
  EMPTY_SEARCH_RESULTS,
  allFightersHref,
  eventHref,
  fighterHref,
  flattenResults,
  moveActiveIndex,
  normalizeSearchQuery,
  organizationHref,
} from '@/data/lib/search-utils';
import type { SearchResults } from '@/data/lib/search-utils';

const DEBOUNCE_MS = 250;

type Status = 'idle' | 'loading' | 'done' | 'error';

/** Header / mobile-menu button opening the search dialog. */
export function SearchButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Rechercher"
      aria-haspopup="dialog"
      title="Rechercher (Ctrl+K)"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-base-border text-ink-primary transition-colors hover:border-accent hover:text-accent ${className}`}
    >
      <SearchIcon className="h-5 w-5" />
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const titleId = `${baseId}-title`;

  const [text, setText] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS);
  const [status, setStatus] = useState<Status>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = normalizeSearchQuery(text);
  const items = useMemo(() => flattenResults(results), [results]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Global shortcuts: "/" (outside text fields) and Ctrl/Cmd+K open the dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (event.key === '/' && !open && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // Close once the route actually changes.
  useEffect(() => {
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  // While open: lock body scroll, move focus into the dialog, give it back on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Reset when closed so the next opening starts clean.
  useEffect(() => {
    if (open) return;
    setText('');
    setResults(EMPTY_SEARCH_RESULTS);
    setStatus('idle');
    setActiveIndex(-1);
  }, [open]);

  // Debounced fetch; the previous request is aborted, and a stale response can never overwrite a newer one.
  useEffect(() => {
    if (!open) return;
    if (!query) {
      setResults(EMPTY_SEARCH_RESULTS);
      setStatus('idle');
      setActiveIndex(-1);
      return;
    }
    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<SearchResults>;
        if (controller.signal.aborted) return;
        setResults({
          fighters: data.fighters ?? [],
          events: data.events ?? [],
          organizations: data.organizations ?? [],
        });
        setActiveIndex(-1);
        setStatus('done');
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setResults(EMPTY_SEARCH_RESULTS);
        setStatus('error');
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  // Keep the keyboard-active option visible.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, baseId]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => moveActiveIndex(current, event.key === 'ArrowDown' ? 1 : -1, items.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) go(items[activeIndex].href);
      else if (query) go(allFightersHref(query));
    }
  }

  // Escape closes; Tab is kept inside the dialog.
  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button, a[href]');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  const hasResults = items.length > 0;
  let optionIndex = -1;
  const optionProps = () => {
    optionIndex += 1;
    const index = optionIndex;
    return {
      id: `${baseId}-opt-${index}`,
      role: 'option' as const,
      'aria-selected': index === activeIndex,
      onMouseMove: () => setActiveIndex(index),
      onClick: close,
      className: `flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
        index === activeIndex ? 'bg-base-border' : 'hover:bg-base-border'
      }`,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
      <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-base-border bg-base-bg shadow-xl"
      >
        <h2 id={titleId} className="sr-only">
          Recherche
        </h2>
        <div className="flex items-center gap-3 border-b border-base-border px-4 py-3">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink-secondary" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Rechercher un combattant, un événement ou une organisation"
            aria-expanded={hasResults}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher un combattant, un événement…"
            maxLength={120}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base text-ink-primary placeholder:text-ink-secondary focus:outline-none"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Fermer la recherche"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-base-border text-ink-secondary hover:text-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-2">
          <div aria-live="polite" className="px-3 py-2 text-sm text-ink-secondary">
            {!query && 'Tapez au moins 2 caractères.'}
            {query && status === 'loading' && 'Recherche en cours…'}
            {query && status === 'error' && 'La recherche est indisponible pour le moment.'}
            {query && status === 'done' && !hasResults && 'Aucun résultat'}
          </div>

          <div id={listboxId} role="listbox" aria-label="Résultats de recherche">
            {results.fighters.length > 0 && (
              <ResultGroup label="Combattants" groupId={`${baseId}-g-fighters`}>
                {results.fighters.map((fighter) => (
                  <Link key={fighter.id} href={fighterHref(fighter)} {...optionProps()}>
                    <CoverImage
                      src={fighter.image_url}
                      alt=""
                      objectPosition="top"
                      sizes="40px"
                      className="h-10 w-10 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-primary">{fighter.name}</span>
                      <span className="block truncate text-xs text-ink-secondary">
                        {[fighter.weight_class, fighter.organization_abbreviation, fighter.record].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <CountryFlag code={fighter.nationality} className="shrink-0 text-base" />
                  </Link>
                ))}
              </ResultGroup>
            )}
            {results.events.length > 0 && (
              <ResultGroup label="Événements" groupId={`${baseId}-g-events`}>
                {results.events.map((event) => (
                  <Link key={event.id} href={eventHref(event)} {...optionProps()}>
                    <CoverImage
                      src={event.event_poster}
                      alt=""
                      sizes="40px"
                      className="h-10 w-10 shrink-0 rounded-md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-primary">{displayEventName(event.name)}</span>
                      <span className="block truncate text-xs text-ink-secondary">
                        {[formatEventDate(event.date), event.organization_abbreviation].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                ))}
              </ResultGroup>
            )}
            {results.organizations.length > 0 && (
              <ResultGroup label="Organisations" groupId={`${baseId}-g-orgs`}>
                {results.organizations.map((organization) => (
                  <Link key={organization.id} href={organizationHref(organization)} {...optionProps()}>
                    <CoverImage
                      src={organization.logo_link}
                      alt=""
                      sizes="40px"
                      className="h-10 w-10 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-primary">{organization.name}</span>
                      <span className="block truncate text-xs text-ink-secondary">{organization.abbreviation}</span>
                    </span>
                  </Link>
                ))}
              </ResultGroup>
            )}
          </div>

          {query && results.fighters.length > 0 && (
            <Link
              href={allFightersHref(query)}
              onClick={close}
              className="mt-1 block rounded-md px-3 py-2 text-sm text-accent hover:bg-base-border"
            >
              Voir tous les combattants pour « {query} »
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, groupId, children }: { label: string; groupId: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={groupId} className="mb-2">
      <p id={groupId} className="px-3 py-1 font-display text-xs uppercase tracking-wide text-ink-secondary">
        {label}
      </p>
      {children}
    </div>
  );
}
