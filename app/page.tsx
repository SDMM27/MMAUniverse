import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEvent } from '@/data/lib/event-utils';
import { splitMainEvent } from '@/data/lib/fight-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const RECENT_RESULTS_COUNT = 4;

export default async function Page() {
  const events = await fetchAllEvents();
  const next = computeNextEvent(events);

  // Only fetch the hero event's fight card when the hero is actually an
  // upcoming event — when there's no future event in DB, computeNextEvent
  // falls back to the last past event, which has nothing left "à venir".
  const heroEvent = next && next.isUpcoming ? next.event : null;

  const [heroFights, recentResults] = await Promise.all([
    heroEvent ? fetchFightsByEvent(String(heroEvent.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  ]);

  const { mainEvent, rest } = splitMainEvent(heroFights);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero event={next.event} isUpcoming={next.isUpcoming} />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}

      {heroFights.length > 0 && heroEvent && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Combats à venir</h2>
            <Link href={`/events/${heroEvent.id}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          {mainEvent && (
            <div className="mb-3">
              <FightCard fight={mainEvent} event={heroEvent} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">Derniers résultats</h2>
          <div className="flex flex-col gap-3">
            {recentResults.map((result) => (
              <FightResultRow key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
