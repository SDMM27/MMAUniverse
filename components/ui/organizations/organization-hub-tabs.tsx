'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import EventsByStatus from '@/components/ui/events/events-by-status';
import FightersGrid from '@/components/ui/fighters/fighters-grid';
import RankingsList from '@/components/ui/rankings/rankings-list';
import EmptyState from '@/components/ui/shared/empty-state';
import { Event, FighterWithOrganization, RankingWithFighter } from '@/data/lib/definitions';

type Tab = 'events' | 'fighters' | 'rankings';

type Props = {
  events: Event[];
  fighters: FighterWithOrganization[];
  rankings: RankingWithFighter[];
};

/**
 * Renders a segmented Événements / Fighters / Classement switcher for an
 * organization's page, turning it into a real hub for everything tied to
 * that org. Structurally mirrors components/ui/events/events-by-status.tsx:
 * the active tab lives in the `?tab=` query param (not local state) so it
 * survives back navigation, and switching tabs uses router.replace so it
 * doesn't pile up its own back-stack entries.
 */
function OrganizationHubTabsInner({ events, fighters, rankings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramTab = searchParams.get('tab');
  // Default = Événements, preserving the pre-redesign page's behavior.
  const tab: Tab = paramTab === 'fighters' || paramTab === 'rankings' ? paramTab : 'events';

  function selectTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Sections de l'organisation">
        {(
          [
            ['events', 'Événements'],
            ['fighters', 'Fighters'],
            ['rankings', 'Classement'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wide transition-colors ${
              tab === value
                ? 'border-accent bg-accent text-white'
                : 'border-base-border bg-base-card text-ink-secondary hover:border-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'events' &&
        (events.length === 0 ? (
          <EmptyState
            title="Aucun événement programmé"
            description="Revenez plus tard pour les prochains events de cette organisation."
          />
        ) : (
          <EventsByStatus
            events={events}
            emptyUpcoming="Aucun événement à venir pour cette organisation"
            emptyPast="Aucun événement passé pour cette organisation"
          />
        ))}
      {tab === 'fighters' &&
        (fighters.length === 0 ? <EmptyState title="Aucun fighter enregistré" /> : <FightersGrid fighters={fighters} />)}
      {tab === 'rankings' &&
        (rankings.length === 0 ? (
          <EmptyState
            title="Classement non disponible"
            description="Le classement de cette organisation n'est pas encore suivi."
          />
        ) : (
          <RankingsList rankings={rankings} />
        ))}
    </div>
  );
}

// useSearchParams() requires a Suspense boundary -- without it, Next.js opts
// the whole page out of static rendering at build time.
export default function OrganizationHubTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <OrganizationHubTabsInner {...props} />
    </Suspense>
  );
}
